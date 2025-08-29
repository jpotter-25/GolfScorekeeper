import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import { gameRooms, gameParticipants, roomAuditLog } from '../shared/schema';
import { eq, and, lt, gte } from 'drizzle-orm';

interface WSClient {
  id: string;
  ws: WebSocket;
  userId: string | null;
  roomCode: string | null;
  isAlive: boolean;
  subscribedToList: boolean;
}

interface RoomCard {
  code: string;
  name: string;
  visibility: 'public' | 'private';
  isLocked: boolean;
  hostName: string;
  hostHasCrown: boolean;
  playerCount: number;
  maxPlayers: number;
  rounds: number;
  betCoins: number;
  state: 'waiting' | 'active' | 'finished';
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WSClient> = new Map();
  private roomSubscribers: Set<string> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  initialize(server: any) {
    this.wss = new WebSocketServer({ server, path: '/ws-rooms' });
    
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const clientId = uuidv4();
      const client: WSClient = {
        id: clientId,
        ws,
        userId: null,
        roomCode: null,
        isAlive: true,
        subscribedToList: false
      };
      
      this.clients.set(clientId, client);
      console.log(`WebSocket client connected: ${clientId}`);
      
      // Send connection acknowledgment
      this.sendToClient(client, {
        type: 'connected',
        connectionId: clientId,
        serverTs: Date.now()
      });
      
      // Set up ping/pong for connection health
      ws.on('pong', () => {
        client.isAlive = true;
      });
      
      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(client, message);
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
          this.sendError(client, 'Invalid message format');
        }
      });
      
      ws.on('close', () => {
        this.handleDisconnect(client);
      });
      
      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
      });
    });
    
    console.log('WebSocket server initialized on /ws-rooms');
    
    // Set up heartbeat to detect disconnected clients
    this.heartbeatInterval = setInterval(() => {
      this.wss?.clients.forEach((ws) => {
        const client = Array.from(this.clients.values()).find(c => c.ws === ws);
        if (client) {
          if (!client.isAlive) {
            client.ws.terminate();
            this.handleDisconnect(client);
            return;
          }
          client.isAlive = false;
          ws.ping();
        }
      });
    }, 30000); // 30 second heartbeat
  }
  
  private async handleMessage(client: WSClient, message: any) {
    const { type, ...payload } = message;
    
    switch (type) {
      case 'auth':
        await this.handleAuth(client, payload);
        break;
      case 'room:create':
        await this.handleRoomCreate(client, payload);
        break;
      case 'room:join':
        await this.handleRoomJoin(client, payload);
        break;
      case 'room:leave':
        await this.handleRoomLeave(client, payload);
        break;
      case 'room:list:subscribe':
        await this.handleRoomListSubscribe(client);
        break;
      case 'room:list:unsubscribe':
        await this.handleRoomListUnsubscribe(client);
        break;
      case 'room:settings:update':
        await this.handleRoomSettingsUpdate(client, payload);
        break;
      case 'room:ready:set':
        await this.handleReadySet(client, payload);
        break;
      case 'game:start':
        await this.handleGameStart(client, payload);
        break;
      case 'move:submit':
        await this.handleMoveSubmit(client, payload);
        break;
      case 'session:ping':
        this.handlePing(client, payload);
        break;
      default:
        this.sendError(client, `Unknown message type: ${type}`);
    }
  }
  
  private async handleAuth(client: WSClient, payload: { userId: string }) {
    client.userId = payload.userId;
    this.sendToClient(client, {
      type: 'authenticated',
      userId: payload.userId,
      serverTs: Date.now()
    });
  }
  
  private async handleRoomCreate(client: WSClient, payload: any) {
    if (!client.userId) {
      this.sendError(client, 'Not authenticated');
      return;
    }
    
    const { name, visibility, password, maxPlayers, rounds, betCoins } = payload;
    
    // Generate unique room code
    const code = this.generateRoomCode();
    
    try {
      // Create room in database
      const [room] = await db.insert(gameRooms).values({
        code,
        name: name || `${client.userId}'s Room`,
        hostId: client.userId,
        visibility: visibility || 'public',
        passwordHash: password ? this.hashPassword(password) : null,
        maxPlayers: maxPlayers || 4,
        rounds: rounds || 9,
        betAmount: betCoins || 0,
        state: 'waiting',
        playerCount: 1,
        crownHolderId: client.userId,
        settings: {
          maxPlayers: maxPlayers || 4,
          rounds: rounds || 9,
          betCoins: betCoins || 0
        },
        players: []
      }).returning();
      
      // Add creator as first participant
      await db.insert(gameParticipants).values({
        gameRoomId: room.id,
        userId: client.userId,
        joinOrder: 1,
        playerIndex: 0,
        isHost: true,
        connected: true,
        connectionId: client.id,
        betPaid: betCoins || 0
      });
      
      // Update client's room code
      client.roomCode = code;
      
      // Send room created event
      this.sendToClient(client, {
        type: 'room:created',
        room: await this.getRoomCard(room),
        serverTs: Date.now()
      });
      
      // Broadcast room update to list subscribers
      await this.broadcastRoomListUpdate('added', room);
      
      // Log audit event
      await this.logAuditEvent(room.id, client.userId, 'room_created', { code, name });
      
    } catch (error) {
      console.error('Error creating room:', error);
      this.sendError(client, 'Failed to create room');
    }
  }
  
  private async handleRoomJoin(client: WSClient, payload: { code: string; password?: string }) {
    if (!client.userId) {
      this.sendError(client, 'Not authenticated');
      return;
    }
    
    const { code, password } = payload;
    
    try {
      // Find room
      const [room] = await db.select().from(gameRooms).where(eq(gameRooms.code, code));
      
      if (!room) {
        this.sendError(client, 'Room not found');
        return;
      }
      
      // Check room state
      if (room.state !== 'waiting') {
        this.sendError(client, 'Room is not accepting new players');
        return;
      }
      
      // Check if room is full
      if (room.playerCount >= room.maxPlayers!) {
        this.sendError(client, 'Room is full');
        return;
      }
      
      // Check password for private rooms
      if (room.visibility === 'private' && room.passwordHash) {
        if (!password || !this.verifyPassword(password, room.passwordHash)) {
          this.sendError(client, 'Invalid password');
          return;
        }
      }
      
      // Check if already in room
      const existing = await db.select().from(gameParticipants)
        .where(and(
          eq(gameParticipants.gameRoomId, room.id),
          eq(gameParticipants.userId, client.userId)
        ));
      
      if (existing.length > 0) {
        this.sendError(client, 'Already in room');
        return;
      }
      
      // Add participant
      const joinOrder = room.playerCount + 1;
      await db.insert(gameParticipants).values({
        gameRoomId: room.id,
        userId: client.userId,
        joinOrder,
        playerIndex: room.playerCount,
        isHost: false,
        connected: true,
        connectionId: client.id,
        betPaid: room.betAmount
      });
      
      // Update room player count
      await db.update(gameRooms)
        .set({ 
          playerCount: room.playerCount + 1,
          updatedAt: new Date(),
          lastActivityAt: new Date()
        })
        .where(eq(gameRooms.id, room.id));
      
      // Update client's room code
      client.roomCode = code;
      
      // Get updated room info
      const updatedRoom = { ...room, playerCount: room.playerCount + 1 };
      
      // Send join confirmation
      this.sendToClient(client, {
        type: 'player:joined',
        code,
        player: {
          id: client.userId,
          joinOrder
        },
        serverTs: Date.now()
      });
      
      // Broadcast to room members
      this.broadcastToRoom(code, {
        type: 'player:joined',
        code,
        player: {
          id: client.userId,
          joinOrder
        },
        serverTs: Date.now()
      }, client.id);
      
      // Update room list if room became full
      if (updatedRoom.playerCount >= updatedRoom.maxPlayers!) {
        await this.broadcastRoomListUpdate('removed', updatedRoom);
      } else {
        await this.broadcastRoomListUpdate('updated', updatedRoom);
      }
      
      // Log audit event
      await this.logAuditEvent(room.id, client.userId, 'player_joined', { code });
      
    } catch (error) {
      console.error('Error joining room:', error);
      this.sendError(client, 'Failed to join room');
    }
  }
  
  private async handleRoomLeave(client: WSClient, payload: { code: string }) {
    if (!client.userId) {
      return;
    }
    
    const { code } = payload;
    
    try {
      // Find room and participant
      const [room] = await db.select().from(gameRooms).where(eq(gameRooms.code, code));
      
      if (!room) {
        return;
      }
      
      const [participant] = await db.select().from(gameParticipants)
        .where(and(
          eq(gameParticipants.gameRoomId, room.id),
          eq(gameParticipants.userId, client.userId)
        ));
      
      if (!participant) {
        return;
      }
      
      // Mark as left
      await db.update(gameParticipants)
        .set({ 
          connected: false,
          leftAt: new Date()
        })
        .where(eq(gameParticipants.id, participant.id));
      
      // Update room player count
      const newPlayerCount = room.playerCount - 1;
      
      if (newPlayerCount === 0) {
        // Delete empty room
        await db.delete(gameRooms).where(eq(gameRooms.id, room.id));
        
        // Broadcast room deleted
        this.broadcastToRoom(code, {
          type: 'room:deleted',
          code,
          serverTs: Date.now()
        });
        
        await this.broadcastRoomListUpdate('removed', room);
      } else {
        // Update room
        await db.update(gameRooms)
          .set({ 
            playerCount: newPlayerCount,
            updatedAt: new Date(),
            lastActivityAt: new Date()
          })
          .where(eq(gameRooms.id, room.id));
        
        // Handle host migration if needed
        if (participant.isHost) {
          await this.migrateHost(room.id, participant.userId);
        }
        
        // Broadcast player left
        this.broadcastToRoom(code, {
          type: 'player:left',
          code,
          playerId: client.userId,
          serverTs: Date.now()
        }, client.id);
        
        // Update room list if room was full
        if (room.playerCount >= room.maxPlayers! && newPlayerCount < room.maxPlayers!) {
          const updatedRoom = { ...room, playerCount: newPlayerCount };
          await this.broadcastRoomListUpdate('added', updatedRoom);
        } else {
          const updatedRoom = { ...room, playerCount: newPlayerCount };
          await this.broadcastRoomListUpdate('updated', updatedRoom);
        }
      }
      
      // Clear client's room code
      client.roomCode = null;
      
      // Log audit event
      await this.logAuditEvent(room.id, client.userId, 'player_left', { code });
      
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  }
  
  private async handleRoomListSubscribe(client: WSClient) {
    client.subscribedToList = true;
    this.roomSubscribers.add(client.id);
    
    // Send current room list snapshot
    const rooms = await this.getPublicRooms();
    this.sendToClient(client, {
      type: 'room:list:snapshot',
      rooms,
      serverTs: Date.now()
    });
  }
  
  private handleRoomListUnsubscribe(client: WSClient) {
    client.subscribedToList = false;
    this.roomSubscribers.delete(client.id);
  }
  
  private async handleRoomSettingsUpdate(client: WSClient, payload: any) {
    // Implementation for settings update (host only)
    // TODO: Implement this method
  }
  
  private async handleReadySet(client: WSClient, payload: { code: string; ready: boolean }) {
    // Implementation for ready state toggle
    // TODO: Implement this method
  }
  
  private async handleGameStart(client: WSClient, payload: { code: string }) {
    // Implementation for game start
    // TODO: Implement this method
  }
  
  private async handleMoveSubmit(client: WSClient, payload: any) {
    // Implementation for game moves
    // TODO: Implement this method
  }
  
  private handlePing(client: WSClient, payload: { ts: number }) {
    this.sendToClient(client, {
      type: 'session:pong',
      clientTs: payload.ts,
      serverTs: Date.now()
    });
  }
  
  private async handleDisconnect(client: WSClient) {
    console.log(`WebSocket client disconnected: ${client.id}`);
    
    // Handle room leave if in a room
    if (client.roomCode && client.userId) {
      await this.handleRoomLeave(client, { code: client.roomCode });
    }
    
    // Remove from subscribers
    this.roomSubscribers.delete(client.id);
    
    // Remove client
    this.clients.delete(client.id);
  }
  
  private sendToClient(client: WSClient, data: any) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
    }
  }
  
  private sendError(client: WSClient, message: string, context?: any) {
    this.sendToClient(client, {
      type: 'error',
      message,
      context,
      serverTs: Date.now()
    });
  }
  
  private broadcastToRoom(roomCode: string, data: any, excludeClientId?: string) {
    this.clients.forEach(client => {
      if (client.roomCode === roomCode && client.id !== excludeClientId) {
        this.sendToClient(client, data);
      }
    });
  }
  
  private async broadcastRoomListUpdate(action: 'added' | 'updated' | 'removed', room: any) {
    const roomCard = action === 'removed' ? null : await this.getRoomCard(room);
    
    const diff = {
      type: 'room:list:diff',
      [action]: action === 'removed' ? [room.code] : [roomCard],
      serverTs: Date.now()
    };
    
    this.roomSubscribers.forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client) {
        this.sendToClient(client, diff);
      }
    });
  }
  
  private async getRoomCard(room: any): Promise<RoomCard> {
    // Get host info
    const host = await db.select().from(gameParticipants)
      .where(and(
        eq(gameParticipants.gameRoomId, room.id),
        eq(gameParticipants.isHost, true)
      ))
      .limit(1);
    
    return {
      code: room.code,
      name: room.name || 'Unnamed Room',
      visibility: room.visibility || 'public',
      isLocked: room.visibility === 'private',
      hostName: host[0]?.userId || 'Unknown',
      hostHasCrown: true,
      playerCount: room.playerCount || 0,
      maxPlayers: room.maxPlayers || 4,
      rounds: room.rounds || 9,
      betCoins: room.betAmount || 0,
      state: room.state || 'waiting'
    };
  }
  
  private async getPublicRooms(): Promise<RoomCard[]> {
    const rooms = await db.select().from(gameRooms)
      .where(and(
        eq(gameRooms.visibility, 'public'),
        eq(gameRooms.state, 'waiting'),
        lt(gameRooms.playerCount, gameRooms.maxPlayers)
      ));
    
    const roomCards = await Promise.all(rooms.map(room => this.getRoomCard(room)));
    return roomCards;
  }
  
  private async migrateHost(roomId: string, oldHostId: string) {
    // Get next player by join order
    const participants = await db.select().from(gameParticipants)
      .where(and(
        eq(gameParticipants.gameRoomId, roomId),
        eq(gameParticipants.connected, true)
      ))
      .orderBy(gameParticipants.joinOrder);
    
    if (participants.length === 0) {
      return;
    }
    
    const newHost = participants[0];
    
    // Update old host
    await db.update(gameParticipants)
      .set({ isHost: false })
      .where(and(
        eq(gameParticipants.gameRoomId, roomId),
        eq(gameParticipants.userId, oldHostId)
      ));
    
    // Update new host
    await db.update(gameParticipants)
      .set({ isHost: true })
      .where(eq(gameParticipants.id, newHost.id));
    
    // Update room
    await db.update(gameRooms)
      .set({ 
        hostId: newHost.userId,
        crownHolderId: newHost.userId,
        updatedAt: new Date()
      })
      .where(eq(gameRooms.id, roomId));
    
    // Broadcast host change
    const room = await db.select().from(gameRooms).where(eq(gameRooms.id, roomId));
    if (room[0]) {
      this.broadcastToRoom(room[0].code, {
        type: 'host:changed',
        code: room[0].code,
        hostId: newHost.userId,
        serverTs: Date.now()
      });
    }
    
    // Log audit event
    await this.logAuditEvent(roomId, newHost.userId, 'host_transfer', { 
      oldHostId, 
      newHostId: newHost.userId 
    });
  }
  
  private async logAuditEvent(roomId: string, actorId: string | null, type: string, payload: any) {
    try {
      await db.insert(roomAuditLog).values({
        roomId,
        actorId,
        type,
        payload
      });
    } catch (error) {
      console.error('Error logging audit event:', error);
    }
  }
  
  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
  
  private hashPassword(password: string): string {
    // Simple hash for demo - in production use bcrypt
    return Buffer.from(password).toString('base64');
  }
  
  private verifyPassword(password: string, hash: string): boolean {
    return Buffer.from(password).toString('base64') === hash;
  }
  
  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.clients.forEach(client => {
      client.ws.close();
    });
    
    this.wss?.close();
  }
}

export const wsManager = new WebSocketManager();