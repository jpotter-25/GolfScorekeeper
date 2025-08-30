import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import { gameRooms, gameParticipants, roomAuditLog } from '../shared/schema';
import { eq, and, lt, gte, sql } from 'drizzle-orm';
import { 
  DebugLogger, 
  InvariantChecker, 
  AckTracker, 
  createCorrelationContext,
  detectAndClassifyIssue,
  SELF_DEBUG_MODE 
} from './lib/self-debug';
import { AutoStartManager } from './lib/auto-start';

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
  private idempotentRequests: Map<string, any> = new Map();

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
      
      const context = createCorrelationContext();
      DebugLogger.log(context, 'ws.client_connected', { clientId });
      
      // Send connection acknowledgment
      this.sendToClient(client, {
        type: 'connected',
        connectionId: clientId,
        serverTs: Date.now(),
        protocolVersion: '1.0.0'
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
          const context = createCorrelationContext();
          const classification = detectAndClassifyIssue(error);
          DebugLogger.log(context, 'ws.message_error', { 
            error: error instanceof Error ? error.message : String(error), 
            classification,
            clientId: client.id 
          });
          this.sendError(client, 'Invalid message format');
        }
      });
      
      ws.on('close', () => {
        this.handleDisconnect(client);
      });
      
      ws.on('error', (error) => {
        const context = createCorrelationContext();
        DebugLogger.log(context, 'ws.connection_error', { 
          clientId,
          error: error instanceof Error ? error.message : String(error) 
        });
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
    
    // Periodic cleanup for empty rooms
    setInterval(async () => {
      try {
        // Find and delete empty rooms
        const emptyRooms = await db
          .select({ 
            id: gameRooms.id, 
            code: gameRooms.code,
            playerCount: gameRooms.playerCount 
          })
          .from(gameRooms)
          .leftJoin(gameParticipants, and(
            eq(gameParticipants.gameRoomId, gameRooms.id),
            sql`${gameParticipants.leftAt} IS NULL`
          ))
          .where(and(
            eq(gameRooms.status, 'waiting'),
            sql`${gameParticipants.id} IS NULL`
          ))
          .groupBy(gameRooms.id, gameRooms.code, gameRooms.playerCount);
        
        for (const room of emptyRooms) {
          console.log(`[WebSocket] Cleanup: Removing empty room ${room.code}`);
          await db.delete(gameRooms).where(eq(gameRooms.id, room.id));
        }
      } catch (error) {
        console.error('[WebSocket] Cleanup error:', error);
      }
    }, 60000); // Run cleanup every minute
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
    const context = createCorrelationContext(undefined, undefined, client.userId || undefined, payload.clientTs);
    DebugLogger.log(context, 'room.create.start', { payload, clientId: client.id });
    
    if (!client.userId) {
      DebugLogger.log(context, 'room.create.auth_failed', { clientId: client.id });
      this.sendError(client, 'Not authenticated');
      return;
    }
    
    const { name, visibility, password, maxPlayers, rounds, betCoins, idempotencyKey } = payload;
    
    // Check for idempotency
    if (idempotencyKey && this.idempotentRequests.has(idempotencyKey)) {
      const existingResult = this.idempotentRequests.get(idempotencyKey);
      DebugLogger.log(context, 'room.create.idempotent_duplicate', { idempotencyKey });
      this.sendToClient(client, existingResult);
      return;
    }
    
    // Generate unique room code with retry logic
    let code = this.generateRoomCode();
    let retryCount = 0;
    
    try {
      // Ensure unique code
      while (retryCount < 5) {
        const existing = await db.select().from(gameRooms).where(eq(gameRooms.code, code)).limit(1);
        if (existing.length === 0) break;
        code = this.generateRoomCode();
        retryCount++;
      }
      
      DebugLogger.log(context, 'room.create.code_generated', { code, retryCount });
      
      // Start transaction for atomic room creation
      const [room] = await db.insert(gameRooms).values({
        code,
        name: name || `${client.userId}'s Room`,
        hostId: client.userId,
        visibility: visibility || 'public',
        isPublished: true,  // Always publish to Active Lobbies
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
        players: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivityAt: new Date()
      }).returning();
      
      // Add creator as first participant  
      const [participant] = await db.insert(gameParticipants).values({
        gameRoomId: room.id,
        userId: client.userId,
        joinOrder: 1,
        playerIndex: 0,
        isHost: true,
        isReady: false,
        connected: true,
        connectionId: client.id,
        betPaid: betCoins || 0
      }).returning();
      
      // Capture state snapshot
      const participants = await db.select().from(gameParticipants)
        .where(and(
          eq(gameParticipants.gameRoomId, room.id),
          sql`${gameParticipants.leftAt} IS NULL`
        ));
      
      const snapshot = DebugLogger.captureSnapshot(room, participants);
      context.roomId = room.id;
      context.roomCode = code;
      
      DebugLogger.log(context, 'room.create.committed', { 
        roomId: room.id, 
        code,
        snapshot 
      });
      
      // Update client's room code
      client.roomCode = code;
      
      // Prepare response
      const response = {
        type: 'room:created',
        room: await this.getRoomCard(room),
        serverTs: Date.now(),
        eventId: uuidv4()
      };
      
      // Store for idempotency
      if (idempotencyKey) {
        this.idempotentRequests.set(idempotencyKey, response);
        setTimeout(() => this.idempotentRequests.delete(idempotencyKey), 60000);
      }
      
      // Send room created event
      this.sendToClient(client, response);
      
      // Track ACK
      const ackStats = await AckTracker.waitForAcks(
        response.eventId,
        'room:created',
        [client.id],
        2000
      );
      
      DebugLogger.log(context, 'room.create.ack_stats', ackStats);
      
      // Broadcast room update to list subscribers
      await this.broadcastRoomListUpdate('added', room);
      
      // Log audit event
      await this.logAuditEvent(room.id, client.userId, 'room_created', { code, name });
      
    } catch (error) {
      const classification = detectAndClassifyIssue(error, { context });
      DebugLogger.log(context, 'room.create.error', { 
        error: error instanceof Error ? error.message : String(error),
        classification 
      });
      DebugLogger.triggerTriage(
        'Room creation failed',
        classification,
        context.roomId,
        { error: error instanceof Error ? error.message : String(error) }
      );
      this.sendError(client, 'Failed to create room');
    }
  }
  
  private async handleRoomJoin(client: WSClient, payload: any) {
    const { code, password } = payload;
    const context = createCorrelationContext(undefined, code, client.userId || undefined, payload.clientTs);
    DebugLogger.log(context, 'room.join.start', { code, clientId: client.id });
    
    if (!client.userId) {
      DebugLogger.log(context, 'room.join.auth_failed', { clientId: client.id });
      this.sendError(client, 'Not authenticated');
      return;
    }
    
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
      
      // Update context
      context.roomId = room.id;
      context.roomCode = code;
      
      // Check if already in room
      const existing = await db.select().from(gameParticipants)
        .where(and(
          eq(gameParticipants.gameRoomId, room.id),
          eq(gameParticipants.userId, client.userId),
          sql`${gameParticipants.leftAt} IS NULL`
        ));
      
      if (existing.length > 0) {
        DebugLogger.log(context, 'room.join.already_in_room', { 
          userId: client.userId,
          roomId: room.id 
        });
        this.sendError(client, 'Already in room');
        return;
      }
      
      // Add participant
      const joinOrder = room.playerCount + 1;
      const [participant] = await db.insert(gameParticipants).values({
        gameRoomId: room.id,
        userId: client.userId,
        joinOrder,
        playerIndex: room.playerCount,
        isHost: false,
        isReady: false,
        connected: true,
        connectionId: client.id,
        betPaid: room.betAmount,
        joinedAt: new Date(),
        lastSeenAt: new Date()
      }).returning();
      
      DebugLogger.log(context, 'room.join.participant_added', { 
        participantId: participant.id,
        joinOrder,
        playerIndex: room.playerCount
      });
      
      // Update room player count with actual count
      const [actualCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(gameParticipants)
        .where(and(
          eq(gameParticipants.gameRoomId, room.id),
          sql`${gameParticipants.leftAt} IS NULL`
        ));
      
      await db.update(gameRooms)
        .set({ 
          playerCount: actualCount.count,
          updatedAt: new Date(),
          lastActivityAt: new Date()
        })
        .where(eq(gameRooms.id, room.id));
      
      // Update client's room code
      client.roomCode = code;
      
      // Get updated room info
      const updatedRoom = { ...room, playerCount: room.playerCount + 1 };
      
      // Capture state snapshot after join
      const participants = await db.select().from(gameParticipants)
        .where(and(
          eq(gameParticipants.gameRoomId, room.id),
          sql`${gameParticipants.leftAt} IS NULL`
        ));
      
      const snapshot = DebugLogger.captureSnapshot(updatedRoom, participants);
      DebugLogger.log(context, 'room.join.committed', { snapshot });
      
      // Check invariants
      InvariantChecker.checkRoomInvariants(updatedRoom, participants);
      
      // Send join confirmation with event ID for ACK tracking
      const response = {
        type: 'player:joined',
        eventId: uuidv4(),
        code,
        player: {
          id: client.userId,
          joinOrder
        },
        serverTs: Date.now()
      };
      
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
      
      // Get actual connected participant count
      const remainingParticipants = await db.select().from(gameParticipants)
        .where(and(
          eq(gameParticipants.gameRoomId, room.id),
          sql`${gameParticipants.leftAt} IS NULL`
        ));
      
      const actualPlayerCount = remainingParticipants.length;
      
      if (actualPlayerCount === 0) {
        console.log(`[WebSocket] Room ${code} is now empty, deleting room from database`);
        
        // Delete all participants first
        await db.delete(gameParticipants).where(eq(gameParticipants.gameRoomId, room.id));
        
        // Delete empty room
        await db.delete(gameRooms).where(eq(gameRooms.id, room.id));
        
        // Broadcast room deleted
        this.broadcastToRoom(code, {
          type: 'room:deleted',
          code,
          serverTs: Date.now()
        });
        
        // Remove from Active Lobbies
        await this.broadcastRoomListUpdate('removed', room);
      } else {
        // Update room with actual player count
        await db.update(gameRooms)
          .set({ 
            playerCount: actualPlayerCount,
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
        
        // Update room list based on new player count
        const maxPlayers = (room.settings as any)?.maxPlayers || room.maxPlayers || 4;
        if (room.playerCount >= maxPlayers && actualPlayerCount < maxPlayers) {
          // Room was full, now has space - add it back to Active Lobbies
          const updatedRoom = { ...room, playerCount: actualPlayerCount };
          console.log(`[WebSocket] Room ${code} now has space (${actualPlayerCount}/${maxPlayers}), adding to Active Lobbies`);
          await this.broadcastRoomListUpdate('added', updatedRoom);
        } else {
          const updatedRoom = { ...room, playerCount: actualPlayerCount };
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
    const context = createCorrelationContext(undefined, payload.code, client.userId || undefined);
    DebugLogger.log(context, 'room.settings.update.start', { 
      code: payload.code,
      settings: payload.settings,
      clientId: client.id 
    });
    
    if (!client.userId) {
      DebugLogger.log(context, 'room.settings.update.auth_failed', { clientId: client.id });
      this.sendError(client, 'Not authenticated');
      return;
    }
    
    const { code, settings } = payload;
    
    try {
      // Find room
      const [room] = await db.select().from(gameRooms).where(eq(gameRooms.code, code));
      
      if (!room) {
        DebugLogger.log(context, 'room.settings.update.room_not_found', { code });
        this.sendError(client, 'Room not found');
        return;
      }
      
      // Check if user is the host/crown holder
      if (room.crownHolderId !== client.userId) {
        DebugLogger.log(context, 'room.settings.update.not_host', { 
          userId: client.userId,
          crownHolderId: room.crownHolderId 
        });
        this.sendError(client, 'Only the host can update settings');
        return;
      }
      
      // Check if game hasn't started
      if (room.state !== 'waiting') {
        DebugLogger.log(context, 'room.settings.update.game_started', { state: room.state });
        this.sendError(client, 'Cannot update settings after game has started');
        return;
      }
      
      // Update room settings
      const currentSettings: any = room.settings || {};
      const updatedSettings = {
        ...currentSettings,
        maxPlayers: settings.maxPlayers || currentSettings.maxPlayers || 4,
        rounds: settings.rounds || currentSettings.rounds || 9,
        betCoins: settings.betCoins !== undefined ? settings.betCoins : currentSettings.betCoins || 0
      };
      
      await db.update(gameRooms)
        .set({ 
          settings: updatedSettings,
          maxPlayers: updatedSettings.maxPlayers,
          rounds: updatedSettings.rounds,
          betAmount: updatedSettings.betCoins,
          updatedAt: new Date()
        })
        .where(eq(gameRooms.id, room.id));
      
      DebugLogger.log(context, 'room.settings.update.success', { 
        roomId: room.id,
        code,
        settings: updatedSettings 
      });
      
      // Get updated room data with participants
      const [updatedRoom] = await db.select().from(gameRooms).where(eq(gameRooms.id, room.id));
      const participants = await db.select().from(gameParticipants)
        .where(and(
          eq(gameParticipants.gameRoomId, room.id),
          sql`${gameParticipants.leftAt} IS NULL`
        ));
      
      // Broadcast settings update to all room members
      const eventId = uuidv4();
      this.broadcastToRoom(code, {
        type: 'room:settings:updated',
        eventId,
        code,
        settings: updatedSettings,
        room: {
          ...updatedRoom,
          participants
        },
        serverTs: Date.now()
      });
      
      // Always broadcast to room list subscribers to update Active Lobbies
      await this.broadcastRoomListUpdate('updated', updatedRoom);
      
    } catch (error) {
      const classification = detectAndClassifyIssue(error, { context });
      DebugLogger.log(context, 'room.settings.update.error', { 
        error: error instanceof Error ? error.message : String(error),
        classification 
      });
      this.sendError(client, 'Failed to update settings');
    }
  }
  
  private async handleReadySet(client: WSClient, payload: { code: string; ready: boolean }) {
    const context = createCorrelationContext(undefined, payload.code, client.userId || undefined);
    DebugLogger.log(context, 'room.ready.start', { 
      code: payload.code, 
      ready: payload.ready,
      clientId: client.id 
    });
    
    if (!client.userId) {
      DebugLogger.log(context, 'room.ready.auth_failed', { clientId: client.id });
      this.sendError(client, 'Not authenticated');
      return;
    }
    
    const { code, ready } = payload;
    
    try {
      // Find room
      const [room] = await db.select().from(gameRooms).where(eq(gameRooms.code, code));
      
      if (!room) {
        DebugLogger.log(context, 'room.ready.room_not_found', { code });
        this.sendError(client, 'Room not found');
        return;
      }
      
      context.roomId = room.id;
      context.roomCode = code;
      
      // Find participant
      const [participant] = await db.select().from(gameParticipants)
        .where(and(
          eq(gameParticipants.gameRoomId, room.id),
          eq(gameParticipants.userId, client.userId),
          sql`${gameParticipants.leftAt} IS NULL`
        ));
      
      if (!participant) {
        DebugLogger.log(context, 'room.ready.participant_not_found', { 
          userId: client.userId,
          roomId: room.id 
        });
        this.sendError(client, 'Not in room');
        return;
      }
      
      // Update ready state
      await db.update(gameParticipants)
        .set({ 
          isReady: ready,
          lastSeenAt: new Date()
        })
        .where(eq(gameParticipants.id, participant.id));
      
      DebugLogger.log(context, 'room.ready.state_updated', { 
        participantId: participant.id,
        ready 
      });
      
      // Get all participants to check auto-start
      const participants = await db.select().from(gameParticipants)
        .where(and(
          eq(gameParticipants.gameRoomId, room.id),
          sql`${gameParticipants.leftAt} IS NULL`
        ));
      
      // Capture snapshot
      const snapshot = DebugLogger.captureSnapshot(room, participants);
      DebugLogger.log(context, 'room.ready.snapshot', { snapshot });
      
      // Broadcast ready state change
      // Get updated room data with participants
      const [updatedRoom] = await db.select().from(gameRooms).where(eq(gameRooms.id, room.id));
      const updatedParticipants = await db.select().from(gameParticipants)
        .where(and(
          eq(gameParticipants.gameRoomId, room.id),
          sql`${gameParticipants.leftAt} IS NULL`
        ));
      
      const eventId = uuidv4();
      this.broadcastToRoom(code, {
        type: 'player:ready',
        eventId,
        code,
        playerId: client.userId,
        ready,
        room: {
          ...updatedRoom,
          participants: updatedParticipants
        },
        serverTs: Date.now()
      });
      
      // Check and trigger auto-start if conditions are met
      const autoStartResult = await AutoStartManager.checkAndAutoStart(room.id);
      
      DebugLogger.log(context, 'room.ready.autostart_result', {
        started: autoStartResult.started,
        reason: autoStartResult.reason,
        playerCount: participants.length,
        allReady: participants.every(p => p.isReady)
      });
      
      if (autoStartResult.started) {
        // Auto-start was triggered, wait for it to complete
        setTimeout(async () => {
          // Get updated room state
          const [updatedRoom] = await db.select().from(gameRooms).where(eq(gameRooms.id, room.id));
          
          if (updatedRoom && updatedRoom.state === 'active') {
            // Broadcast game started event
            const gameStartEventId = uuidv4();
            const gameStartEvent = {
              type: 'game:started',
              eventId: gameStartEventId,
              code,
              gameState: updatedRoom.gameState,
              serverTs: Date.now()
            };
            
            this.broadcastToRoom(code, gameStartEvent);
            
            // Track ACKs for game:started
            const clientIds = Array.from(this.clients.values())
              .filter(c => c.roomCode === code)
              .map(c => c.id);
            
            const ackStats = await AckTracker.waitForAcks(
              gameStartEventId,
              'game:started',
              clientIds,
              3000
            );
            
            DebugLogger.log(context, 'room.ready.game_started_acks', ackStats);
          }
        }, 2500); // Wait slightly more than the 2s auto-start delay
      }
      
      // Log audit event
      await this.logAuditEvent(room.id, client.userId, 'ready_changed', { ready });
      
    } catch (error) {
      const classification = detectAndClassifyIssue(error, { context });
      DebugLogger.log(context, 'room.ready.error', { 
        error: error instanceof Error ? error.message : String(error),
        classification 
      });
      this.sendError(client, 'Failed to update ready state');
    }
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
    let broadcastCount = 0;
    this.clients.forEach(client => {
      if (client.roomCode === roomCode && client.id !== excludeClientId) {
        this.sendToClient(client, data);
        broadcastCount++;
      }
    });
    
    // Debug log for broadcasts
    if (data.type) {
      console.log(`[WebSocket] Broadcast ${data.type} to ${broadcastCount} clients in room ${roomCode}`);
    }
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
    
    // Use settings from room.settings if available, otherwise fall back to room fields
    const settings = room.settings || {};
    
    return {
      code: room.code,
      name: room.name || 'Unnamed Room',
      visibility: room.visibility || 'public',
      isLocked: room.visibility === 'private',
      hostName: host[0]?.userId || 'Unknown',
      hostHasCrown: true,
      playerCount: room.playerCount || 0,
      maxPlayers: settings.maxPlayers || room.maxPlayers || 4,
      rounds: settings.rounds || room.rounds || 9,
      betCoins: settings.betCoins || room.betAmount || 0,
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