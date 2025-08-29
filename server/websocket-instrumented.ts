import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import { gameRooms, gameParticipants, roomAuditLog } from '../shared/schema';
import { eq, and, lt, gte, sql } from 'drizzle-orm';
import { logger, LogContext, StateSnapshot, PROTOCOL_VERSION } from './debug-logger';

interface WSClient {
  id: string;
  ws: WebSocket;
  userId: string | null;
  roomCode: string | null;
  isAlive: boolean;
  subscribedToList: boolean;
  protocolVersion?: string;
  pendingAcks: Map<string, NodeJS.Timeout>;
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

// Idempotency tracking
const idempotencyKeys = new Map<string, any>();
const IDEMPOTENCY_TTL = 60000; // 1 minute

class InstrumentedWebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WSClient> = new Map();
  private roomSubscribers: Set<string> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private roomCodeRetries = new Map<string, number>();
  
  // ACK tracking
  private ackCallbacks = new Map<string, {
    clients: Set<string>;
    received: Set<string>;
    timeout: NodeJS.Timeout;
    resolve: () => void;
  }>();

  initialize(server: any) {
    const context = logger.createContext({ operation: 'websocket_init' });
    logger.info('websocket_server_initializing', {}, context);
    
    this.wss = new WebSocketServer({ server, path: '/ws-rooms' });
    
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const clientId = uuidv4();
      const connectionContext = logger.createContext({ 
        connectionId: clientId,
        operation: 'websocket_connect' 
      });
      
      logger.info('websocket_client_connected', { clientId }, connectionContext);
      
      const client: WSClient = {
        id: clientId,
        ws,
        userId: null,
        roomCode: null,
        isAlive: true,
        subscribedToList: false,
        pendingAcks: new Map()
      };
      
      this.clients.set(clientId, client);
      
      // Send connection acknowledgment with protocol version
      this.sendToClient(client, {
        type: 'connected',
        connectionId: clientId,
        serverTs: Date.now(),
        protocolVersion: PROTOCOL_VERSION
      }, connectionContext);
      
      ws.on('pong', () => {
        client.isAlive = true;
      });
      
      ws.on('message', async (data: Buffer) => {
        const messageContext = logger.createContext({
          connectionId: clientId,
          userId: client.userId,
          roomCode: client.roomCode
        });
        
        try {
          const message = JSON.parse(data.toString());
          
          // Check protocol version
          if (message.protocolVersion && message.protocolVersion !== PROTOCOL_VERSION) {
            logger.warn('protocol_version_mismatch', {
              clientVersion: message.protocolVersion,
              serverVersion: PROTOCOL_VERSION
            }, messageContext);
            
            this.sendError(client, 'Protocol version mismatch. Please refresh your browser.', messageContext);
            return;
          }
          
          logger.debug('websocket_message_received', {
            type: message.type,
            hasIdempotencyKey: !!message.idempotencyKey
          }, messageContext);
          
          // Handle acknowledgements
          if (message.type === 'ack') {
            this.handleAck(client, message, messageContext);
            return;
          }
          
          await this.handleMessage(client, message, messageContext);
        } catch (error) {
          logger.error('websocket_message_error', error, {}, messageContext);
          this.sendError(client, 'Invalid message format', messageContext);
        }
      });
      
      ws.on('close', () => {
        logger.info('websocket_client_disconnecting', { clientId }, connectionContext);
        this.handleDisconnect(client, connectionContext);
      });
      
      ws.on('error', (error) => {
        logger.error('websocket_connection_error', error, { clientId }, connectionContext);
      });
    });
    
    // Set up heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.wss?.clients.forEach((ws) => {
        const client = Array.from(this.clients.values()).find(c => c.ws === ws);
        if (client) {
          if (!client.isAlive) {
            logger.warn('websocket_client_unresponsive', { clientId: client.id });
            client.ws.terminate();
            this.handleDisconnect(client, logger.createContext({ connectionId: client.id }));
            return;
          }
          client.isAlive = false;
          ws.ping();
        }
      });
    }, 30000);
    
    logger.info('websocket_server_initialized', { path: '/ws-rooms' }, context);
  }
  
  private async handleMessage(client: WSClient, message: any, context: LogContext) {
    const { type, idempotencyKey, ...payload } = message;
    
    // Check idempotency
    if (idempotencyKey && idempotencyKeys.has(idempotencyKey)) {
      logger.info('idempotent_request_duplicate', { 
        idempotencyKey,
        originalResult: idempotencyKeys.get(idempotencyKey) 
      }, context);
      
      const cached = idempotencyKeys.get(idempotencyKey);
      this.sendToClient(client, cached, context);
      return;
    }
    
    const operationContext = {
      ...context,
      roomOperationId: logger.generateOperationId(),
      operation: type
    };
    
    logger.debug(`handler_entry_${type}`, { payload }, operationContext);
    
    let result: any;
    
    switch (type) {
      case 'auth':
        result = await this.handleAuth(client, payload, operationContext);
        break;
      case 'room:create':
        result = await this.handleRoomCreate(client, payload, operationContext);
        break;
      case 'room:join':
        result = await this.handleRoomJoin(client, payload, operationContext);
        break;
      case 'room:leave':
        result = await this.handleRoomLeave(client, payload, operationContext);
        break;
      case 'room:list:subscribe':
        result = await this.handleRoomListSubscribe(client, operationContext);
        break;
      case 'room:list:unsubscribe':
        result = await this.handleRoomListUnsubscribe(client, operationContext);
        break;
      case 'room:settings:update':
        result = await this.handleRoomSettingsUpdate(client, payload, operationContext);
        break;
      case 'room:ready:set':
        result = await this.handleReadySet(client, payload, operationContext);
        break;
      case 'game:start':
        result = await this.handleGameStart(client, payload, operationContext);
        break;
      case 'move:submit':
        result = await this.handleMoveSubmit(client, payload, operationContext);
        break;
      case 'session:ping':
        this.handlePing(client, payload, operationContext);
        break;
      default:
        logger.warn('unknown_message_type', { type }, operationContext);
        this.sendError(client, `Unknown message type: ${type}`, operationContext);
    }
    
    // Cache idempotent result
    if (idempotencyKey && result) {
      idempotencyKeys.set(idempotencyKey, result);
      setTimeout(() => idempotencyKeys.delete(idempotencyKey), IDEMPOTENCY_TTL);
    }
    
    logger.debug(`handler_exit_${type}`, { success: !!result }, operationContext);
  }
  
  private async handleAuth(client: WSClient, payload: { userId: string }, context: LogContext) {
    logger.validation('auth', payload, !!payload.userId, 
      !payload.userId ? 'Missing userId' : undefined, context);
    
    client.userId = payload.userId;
    client.protocolVersion = PROTOCOL_VERSION;
    
    const response = {
      type: 'authenticated',
      userId: payload.userId,
      serverTs: Date.now(),
      protocolVersion: PROTOCOL_VERSION
    };
    
    this.sendToClient(client, response, context);
    logger.info('client_authenticated', { userId: payload.userId }, context);
    
    return response;
  }
  
  private async handleRoomCreate(client: WSClient, payload: any, context: LogContext) {
    logger.debug('room_create_handler_entry', { payload }, context);
    
    if (!client.userId) {
      logger.warn('room_create_not_authenticated', {}, context);
      this.sendError(client, 'Not authenticated', context);
      return;
    }
    
    const { name, visibility, password, maxPlayers, rounds, betCoins } = payload;
    
    // Validation
    const validationErrors = [];
    if (maxPlayers && (maxPlayers < 2 || maxPlayers > 8)) {
      validationErrors.push('maxPlayers must be between 2 and 8');
    }
    if (rounds && (rounds < 1 || rounds > 18)) {
      validationErrors.push('rounds must be between 1 and 18');
    }
    if (betCoins && betCoins < 0) {
      validationErrors.push('betCoins must be non-negative');
    }
    
    logger.validation('room_create', payload, validationErrors.length === 0, validationErrors, context);
    
    if (validationErrors.length > 0) {
      this.sendError(client, validationErrors.join(', '), context);
      return;
    }
    
    let room: any;
    let retries = 0;
    
    logger.transactionStart('room_create', context);
    
    try {
      await db.transaction(async (tx) => {
        // Generate unique room code with retry
        let code: string;
        let isUnique = false;
        
        while (!isUnique && retries < 10) {
          code = this.generateRoomCode();
          const existing = await tx.select().from(gameRooms).where(eq(gameRooms.code, code));
          isUnique = existing.length === 0;
          if (!isUnique) {
            retries++;
            logger.warn('room_code_collision', { code, retries }, context);
          }
        }
        
        if (!isUnique) {
          throw new Error('Failed to generate unique room code');
        }
        
        logger.info('room_code_generated', { code: code!, retries }, context);
        
        // Create room
        const [createdRoom] = await tx.insert(gameRooms).values({
          code: code!,
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
        
        room = createdRoom;
        
        // Add creator as first participant
        await tx.insert(gameParticipants).values({
          gameRoomId: room.id,
          userId: client.userId,
          joinOrder: 1,
          playerIndex: 0,
          isHost: true,
          connected: true,
          connectionId: client.id,
          betPaid: betCoins || 0
        });
        
        logger.debug('room_created_in_transaction', { roomId: room.id, code: room.code }, context);
      });
      
      logger.transactionCommit('room_create', context);
      
      // Post-commit: Update client state
      client.roomCode = room.code;
      
      // Post-commit: Capture snapshot
      const snapshot = await this.captureRoomSnapshot(room.id, context);
      logger.snapshot('room_creation', snapshot, context);
      
      // Post-commit: Check listing invariants
      await this.checkListingInvariants(room, 'create', context);
      
      // Post-commit: Send response
      const roomCard = await this.getRoomCard(room);
      const response = {
        type: 'room:created',
        room: roomCard,
        serverTs: Date.now()
      };
      
      this.sendToClient(client, response, context);
      
      // Post-commit: Broadcast to list subscribers
      await this.broadcastRoomListUpdate('added', room, context);
      
      // Log audit event
      await this.logAuditEvent(room.id, client.userId, 'room_created', { 
        code: room.code, 
        name: room.name,
        retries 
      });
      
      logger.info('room_create_success', { 
        roomId: room.id, 
        code: room.code,
        retries 
      }, context);
      
      return response;
      
    } catch (error) {
      logger.transactionRollback('room_create', error, context);
      logger.error('room_create_failed', error, { partial: room }, context);
      this.sendError(client, 'Failed to create room', context);
      return null;
    }
  }
  
  private async handleRoomJoin(client: WSClient, payload: { code: string; password?: string }, context: LogContext) {
    logger.debug('room_join_handler_entry', { code: payload.code }, context);
    
    if (!client.userId) {
      logger.warn('room_join_not_authenticated', {}, context);
      this.sendError(client, 'Not authenticated', context);
      return;
    }
    
    const { code, password } = payload;
    
    logger.validation('room_join', { code, hasPassword: !!password }, !!code, 
      !code ? 'Missing room code' : undefined, context);
    
    logger.transactionStart('room_join', context);
    
    try {
      let updatedRoom: any;
      let joinOrder: number = 0;
      
      await db.transaction(async (tx) => {
        // Find room
        const [room] = await tx.select().from(gameRooms).where(eq(gameRooms.code, code));
        
        if (!room) {
          throw new Error('Room not found');
        }
        
        context.roomId = room.id;
        context.roomCode = code;
        
        // Validation checks
        if (room.state !== 'waiting') {
          throw new Error('Room is not accepting new players');
        }
        
        if (room.playerCount >= room.maxPlayers!) {
          throw new Error('Room is full');
        }
        
        if (room.visibility === 'private' && room.passwordHash) {
          if (!password || !this.verifyPassword(password, room.passwordHash)) {
            throw new Error('Invalid password');
          }
        }
        
        // Check if already in room
        const existing = await tx.select().from(gameParticipants)
          .where(and(
            eq(gameParticipants.gameRoomId, room.id),
            eq(gameParticipants.userId, client.userId!)
          ));
        
        if (existing.length > 0) {
          throw new Error('Already in room');
        }
        
        // Add participant
        joinOrder = room.playerCount + 1;
        await tx.insert(gameParticipants).values({
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
        await tx.update(gameRooms)
          .set({ 
            playerCount: room.playerCount + 1,
            updatedAt: new Date(),
            lastActivityAt: new Date()
          })
          .where(eq(gameRooms.id, room.id));
        
        updatedRoom = { ...room, playerCount: room.playerCount + 1 };
        
        logger.debug('player_joined_in_transaction', { 
          roomId: room.id, 
          joinOrder 
        }, context);
      });
      
      logger.transactionCommit('room_join', context);
      
      // Post-commit: Update client state
      client.roomCode = code;
      
      // Post-commit: Check listing invariants
      await this.checkListingInvariants(updatedRoom, 'join', context);
      
      // Post-commit: Send join confirmation
      const response = {
        type: 'player:joined',
        code,
        player: {
          id: client.userId,
          joinOrder
        },
        serverTs: Date.now()
      };
      
      this.sendToClient(client, response, context);
      
      // Post-commit: Broadcast to room members
      this.broadcastToRoom(code, response, client.id, context);
      
      // Post-commit: Update room list
      if (updatedRoom.playerCount >= updatedRoom.maxPlayers!) {
        await this.broadcastRoomListUpdate('removed', updatedRoom, context);
      } else {
        await this.broadcastRoomListUpdate('updated', updatedRoom, context);
      }
      
      // Log audit event
      await this.logAuditEvent(updatedRoom.id, client.userId, 'player_joined', { code });
      
      logger.info('room_join_success', { 
        roomId: updatedRoom.id, 
        code,
        joinOrder 
      }, context);
      
      return response;
      
    } catch (error: any) {
      logger.transactionRollback('room_join', error, context);
      logger.error('room_join_failed', error, {}, context);
      this.sendError(client, error.message || 'Failed to join room', context);
      return null;
    }
  }
  
  private async handleRoomLeave(client: WSClient, payload: { code: string }, context: LogContext) {
    logger.debug('room_leave_handler_entry', { code: payload.code }, context);
    
    if (!client.userId) {
      return;
    }
    
    const { code } = payload;
    
    logger.transactionStart('room_leave', context);
    
    try {
      let room: any;
      let needsHostMigration = false;
      let shouldDelete = false;
      
      await db.transaction(async (tx) => {
        // Find room and participant
        [room] = await tx.select().from(gameRooms).where(eq(gameRooms.code, code));
        
        if (!room) {
          throw new Error('Room not found');
        }
        
        context.roomId = room.id;
        context.roomCode = code;
        
        const [participant] = await tx.select().from(gameParticipants)
          .where(and(
            eq(gameParticipants.gameRoomId, room.id),
            eq(gameParticipants.userId, client.userId)
          ));
        
        if (!participant) {
          throw new Error('Not in room');
        }
        
        // Mark as left
        await tx.update(gameParticipants)
          .set({ 
            connected: false,
            leftAt: new Date(),
            disconnectedAt: new Date(),
            canRejoinUntil: new Date(Date.now() + 60000) // 1 minute rejoin window
          })
          .where(eq(gameParticipants.id, participant.id));
        
        // Update room player count
        const newPlayerCount = room.playerCount - 1;
        
        if (newPlayerCount === 0) {
          // Delete empty room
          shouldDelete = true;
          await tx.delete(gameRooms).where(eq(gameRooms.id, room.id));
          logger.decision('room_purge', 'delete', 'playerCount == 0', { roomId: room.id }, context);
        } else {
          await tx.update(gameRooms)
            .set({ 
              playerCount: newPlayerCount,
              updatedAt: new Date(),
              lastActivityAt: new Date()
            })
            .where(eq(gameRooms.id, room.id));
          
          room.playerCount = newPlayerCount;
          needsHostMigration = participant.isHost;
        }
        
        logger.debug('player_left_in_transaction', { 
          roomId: room.id,
          newPlayerCount,
          needsHostMigration,
          shouldDelete 
        }, context);
      });
      
      logger.transactionCommit('room_leave', context);
      
      // Post-commit: Clear client room
      client.roomCode = null;
      
      if (shouldDelete) {
        // Post-commit: Broadcast room deleted with ACK tracking
        await this.broadcastToRoomWithAck(code, {
          type: 'room:deleted',
          code,
          serverTs: Date.now()
        }, 'room_deleted', context);
        
        await this.broadcastRoomListUpdate('removed', room, context);
        
        logger.info('room_deleted', { roomId: room.id, code }, context);
      } else {
        // Post-commit: Handle host migration if needed
        if (needsHostMigration) {
          await this.migrateHost(room.id, client.userId, context);
        }
        
        // Post-commit: Check listing invariants
        await this.checkListingInvariants(room, 'leave', context);
        
        // Post-commit: Broadcast player left
        this.broadcastToRoom(code, {
          type: 'player:left',
          code,
          playerId: client.userId,
          serverTs: Date.now()
        }, client.id, context);
        
        // Post-commit: Update room list
        if (room.playerCount === room.maxPlayers! - 1) {
          // Room was full, now has space
          await this.broadcastRoomListUpdate('added', room, context);
        } else {
          await this.broadcastRoomListUpdate('updated', room, context);
        }
      }
      
      // Log audit event
      await this.logAuditEvent(room.id, client.userId, 'player_left', { code });
      
      logger.info('room_leave_success', { 
        roomId: room.id,
        code,
        deleted: shouldDelete 
      }, context);
      
    } catch (error: any) {
      logger.transactionRollback('room_leave', error, context);
      logger.error('room_leave_failed', error, {}, context);
    }
  }
  
  private async handleRoomListSubscribe(client: WSClient, context: LogContext) {
    logger.debug('room_list_subscribe_entry', {}, context);
    
    client.subscribedToList = true;
    this.roomSubscribers.add(client.id);
    
    // Send current room list snapshot
    const rooms = await this.getPublicRooms();
    const response = {
      type: 'room:list:snapshot',
      rooms,
      serverTs: Date.now()
    };
    
    this.sendToClient(client, response, context);
    
    logger.info('room_list_subscribed', { 
      clientId: client.id,
      roomCount: rooms.length 
    }, context);
    
    return response;
  }
  
  private handleRoomListUnsubscribe(client: WSClient, context: LogContext) {
    logger.debug('room_list_unsubscribe_entry', {}, context);
    
    client.subscribedToList = false;
    this.roomSubscribers.delete(client.id);
    
    logger.info('room_list_unsubscribed', { clientId: client.id }, context);
    
    return { type: 'room:list:unsubscribed' };
  }
  
  private async handleRoomSettingsUpdate(client: WSClient, payload: any, context: LogContext) {
    logger.debug('room_settings_update_entry', { payload }, context);
    
    if (!client.userId || !client.roomCode) {
      logger.warn('settings_update_invalid_state', {}, context);
      this.sendError(client, 'Not in a room', context);
      return;
    }
    
    logger.transactionStart('room_settings_update', context);
    
    try {
      let room: any;
      
      await db.transaction(async (tx) => {
        // Verify host status
        const [participant] = await tx.select().from(gameParticipants)
          .innerJoin(gameRooms, eq(gameParticipants.gameRoomId, gameRooms.id))
          .where(and(
            eq(gameRooms.code, client.roomCode!),
            eq(gameParticipants.userId, client.userId),
            eq(gameParticipants.isHost, true)
          ));
        
        if (!participant) {
          throw new Error('Only host can update settings');
        }
        
        room = participant.game_rooms;
        
        // Update settings
        const updates: any = {};
        if (payload.name !== undefined) updates.name = payload.name;
        if (payload.visibility !== undefined) updates.visibility = payload.visibility;
        if (payload.password !== undefined) {
          updates.passwordHash = payload.password ? this.hashPassword(payload.password) : null;
        }
        if (payload.maxPlayers !== undefined) updates.maxPlayers = payload.maxPlayers;
        if (payload.rounds !== undefined) updates.rounds = payload.rounds;
        if (payload.betCoins !== undefined) updates.betAmount = payload.betCoins;
        
        updates.updatedAt = new Date();
        updates.settings = {
          ...room.settings,
          ...payload
        };
        
        await tx.update(gameRooms)
          .set(updates)
          .where(eq(gameRooms.id, room.id));
        
        logger.debug('settings_updated_in_transaction', { 
          roomId: room.id,
          updates 
        }, context);
      });
      
      logger.transactionCommit('room_settings_update', context);
      
      // Post-commit: Check listing invariants
      await this.checkListingInvariants(room, 'settings_update', context);
      
      // Post-commit: Broadcast settings update
      const response = {
        type: 'settings:updated',
        code: client.roomCode,
        settings: payload,
        serverTs: Date.now()
      };
      
      this.broadcastToRoom(client.roomCode, response, null, context);
      
      // Log audit event
      await this.logAuditEvent(room.id, client.userId, 'settings_change', payload);
      
      logger.info('room_settings_updated', { 
        roomId: room.id,
        changes: payload 
      }, context);
      
      return response;
      
    } catch (error: any) {
      logger.transactionRollback('room_settings_update', error, context);
      logger.error('room_settings_update_failed', error, {}, context);
      this.sendError(client, error.message || 'Failed to update settings', context);
      return null;
    }
  }
  
  private async handleReadySet(client: WSClient, payload: { code: string; ready: boolean }, context: LogContext) {
    logger.debug('ready_set_handler_entry', { 
      code: payload.code,
      ready: payload.ready 
    }, context);
    
    if (!client.userId) {
      return;
    }
    
    logger.transactionStart('ready_set', context);
    
    try {
      let room: any;
      let allReady = false;
      let shouldAutoStart = false;
      
      await db.transaction(async (tx) => {
        // Update ready state
        await tx.update(gameParticipants)
          .set({ 
            isReady: payload.ready,
            lastSeenAt: new Date()
          })
          .where(and(
            eq(gameParticipants.userId, client.userId),
            eq(gameParticipants.connected, true)
          ));
        
        // Check if all ready
        [room] = await tx.select().from(gameRooms).where(eq(gameRooms.code, payload.code));
        
        if (!room || room.state !== 'waiting') {
          throw new Error('Invalid room state');
        }
        
        context.roomId = room.id;
        context.roomCode = payload.code;
        
        const participants = await tx.select().from(gameParticipants)
          .where(and(
            eq(gameParticipants.gameRoomId, room.id),
            eq(gameParticipants.connected, true)
          ));
        
        const connectedCount = participants.length;
        const readyCount = participants.filter(p => p.isReady).length;
        
        allReady = connectedCount >= 2 && connectedCount === readyCount;
        
        logger.debug('ready_state_evaluation', {
          connectedCount,
          readyCount,
          allReady,
          minPlayers: 2
        }, context);
        
        if (allReady) {
          // Auto-start game
          shouldAutoStart = true;
          await tx.update(gameRooms)
            .set({ 
              state: 'active',
              gameStartedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(gameRooms.id, room.id));
          
          logger.decision('auto_start', 'start', 'all players ready', {
            roomId: room.id,
            playerCount: connectedCount,
            readyCount
          }, context);
        }
      });
      
      logger.transactionCommit('ready_set', context);
      
      // Post-commit: Broadcast ready state
      const readyResponse = {
        type: 'player:ready',
        code: payload.code,
        playerId: client.userId,
        ready: payload.ready,
        serverTs: Date.now()
      };
      
      this.broadcastToRoom(payload.code, readyResponse, null, context);
      
      // Post-commit: Handle auto-start
      if (shouldAutoStart) {
        const snapshot = await this.captureRoomSnapshot(room.id, context);
        logger.snapshot('auto_start', snapshot, context);
        
        await this.initializeGame(room, context);
        
        // Broadcast game started with ACK tracking
        await this.broadcastToRoomWithAck(payload.code, {
          type: 'game:started',
          code: payload.code,
          serverTs: Date.now(),
          rngSeed: this.generateRNGSeed(),
          currentTurnId: uuidv4()
        }, 'game_started', context);
        
        // Update room list
        await this.broadcastRoomListUpdate('removed', room, context);
        
        logger.info('game_auto_started', { 
          roomId: room.id,
          code: payload.code 
        }, context);
      }
      
      logger.info('ready_set_success', { 
        roomId: room.id,
        ready: payload.ready,
        autoStarted: shouldAutoStart 
      }, context);
      
      return readyResponse;
      
    } catch (error: any) {
      logger.transactionRollback('ready_set', error, context);
      logger.error('ready_set_failed', error, {}, context);
      this.sendError(client, 'Failed to update ready state', context);
      return null;
    }
  }
  
  private async handleGameStart(client: WSClient, payload: { code: string }, context: LogContext) {
    logger.debug('game_start_handler_entry', { code: payload.code }, context);
    
    // Implementation would follow similar pattern
    // This is a manual start by host (vs auto-start)
    
    logger.warn('game_start_not_implemented', {}, context);
    return null;
  }
  
  private async handleMoveSubmit(client: WSClient, payload: any, context: LogContext) {
    logger.debug('move_submit_handler_entry', { move: payload.move }, context);
    
    // Validate move and log rejection reasons
    const validationResult = this.validateMove(payload.move, context);
    
    if (!validationResult.valid) {
      logger.warn('move_rejected', {
        reason: validationResult.reason,
        move: payload.move
      }, context);
      
      this.sendError(client, `Move rejected: ${validationResult.reason}`, context);
      return null;
    }
    
    // Process move...
    logger.info('move_accepted', { move: payload.move }, context);
    
    return { type: 'move:accepted', move: payload.move };
  }
  
  private validateMove(move: any, context: LogContext): { valid: boolean; reason?: string } {
    // Placeholder validation
    if (!move) {
      return { valid: false, reason: 'No move provided' };
    }
    
    // Add actual move validation logic here
    
    return { valid: true };
  }
  
  private handlePing(client: WSClient, payload: { ts: number }, context: LogContext) {
    this.sendToClient(client, {
      type: 'session:pong',
      clientTs: payload.ts,
      serverTs: Date.now()
    }, context);
  }
  
  private handleAck(client: WSClient, message: any, context: LogContext) {
    const { eventId } = message;
    
    if (this.ackCallbacks.has(eventId)) {
      const ackData = this.ackCallbacks.get(eventId)!;
      ackData.received.add(client.id);
      
      logger.ackReceived(eventId, client.id, context);
      
      // Check if quorum reached
      if (ackData.received.size >= Math.ceil(ackData.clients.size * 0.5)) {
        clearTimeout(ackData.timeout);
        ackData.resolve();
        this.ackCallbacks.delete(eventId);
      }
    }
  }
  
  private async handleDisconnect(client: WSClient, context: LogContext) {
    logger.info('websocket_client_disconnected', { 
      clientId: client.id,
      hadRoom: !!client.roomCode 
    }, context);
    
    // Handle room leave if in a room
    if (client.roomCode && client.userId) {
      // Mark as disconnected but allow rejoin window
      try {
        await db.update(gameParticipants)
          .set({
            connected: false,
            disconnectedAt: new Date(),
            canRejoinUntil: new Date(Date.now() + 60000) // 1 minute window
          })
          .where(and(
            eq(gameParticipants.userId, client.userId),
            eq(gameParticipants.connectionId, client.id)
          ));
        
        // Broadcast disconnect
        this.broadcastToRoom(client.roomCode, {
          type: 'player:disconnected',
          code: client.roomCode,
          playerId: client.userId,
          canRejoinUntil: Date.now() + 60000,
          serverTs: Date.now()
        }, client.id, context);
        
        logger.info('player_disconnected_with_rejoin', {
          roomCode: client.roomCode,
          userId: client.userId,
          rejoinWindow: 60000
        }, context);
        
      } catch (error) {
        logger.error('disconnect_handler_error', error, {}, context);
      }
    }
    
    // Remove from subscribers
    this.roomSubscribers.delete(client.id);
    
    // Clear pending ACKs
    client.pendingAcks.forEach(timeout => clearTimeout(timeout));
    
    // Remove client
    this.clients.delete(client.id);
  }
  
  private sendToClient(client: WSClient, data: any, context?: LogContext) {
    if (client.ws.readyState === WebSocket.OPEN) {
      const message = {
        ...data,
        protocolVersion: PROTOCOL_VERSION
      };
      
      client.ws.send(JSON.stringify(message));
      
      if (context) {
        logger.emit(data.type || 'unknown', [client.id], data, context);
      }
    }
  }
  
  private sendError(client: WSClient, message: string, context?: LogContext) {
    const errorMessage = {
      type: 'error',
      message,
      context,
      serverTs: Date.now()
    };
    
    this.sendToClient(client, errorMessage, context);
    
    if (context) {
      logger.warn('error_sent_to_client', { message }, context);
    }
  }
  
  private broadcastToRoom(roomCode: string, data: any, excludeClientId?: string | null, context?: LogContext) {
    const recipients: string[] = [];
    
    this.clients.forEach(client => {
      if (client.roomCode === roomCode && client.id !== excludeClientId) {
        this.sendToClient(client, data);
        recipients.push(client.id);
      }
    });
    
    if (context) {
      logger.emit(`broadcast_${data.type}`, recipients, data, context);
    }
  }
  
  private async broadcastToRoomWithAck(
    roomCode: string, 
    data: any, 
    eventName: string,
    context: LogContext
  ): Promise<void> {
    const eventId = uuidv4();
    const clients = new Set<string>();
    
    // Collect clients
    this.clients.forEach(client => {
      if (client.roomCode === roomCode) {
        clients.add(client.id);
      }
    });
    
    if (clients.size === 0) {
      return;
    }
    
    // Send with ACK request
    const messageWithAck = {
      ...data,
      requiresAck: true,
      eventId
    };
    
    return new Promise((resolve) => {
      // Set up ACK tracking
      const timeout = setTimeout(() => {
        const ackData = this.ackCallbacks.get(eventId);
        if (ackData) {
          const missing = Array.from(clients).filter(id => !ackData.received.has(id));
          logger.ackQuorum(eventName, clients.size, ackData.received.size, missing, context);
          this.ackCallbacks.delete(eventId);
        }
        resolve();
      }, 5000); // 5 second timeout
      
      this.ackCallbacks.set(eventId, {
        clients,
        received: new Set(),
        timeout,
        resolve
      });
      
      // Broadcast
      this.broadcastToRoom(roomCode, messageWithAck, undefined, context);
    });
  }
  
  private async broadcastRoomListUpdate(
    action: 'added' | 'updated' | 'removed', 
    room: any,
    context: LogContext
  ) {
    const roomCard = action === 'removed' ? null : await this.getRoomCard(room);
    
    const diff = {
      type: 'room:list:diff',
      [action]: action === 'removed' ? [room.code] : [roomCard],
      serverTs: Date.now()
    };
    
    const recipients: string[] = [];
    
    this.roomSubscribers.forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client) {
        this.sendToClient(client, diff);
        recipients.push(clientId);
      }
    });
    
    logger.emit('room_list_diff', recipients, diff, context);
    logger.info('room_list_updated', {
      action,
      roomCode: room.code,
      subscriberCount: recipients.length
    }, context);
  }
  
  private async checkListingInvariants(room: any, operation: string, context: LogContext) {
    // Invariant: Public + waiting + not full => should be listed
    const shouldBeListed = 
      room.visibility === 'public' && 
      room.state === 'waiting' && 
      room.playerCount < room.maxPlayers;
    
    logger.decision('listing_invariant', shouldBeListed ? 'list' : 'delist', 
      `visibility=${room.visibility}, state=${room.state}, players=${room.playerCount}/${room.maxPlayers}`,
      { roomId: room.id, operation }, context);
    
    // Assert invariants
    logger.assertInvariant('player_count_valid', 
      room.playerCount >= 0 && room.playerCount <= room.maxPlayers,
      { playerCount: room.playerCount, maxPlayers: room.maxPlayers }, context);
    
    logger.assertInvariant('room_state_valid',
      ['waiting', 'active', 'finished'].includes(room.state),
      { state: room.state }, context);
    
    return shouldBeListed;
  }
  
  private async captureRoomSnapshot(roomId: string, context: LogContext): Promise<StateSnapshot> {
    const [room] = await db.select().from(gameRooms).where(eq(gameRooms.id, roomId));
    const participants = await db.select().from(gameParticipants)
      .where(eq(gameParticipants.gameRoomId, roomId));
    
    return {
      roomId: room.id,
      code: room.code,
      state: room.state,
      playerCount: room.playerCount,
      maxPlayers: room.maxPlayers!,
      visibility: room.visibility!,
      hostId: room.hostId,
      players: participants.map(p => ({
        id: p.userId,
        ready: p.isReady || false,
        connected: p.connected || false,
        joinOrder: p.joinOrder || 0
      })),
      rounds: room.rounds!,
      bet: room.betAmount!,
      serverTs: Date.now(),
      protocolVersion: PROTOCOL_VERSION
    };
  }
  
  private async initializeGame(room: any, context: LogContext) {
    const rngSeed = this.generateRNGSeed();
    const currentTurnId = uuidv4();
    
    logger.info('game_initialization', {
      roomId: room.id,
      rngSeed,
      currentTurnId
    }, context);
    
    // Initialize game state...
    // This would set up the actual game
    
    return { rngSeed, currentTurnId };
  }
  
  private async getRoomCard(room: any): Promise<RoomCard> {
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
        sql`${gameRooms.playerCount} < ${gameRooms.maxPlayers}`
      ));
    
    const roomCards = await Promise.all(rooms.map(room => this.getRoomCard(room)));
    return roomCards;
  }
  
  private async migrateHost(roomId: string, oldHostId: string, context: LogContext) {
    logger.info('host_migration_starting', { roomId, oldHostId }, context);
    
    logger.transactionStart('host_migration', context);
    
    try {
      let newHost: any;
      
      await db.transaction(async (tx) => {
        // Get next player by join order
        const participants = await tx.select().from(gameParticipants)
          .where(and(
            eq(gameParticipants.gameRoomId, roomId),
            eq(gameParticipants.connected, true)
          ))
          .orderBy(gameParticipants.joinOrder);
        
        if (participants.length === 0) {
          throw new Error('No connected players for host migration');
        }
        
        newHost = participants[0];
        
        // Update old host
        await tx.update(gameParticipants)
          .set({ isHost: false })
          .where(and(
            eq(gameParticipants.gameRoomId, roomId),
            eq(gameParticipants.userId, oldHostId)
          ));
        
        // Update new host
        await tx.update(gameParticipants)
          .set({ isHost: true })
          .where(eq(gameParticipants.id, newHost.id));
        
        // Update room
        await tx.update(gameRooms)
          .set({ 
            hostId: newHost.userId,
            crownHolderId: newHost.userId,
            updatedAt: new Date()
          })
          .where(eq(gameRooms.id, roomId));
      });
      
      logger.transactionCommit('host_migration', context);
      
      // Post-commit: Get room for broadcast
      const [room] = await db.select().from(gameRooms).where(eq(gameRooms.id, roomId));
      
      if (room) {
        // Broadcast host change with ACK
        await this.broadcastToRoomWithAck(room.code, {
          type: 'host:changed',
          code: room.code,
          hostId: newHost.userId,
          serverTs: Date.now()
        }, 'host_changed', context);
      }
      
      // Log audit event
      await this.logAuditEvent(roomId, newHost.userId, 'host_transfer', { 
        oldHostId, 
        newHostId: newHost.userId 
      });
      
      logger.info('host_migration_complete', {
        roomId,
        oldHostId,
        newHostId: newHost.userId
      }, context);
      
    } catch (error) {
      logger.transactionRollback('host_migration', error, context);
      logger.error('host_migration_failed', error, {}, context);
    }
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
      logger.error('audit_log_failed', error, { roomId, type });
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
  
  private generateRNGSeed(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
  
  private hashPassword(password: string): string {
    // Simple hash for demo - in production use bcrypt
    return Buffer.from(password).toString('base64');
  }
  
  private verifyPassword(password: string, hash: string): boolean {
    return Buffer.from(password).toString('base64') === hash;
  }
  
  shutdown() {
    logger.info('websocket_server_shutting_down', {
      clientCount: this.clients.size,
      subscriberCount: this.roomSubscribers.size
    });
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Clear all ACK callbacks
    this.ackCallbacks.forEach(ack => clearTimeout(ack.timeout));
    this.ackCallbacks.clear();
    
    // Close all connections
    this.clients.forEach(client => {
      client.ws.close();
    });
    
    this.wss?.close();
    
    logger.info('websocket_server_shutdown_complete', {});
  }
}

export const instrumentedWsManager = new InstrumentedWebSocketManager();