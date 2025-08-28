import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import type { Express } from 'express';
import type { IStorage } from './storage';

// WebSocket connection state
interface WSConnection {
  ws: WebSocket;
  userId: string;
  connectionId: string;
  gameRoomId?: string;
  isSpectator?: boolean;
  lastPing?: number;
  isAuthenticated: boolean;
}

// Room state management
interface RoomState {
  participants: Map<string, ParticipantState>;
  spectators: Set<string>;
  gameState: AuthoritativeGameState | null;
  lastActivityAt: number;
  hostId: string;
  crownHolderId: string;
  settings: RoomSettings;
  status: 'waiting' | 'active' | 'finished';
  isPublished: boolean;
  isPrivate: boolean;
  password?: string;
}

interface ParticipantState {
  userId: string;
  playerIndex: number;
  isReady: boolean;
  isConnected: boolean;
  connectionId?: string;
  disconnectedAt?: number;
  isAI: boolean;
}

interface RoomSettings {
  rounds: 5 | 9;
  maxPlayers: 2 | 3 | 4;
  betAmount: number;
  isPrivate: boolean;
}

// Authoritative game state
interface AuthoritativeGameState {
  currentTurn: number;
  currentPlayer: string;
  turnStartTime: number;
  turnTimeLimit: number;
  gameStartTime: number;
  rounds: number;
  currentRound: number;
  deck: string[];
  discardPile: string[];
  playerStates: Map<string, PlayerGameState>;
  lastAction: GameAction | null;
  lastActionTimestamp: number;
}

interface PlayerGameState {
  userId: string;
  hand: string[];
  score: number;
  hasPeeked: boolean;
  turnActions: number;
}

interface GameAction {
  type: string;
  playerId: string;
  data: any;
  timestamp: number;
  sequenceNumber: number;
}

// Rate limiting
class RateLimiter {
  private requests = new Map<string, number[]>();
  private readonly maxRequests = 100;
  private readonly windowMs = 60000; // 1 minute

  check(userId: string): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    
    // Remove old requests outside window
    const validRequests = userRequests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(userId, validRequests);
    return true;
  }
}

export class MultiplayerWebSocketHandler {
  private wss: WebSocketServer;
  private connections = new Map<string, WSConnection>();
  private rooms = new Map<string, RoomState>();
  private rateLimiter = new RateLimiter();
  private pingInterval: NodeJS.Timeout;
  
  constructor(
    private app: Express,
    private storage: IStorage,
    private httpServer: ReturnType<typeof createServer>
  ) {
    this.wss = new WebSocketServer({ server: httpServer, path: '/ws' });
    this.setupWebSocketServer();
    this.startPingInterval();
    this.startIdleCheckInterval();
  }
  
  private setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      console.log('🔌 New WebSocket connection');
      
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error) {
          console.error('❌ WebSocket message error:', error);
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Invalid message format',
            timestamp: Date.now()
          }));
        }
      });
      
      ws.on('close', () => {
        this.handleDisconnection(ws);
      });
      
      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        this.handleDisconnection(ws);
      });
      
      ws.on('pong', () => {
        const connection = this.findConnection(ws);
        if (connection) {
          connection.lastPing = Date.now();
        }
      });
    });
  }
  
  private async handleMessage(ws: WebSocket, message: any) {
    const { type, ...data } = message;
    
    // Handle authentication first
    if (type === 'authenticate') {
      return this.handleAuthentication(ws, data);
    }
    
    // All other messages require authentication
    const connection = this.findConnection(ws);
    if (!connection?.isAuthenticated) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Not authenticated',
        timestamp: Date.now()
      }));
      return;
    }
    
    // Rate limiting
    if (!this.rateLimiter.check(connection.userId)) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Rate limit exceeded',
        timestamp: Date.now()
      }));
      return;
    }
    
    // Route message to appropriate handler
    switch (type) {
      case 'create_room':
        await this.handleCreateRoom(connection, data);
        break;
      case 'join_room':
        await this.handleJoinRoom(connection, data);
        break;
      case 'leave_room':
        await this.handleLeaveRoom(connection);
        break;
      case 'update_room_settings':
        await this.handleUpdateRoomSettings(connection, data);
        break;
      case 'ready_toggle':
        await this.handleReadyToggle(connection, data);
        break;
      case 'start_game':
        await this.handleStartGame(connection);
        break;
      case 'game_action':
        await this.handleGameAction(connection, data);
        break;
      case 'transfer_crown':
        await this.handleTransferCrown(connection, data);
        break;
      case 'chat_message':
        await this.handleChatMessage(connection, data);
        break;
      case 'rejoin_room':
        await this.handleRejoinRoom(connection, data);
        break;
      default:
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Unknown message type',
          timestamp: Date.now()
        }));
    }
  }
  
  private async handleAuthentication(ws: WebSocket, data: any) {
    const { userId } = data;
    
    if (!userId) {
      ws.send(JSON.stringify({ 
        type: 'auth_error', 
        message: 'User ID required',
        timestamp: Date.now()
      }));
      return;
    }
    
    try {
      const user = await this.storage.getUser(userId);
      if (!user) {
        ws.send(JSON.stringify({ 
          type: 'auth_error', 
          message: 'User not found',
          timestamp: Date.now()
        }));
        return;
      }
      
      const connectionId = this.generateConnectionId();
      const connection: WSConnection = {
        ws,
        userId,
        connectionId,
        isAuthenticated: true,
        lastPing: Date.now()
      };
      
      this.connections.set(connectionId, connection);
      
      ws.send(JSON.stringify({ 
        type: 'authenticated',
        connectionId,
        user,
        serverTime: Date.now()
      }));
      
      // Send current lobby list
      await this.sendLobbyList(connection);
      
    } catch (error) {
      console.error('Authentication error:', error);
      ws.send(JSON.stringify({ 
        type: 'auth_error', 
        message: 'Authentication failed',
        timestamp: Date.now()
      }));
    }
  }
  
  private async handleCreateRoom(connection: WSConnection, data: any) {
    const { rounds = 9, maxPlayers = 4, betAmount = 0, isPrivate = false, password } = data;
    
    try {
      // Create room in database
      const roomCode = this.generateRoomCode();
      const room = await this.storage.createGameRoom({
        code: roomCode,
        hostId: connection.userId,
        crownHolderId: connection.userId,
        rounds,
        maxPlayers,
        betAmount,
        isPrivate,
        password: isPrivate ? password : undefined,
        settings: { rounds, maxPlayers, betAmount },
        players: [],
        status: 'waiting',
        isPublished: !isPrivate,
        settingsLocked: false
      });
      
      // Create room state
      const roomState: RoomState = {
        participants: new Map(),
        spectators: new Set(),
        gameState: null,
        lastActivityAt: Date.now(),
        hostId: connection.userId,
        crownHolderId: connection.userId,
        settings: { rounds, maxPlayers, betAmount, isPrivate },
        status: 'waiting',
        isPublished: !isPrivate,
        isPrivate,
        password
      };
      
      this.rooms.set(room.id, roomState);
      
      // Join creator to room
      await this.joinRoomInternal(connection, room.id, roomCode);
      
      // Broadcast lobby update if public
      if (!isPrivate) {
        await this.broadcastLobbyUpdate();
      }
      
    } catch (error) {
      console.error('Create room error:', error);
      connection.ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Failed to create room',
        timestamp: Date.now()
      }));
    }
  }
  
  private async handleJoinRoom(connection: WSConnection, data: any) {
    const { roomCode, password } = data;
    
    try {
      const room = await this.storage.getGameRoom(roomCode);
      if (!room) {
        connection.ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Room not found',
          timestamp: Date.now()
        }));
        return;
      }
      
      const roomState = this.rooms.get(room.id);
      if (!roomState) {
        // Restore room state from database
        await this.restoreRoomState(room.id);
      }
      
      // Check private room password
      if (room.isPrivate && room.password && room.password !== password) {
        connection.ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid password',
          timestamp: Date.now()
        }));
        return;
      }
      
      // Check room capacity
      if (roomState && roomState.participants.size >= roomState.settings.maxPlayers) {
        connection.ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Room is full',
          timestamp: Date.now()
        }));
        return;
      }
      
      // Check bet amount
      const user = await this.storage.getUser(connection.userId);
      if (user && user.currency < room.betAmount) {
        connection.ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Insufficient coins',
          timestamp: Date.now()
        }));
        return;
      }
      
      await this.joinRoomInternal(connection, room.id, roomCode);
      
      // Broadcast lobby update
      await this.broadcastLobbyUpdate();
      
    } catch (error) {
      console.error('Join room error:', error);
      connection.ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Failed to join room',
        timestamp: Date.now()
      }));
    }
  }
  
  private async joinRoomInternal(connection: WSConnection, roomId: string, roomCode: string) {
    const roomState = this.rooms.get(roomId);
    if (!roomState) return;
    
    // Add participant
    const playerIndex = roomState.participants.size;
    const participant: ParticipantState = {
      userId: connection.userId,
      playerIndex,
      isReady: false,
      isConnected: true,
      connectionId: connection.connectionId,
      isAI: false
    };
    
    roomState.participants.set(connection.userId, participant);
    connection.gameRoomId = roomId;
    
    // Save to database
    await this.storage.joinGameRoom(roomId, connection.userId, 0);
    
    // Get user info
    const user = await this.storage.getUser(connection.userId);
    const playerName = user?.firstName || user?.email?.split('@')[0] || 'Player';
    
    // Send room state to joining player
    connection.ws.send(JSON.stringify({
      type: 'room_joined',
      roomCode,
      roomId,
      roomState: this.serializeRoomState(roomState),
      serverTime: Date.now()
    }));
    
    // Broadcast to other players
    await this.broadcastToRoom(roomId, {
      type: 'player_joined',
      userId: connection.userId,
      playerName,
      playerIndex,
      timestamp: Date.now()
    }, connection.userId);
  }
  
  private async handleLeaveRoom(connection: WSConnection) {
    if (!connection.gameRoomId) return;
    
    const roomState = this.rooms.get(connection.gameRoomId);
    if (!roomState) return;
    
    const roomId = connection.gameRoomId;
    const wasHost = roomState.crownHolderId === connection.userId;
    
    // Remove participant
    roomState.participants.delete(connection.userId);
    connection.gameRoomId = undefined;
    
    // Update database
    await this.storage.leaveGameRoom(roomId, connection.userId);
    
    // If room is empty, delete it
    if (roomState.participants.size === 0) {
      this.rooms.delete(roomId);
      await this.storage.deleteGameRoom(roomId);
    } else if (wasHost) {
      // Host migration
      const newHost = Array.from(roomState.participants.values())[0];
      if (newHost) {
        roomState.crownHolderId = newHost.userId;
        roomState.hostId = newHost.userId;
        
        await this.storage.updateGameRoom(roomId, {
          crownHolderId: newHost.userId,
          hostId: newHost.userId
        });
        
        await this.broadcastToRoom(roomId, {
          type: 'host_changed',
          newHostId: newHost.userId,
          timestamp: Date.now()
        });
      }
    }
    
    // Broadcast player left
    await this.broadcastToRoom(roomId, {
      type: 'player_left',
      userId: connection.userId,
      timestamp: Date.now()
    });
    
    // Update lobby list
    await this.broadcastLobbyUpdate();
  }
  
  private async handleUpdateRoomSettings(connection: WSConnection, data: any) {
    if (!connection.gameRoomId) return;
    
    const roomState = this.rooms.get(connection.gameRoomId);
    if (!roomState) return;
    
    // Only crown holder can update settings
    if (roomState.crownHolderId !== connection.userId) {
      connection.ws.send(JSON.stringify({
        type: 'error',
        message: 'Only the host can update settings',
        timestamp: Date.now()
      }));
      return;
    }
    
    // Can't change settings if game started
    if (roomState.status !== 'waiting' || roomState.settingsLocked) {
      connection.ws.send(JSON.stringify({
        type: 'error',
        message: 'Cannot change settings after game started',
        timestamp: Date.now()
      }));
      return;
    }
    
    const { rounds, maxPlayers, betAmount } = data;
    
    // Update settings
    if (rounds) roomState.settings.rounds = rounds;
    if (maxPlayers) roomState.settings.maxPlayers = maxPlayers;
    if (betAmount !== undefined) roomState.settings.betAmount = betAmount;
    
    // Update database
    await this.storage.updateGameRoom(connection.gameRoomId, {
      rounds,
      maxPlayers,
      betAmount,
      settings: roomState.settings
    });
    
    // Broadcast settings update
    await this.broadcastToRoom(connection.gameRoomId, {
      type: 'settings_updated',
      settings: roomState.settings,
      timestamp: Date.now()
    });
    
    // Update lobby list
    await this.broadcastLobbyUpdate();
  }
  
  private async handleReadyToggle(connection: WSConnection, data: any) {
    if (!connection.gameRoomId) return;
    
    const roomState = this.rooms.get(connection.gameRoomId);
    if (!roomState) return;
    
    const participant = roomState.participants.get(connection.userId);
    if (!participant) return;
    
    const { isReady } = data;
    participant.isReady = isReady;
    
    // Update database
    await this.storage.updateParticipantReady(connection.gameRoomId, connection.userId, isReady);
    
    // Check if all ready
    const allReady = roomState.participants.size >= 2 && 
      Array.from(roomState.participants.values()).every(p => p.isReady);
    
    // Broadcast ready state
    await this.broadcastToRoom(connection.gameRoomId, {
      type: 'player_ready_changed',
      userId: connection.userId,
      isReady,
      allReady,
      timestamp: Date.now()
    });
    
    // Auto-start if all ready
    if (allReady && roomState.status === 'waiting') {
      await this.startGame(connection.gameRoomId);
    }
  }
  
  private async startGame(roomId: string) {
    const roomState = this.rooms.get(roomId);
    if (!roomState) return;
    
    // Change room status
    roomState.status = 'active';
    roomState.settingsLocked = true;
    
    // Initialize authoritative game state
    const gameState: AuthoritativeGameState = {
      currentTurn: 0,
      currentPlayer: Array.from(roomState.participants.keys())[0],
      turnStartTime: Date.now(),
      turnTimeLimit: 30000, // 30 seconds per turn
      gameStartTime: Date.now(),
      rounds: roomState.settings.rounds,
      currentRound: 1,
      deck: this.shuffleDeck(),
      discardPile: [],
      playerStates: new Map(),
      lastAction: null,
      lastActionTimestamp: Date.now()
    };
    
    // Initialize player states
    for (const [userId, participant] of roomState.participants) {
      gameState.playerStates.set(userId, {
        userId,
        hand: this.dealCards(gameState.deck, 9),
        score: 0,
        hasPeeked: false,
        turnActions: 0
      });
    }
    
    roomState.gameState = gameState;
    
    // Update database
    await this.storage.updateGameRoom(roomId, {
      status: 'active',
      settingsLocked: true,
      serverGameState: gameState,
      startedAt: new Date()
    });
    
    // Deduct coins
    for (const [userId] of roomState.participants) {
      if (roomState.settings.betAmount > 0) {
        await this.storage.spendCurrency(userId, roomState.settings.betAmount);
      }
    }
    
    // Broadcast game start
    await this.broadcastToRoom(roomId, {
      type: 'game_started',
      gameState: this.getClientGameState(gameState, null),
      timestamp: Date.now()
    });
    
    // Remove from lobby list
    await this.broadcastLobbyUpdate();
  }
  
  private async handleGameAction(connection: WSConnection, data: any) {
    if (!connection.gameRoomId) return;
    
    const roomState = this.rooms.get(connection.gameRoomId);
    if (!roomState || !roomState.gameState) return;
    
    const { action, actionData } = data;
    const gameState = roomState.gameState;
    
    // Validate it's player's turn
    if (gameState.currentPlayer !== connection.userId) {
      connection.ws.send(JSON.stringify({
        type: 'error',
        message: 'Not your turn',
        timestamp: Date.now()
      }));
      return;
    }
    
    // Process action on server
    const result = await this.processGameAction(gameState, action, actionData, connection.userId);
    
    if (!result.valid) {
      connection.ws.send(JSON.stringify({
        type: 'action_rejected',
        reason: result.reason,
        timestamp: Date.now()
      }));
      return;
    }
    
    // Update game state
    gameState.lastAction = {
      type: action,
      playerId: connection.userId,
      data: actionData,
      timestamp: Date.now(),
      sequenceNumber: (gameState.lastAction?.sequenceNumber || 0) + 1
    };
    gameState.lastActionTimestamp = Date.now();
    
    // Save to database
    await this.storage.updateGameState(connection.gameRoomId, gameState);
    
    // Broadcast action to all players
    await this.broadcastToRoom(connection.gameRoomId, {
      type: 'game_action',
      action,
      actionData,
      playerId: connection.userId,
      gameState: this.getClientGameState(gameState, null),
      timestamp: Date.now()
    });
    
    // Check for game end
    if (result.gameEnded) {
      await this.endGame(connection.gameRoomId);
    }
  }
  
  private async processGameAction(
    gameState: AuthoritativeGameState,
    action: string,
    data: any,
    playerId: string
  ): Promise<{ valid: boolean; reason?: string; gameEnded?: boolean }> {
    // Implement game logic validation here
    // This is a simplified version - you'll need to implement full Golf 9 rules
    
    const playerState = gameState.playerStates.get(playerId);
    if (!playerState) {
      return { valid: false, reason: 'Player not in game' };
    }
    
    switch (action) {
      case 'draw_card':
        // Validate and process draw
        return { valid: true };
        
      case 'place_card':
        // Validate and process card placement
        return { valid: true };
        
      case 'end_turn':
        // Move to next player
        const players = Array.from(gameState.playerStates.keys());
        const currentIndex = players.indexOf(playerId);
        const nextIndex = (currentIndex + 1) % players.length;
        gameState.currentPlayer = players[nextIndex];
        gameState.currentTurn++;
        gameState.turnStartTime = Date.now();
        
        // Check if round ended
        if (gameState.currentTurn >= players.length * gameState.rounds) {
          return { valid: true, gameEnded: true };
        }
        
        return { valid: true };
        
      default:
        return { valid: false, reason: 'Unknown action' };
    }
  }
  
  private async handleTransferCrown(connection: WSConnection, data: any) {
    if (!connection.gameRoomId) return;
    
    const roomState = this.rooms.get(connection.gameRoomId);
    if (!roomState) return;
    
    // Only current crown holder can transfer
    if (roomState.crownHolderId !== connection.userId) {
      connection.ws.send(JSON.stringify({
        type: 'error',
        message: 'Only the host can transfer crown',
        timestamp: Date.now()
      }));
      return;
    }
    
    const { targetUserId } = data;
    
    // Validate target is in room
    if (!roomState.participants.has(targetUserId)) {
      connection.ws.send(JSON.stringify({
        type: 'error',
        message: 'Target player not in room',
        timestamp: Date.now()
      }));
      return;
    }
    
    // Transfer crown
    roomState.crownHolderId = targetUserId;
    roomState.hostId = targetUserId;
    
    // Update database
    await this.storage.updateGameRoom(connection.gameRoomId, {
      crownHolderId: targetUserId,
      hostId: targetUserId
    });
    
    // Broadcast crown transfer
    await this.broadcastToRoom(connection.gameRoomId, {
      type: 'crown_transferred',
      fromUserId: connection.userId,
      toUserId: targetUserId,
      timestamp: Date.now()
    });
  }
  
  private async handleChatMessage(connection: WSConnection, data: any) {
    const { content } = data;
    
    if (!content || content.trim().length === 0) return;
    
    // Save message to database
    const message = await this.storage.addChatMessage({
      senderId: connection.userId,
      gameRoomId: connection.gameRoomId || null,
      content,
      type: 'message'
    });
    
    // Broadcast to appropriate audience
    if (connection.gameRoomId) {
      await this.broadcastToRoom(connection.gameRoomId, {
        type: 'chat_message',
        message,
        timestamp: Date.now()
      });
    } else {
      // Global chat
      this.broadcastToAll({
        type: 'chat_message',
        message,
        timestamp: Date.now()
      });
    }
  }
  
  private async handleRejoinRoom(connection: WSConnection, data: any) {
    const { roomCode } = data;
    
    try {
      const room = await this.storage.getGameRoom(roomCode);
      if (!room) {
        connection.ws.send(JSON.stringify({
          type: 'error',
          message: 'Room not found',
          timestamp: Date.now()
        }));
        return;
      }
      
      // Check if user was in this room
      const participants = await this.storage.getGameParticipants(room.id);
      const wasParticipant = participants.some(p => p.userId === connection.userId);
      
      if (!wasParticipant) {
        connection.ws.send(JSON.stringify({
          type: 'error',
          message: 'You were not in this room',
          timestamp: Date.now()
        }));
        return;
      }
      
      // Check disconnect timeout (5 minutes)
      const participant = participants.find(p => p.userId === connection.userId);
      if (participant?.disconnectedAt) {
        const disconnectTime = new Date(participant.disconnectedAt).getTime();
        if (Date.now() - disconnectTime > 300000) { // 5 minutes
          connection.ws.send(JSON.stringify({
            type: 'error',
            message: 'Reconnection timeout exceeded',
            timestamp: Date.now()
          }));
          return;
        }
      }
      
      // Restore connection
      const roomState = this.rooms.get(room.id);
      if (roomState) {
        const participantState = roomState.participants.get(connection.userId);
        if (participantState) {
          participantState.isConnected = true;
          participantState.connectionId = connection.connectionId;
          participantState.disconnectedAt = undefined;
        }
      }
      
      connection.gameRoomId = room.id;
      
      // Update database
      await this.storage.updateParticipantConnection(room.id, connection.userId, true, connection.connectionId);
      
      // Send current game state
      connection.ws.send(JSON.stringify({
        type: 'rejoined_room',
        roomCode,
        roomState: roomState ? this.serializeRoomState(roomState) : null,
        timestamp: Date.now()
      }));
      
      // Broadcast reconnection
      await this.broadcastToRoom(room.id, {
        type: 'player_reconnected',
        userId: connection.userId,
        timestamp: Date.now()
      }, connection.userId);
      
    } catch (error) {
      console.error('Rejoin room error:', error);
      connection.ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to rejoin room',
        timestamp: Date.now()
      }));
    }
  }
  
  private async handleDisconnection(ws: WebSocket) {
    const connection = this.findConnection(ws);
    if (!connection) return;
    
    // Remove from connections
    this.connections.delete(connection.connectionId);
    
    // Handle room disconnection
    if (connection.gameRoomId) {
      const roomState = this.rooms.get(connection.gameRoomId);
      if (roomState) {
        const participant = roomState.participants.get(connection.userId);
        if (participant) {
          participant.isConnected = false;
          participant.disconnectedAt = Date.now();
          participant.connectionId = undefined;
          
          // Update database
          await this.storage.updateParticipantConnection(
            connection.gameRoomId,
            connection.userId,
            false,
            null
          );
          
          // If game is active, start AI takeover timer
          if (roomState.status === 'active' && roomState.gameState) {
            setTimeout(() => this.checkAITakeover(connection.gameRoomId!, connection.userId), 30000);
          }
          
          // Broadcast disconnection
          await this.broadcastToRoom(connection.gameRoomId, {
            type: 'player_disconnected',
            userId: connection.userId,
            timestamp: Date.now()
          });
        }
      }
    }
  }
  
  private async checkAITakeover(roomId: string, userId: string) {
    const roomState = this.rooms.get(roomId);
    if (!roomState) return;
    
    const participant = roomState.participants.get(userId);
    if (!participant || participant.isConnected) return;
    
    // Convert to AI player
    participant.isAI = true;
    
    // Update database
    await this.storage.updateParticipantAI(roomId, userId, true);
    
    // Broadcast AI takeover
    await this.broadcastToRoom(roomId, {
      type: 'player_ai_takeover',
      userId,
      timestamp: Date.now()
    });
    
    // Start AI turn if it's their turn
    if (roomState.gameState?.currentPlayer === userId) {
      await this.executeAITurn(roomId, userId);
    }
  }
  
  private async executeAITurn(roomId: string, userId: string) {
    // Implement AI logic here
    // For now, just end turn after a delay
    setTimeout(async () => {
      const roomState = this.rooms.get(roomId);
      if (!roomState?.gameState) return;
      
      if (roomState.gameState.currentPlayer === userId) {
        await this.processGameAction(roomState.gameState, 'end_turn', {}, userId);
        
        // Broadcast AI action
        await this.broadcastToRoom(roomId, {
          type: 'game_action',
          action: 'end_turn',
          actionData: {},
          playerId: userId,
          gameState: this.getClientGameState(roomState.gameState, null),
          timestamp: Date.now()
        });
      }
    }, 2000);
  }
  
  private async endGame(roomId: string) {
    const roomState = this.rooms.get(roomId);
    if (!roomState || !roomState.gameState) return;
    
    // Calculate final scores and placements
    const scores = Array.from(roomState.gameState.playerStates.entries())
      .map(([userId, state]) => ({ userId, score: state.score }))
      .sort((a, b) => a.score - b.score);
    
    // Calculate payouts
    const prizePool = roomState.settings.betAmount * roomState.participants.size;
    const payouts: { [userId: string]: number } = {};
    
    if (prizePool > 0) {
      // Winner takes 60%, second place 30%, third place 10%
      if (scores[0]) payouts[scores[0].userId] = Math.floor(prizePool * 0.6);
      if (scores[1]) payouts[scores[1].userId] = Math.floor(prizePool * 0.3);
      if (scores[2]) payouts[scores[2].userId] = Math.floor(prizePool * 0.1);
    }
    
    // Update room status
    roomState.status = 'finished';
    
    // Save to database
    await this.storage.updateGameRoom(roomId, {
      status: 'finished',
      finishedAt: new Date(),
      payouts
    });
    
    // Award payouts and XP
    for (let i = 0; i < scores.length; i++) {
      const { userId, score } = scores[i];
      const payout = payouts[userId] || 0;
      const placement = i + 1;
      
      // Update participant record
      await this.storage.updateParticipantResult(roomId, userId, placement, payout);
      
      // Award coins and XP
      if (payout > 0) {
        await this.storage.awardCurrency(userId, payout);
      }
      
      const xpEarned = placement === 1 ? 100 : placement === 2 ? 50 : 25;
      await this.storage.awardExperience(userId, xpEarned);
      
      // Save game history
      await this.storage.saveGameHistory({
        userId,
        gameMode: 'online',
        playerCount: roomState.participants.size,
        rounds: roomState.settings.rounds,
        finalScore: score,
        placement,
        won: placement === 1,
        xpEarned,
        coinsEarned: payout
      });
    }
    
    // Broadcast game end
    await this.broadcastToRoom(roomId, {
      type: 'game_ended',
      scores,
      payouts,
      timestamp: Date.now()
    });
    
    // Clean up room after delay
    setTimeout(() => {
      this.rooms.delete(roomId);
    }, 60000); // Keep room for 1 minute for results viewing
  }
  
  private async sendLobbyList(connection: WSConnection) {
    const lobbies = await this.storage.getPublicLobbies();
    
    connection.ws.send(JSON.stringify({
      type: 'lobby_list',
      lobbies: lobbies.map(lobby => ({
        code: lobby.code,
        hostName: lobby.hostName,
        playerCount: lobby.playerCount,
        maxPlayers: lobby.maxPlayers,
        betAmount: lobby.betAmount,
        rounds: lobby.rounds,
        status: lobby.status
      })),
      timestamp: Date.now()
    }));
  }
  
  private async broadcastLobbyUpdate() {
    const lobbies = await this.storage.getPublicLobbies();
    
    const lobbyData = lobbies.map(lobby => ({
      code: lobby.code,
      hostName: lobby.hostName,
      playerCount: lobby.playerCount,
      maxPlayers: lobby.maxPlayers,
      betAmount: lobby.betAmount,
      rounds: lobby.rounds,
      status: lobby.status
    }));
    
    // Broadcast to all connected users
    this.broadcastToAll({
      type: 'lobby_update',
      lobbies: lobbyData,
      timestamp: Date.now()
    });
  }
  
  public async broadcastToRoom(roomId: string, message: any, excludeUserId?: string) {
    const roomState = this.rooms.get(roomId);
    if (!roomState) return;
    
    for (const [userId, participant] of roomState.participants) {
      if (userId === excludeUserId) continue;
      if (!participant.isConnected || !participant.connectionId) continue;
      
      const connection = this.connections.get(participant.connectionId);
      if (connection && connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(JSON.stringify(message));
      }
    }
  }
  
  private broadcastToAll(message: any) {
    for (const connection of this.connections.values()) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(JSON.stringify(message));
      }
    }
  }
  
  private async restoreRoomState(roomId: string) {
    const room = await this.storage.getGameRoomById(roomId);
    if (!room) return;
    
    const participants = await this.storage.getGameParticipants(roomId);
    
    const roomState: RoomState = {
      participants: new Map(),
      spectators: new Set(),
      gameState: room.serverGameState as AuthoritativeGameState || null,
      lastActivityAt: room.lastActivityAt ? new Date(room.lastActivityAt).getTime() : Date.now(),
      hostId: room.hostId,
      crownHolderId: room.crownHolderId || room.hostId,
      settings: room.settings as RoomSettings,
      status: room.status as 'waiting' | 'active' | 'finished',
      isPublished: room.isPublished || false,
      isPrivate: room.isPrivate || false,
      password: room.password || undefined
    };
    
    for (const p of participants) {
      roomState.participants.set(p.userId, {
        userId: p.userId,
        playerIndex: p.playerIndex,
        isReady: p.isReady || false,
        isConnected: p.isConnected || false,
        connectionId: p.connectionId || undefined,
        disconnectedAt: p.disconnectedAt ? new Date(p.disconnectedAt).getTime() : undefined,
        isAI: p.isAiReplacement || false
      });
    }
    
    this.rooms.set(roomId, roomState);
  }
  
  private serializeRoomState(roomState: RoomState): any {
    return {
      participants: Array.from(roomState.participants.values()),
      spectators: Array.from(roomState.spectators),
      gameState: roomState.gameState ? this.getClientGameState(roomState.gameState, null) : null,
      hostId: roomState.hostId,
      crownHolderId: roomState.crownHolderId,
      settings: roomState.settings,
      status: roomState.status,
      isPublished: roomState.isPublished,
      isPrivate: roomState.isPrivate
    };
  }
  
  private getClientGameState(gameState: AuthoritativeGameState, forUserId: string | null): any {
    // Return sanitized game state for clients
    // Hide other players' cards, etc.
    return {
      currentTurn: gameState.currentTurn,
      currentPlayer: gameState.currentPlayer,
      turnStartTime: gameState.turnStartTime,
      turnTimeLimit: gameState.turnTimeLimit,
      rounds: gameState.rounds,
      currentRound: gameState.currentRound,
      discardPile: gameState.discardPile,
      lastAction: gameState.lastAction,
      playerStates: Array.from(gameState.playerStates.entries()).map(([userId, state]) => ({
        userId,
        score: state.score,
        cardCount: state.hand.length,
        hasPeeked: state.hasPeeked,
        // Only show cards to the player themselves
        hand: forUserId === userId ? state.hand : Array(state.hand.length).fill('hidden')
      }))
    };
  }
  
  private findConnection(ws: WebSocket): WSConnection | undefined {
    for (const connection of this.connections.values()) {
      if (connection.ws === ws) {
        return connection;
      }
    }
    return undefined;
  }
  
  private generateConnectionId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
  
  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }
  
  private shuffleDeck(): string[] {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck: string[] = [];
    
    for (const suit of suits) {
      for (const value of values) {
        deck.push(`${value}_${suit}`);
      }
    }
    
    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    return deck;
  }
  
  private dealCards(deck: string[], count: number): string[] {
    return deck.splice(0, count);
  }
  
  private startPingInterval() {
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      
      for (const [id, connection] of this.connections) {
        // Disconnect if no pong received for 60 seconds
        if (connection.lastPing && now - connection.lastPing > 60000) {
          console.log(`Disconnecting inactive connection: ${id}`);
          connection.ws.close();
          this.connections.delete(id);
        } else if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.ping();
        }
      }
    }, 30000); // Ping every 30 seconds
  }
  
  private startIdleCheckInterval() {
    setInterval(async () => {
      const now = Date.now();
      
      for (const [roomId, roomState] of this.rooms) {
        // Check for idle crown holders (4 minutes warning, 5 minutes action)
        if (roomState.status === 'waiting' && roomState.participants.size > 0) {
          const idleTime = now - roomState.lastActivityAt;
          
          if (idleTime > 300000) { // 5 minutes
            // Auto-close room or transfer crown
            if (roomState.participants.size === 1) {
              // Close room
              await this.closeIdleRoom(roomId);
            } else {
              // Transfer crown
              await this.autoTransferCrown(roomId);
            }
          } else if (idleTime > 240000) { // 4 minutes
            // Send warning
            await this.sendIdleWarning(roomId);
          }
        }
      }
    }, 60000); // Check every minute
  }
  
  private async closeIdleRoom(roomId: string) {
    const roomState = this.rooms.get(roomId);
    if (!roomState) return;
    
    // Notify players
    await this.broadcastToRoom(roomId, {
      type: 'room_closed',
      reason: 'idle_timeout',
      timestamp: Date.now()
    });
    
    // Clean up
    this.rooms.delete(roomId);
    await this.storage.deleteGameRoom(roomId);
    
    // Update lobby list
    await this.broadcastLobbyUpdate();
  }
  
  private async autoTransferCrown(roomId: string) {
    const roomState = this.rooms.get(roomId);
    if (!roomState) return;
    
    // Find next player (lowest join order)
    const participants = Array.from(roomState.participants.values())
      .sort((a, b) => a.playerIndex - b.playerIndex);
    
    const currentCrownIndex = participants.findIndex(p => p.userId === roomState.crownHolderId);
    const nextIndex = (currentCrownIndex + 1) % participants.length;
    const newCrownHolder = participants[nextIndex];
    
    if (newCrownHolder) {
      roomState.crownHolderId = newCrownHolder.userId;
      roomState.hostId = newCrownHolder.userId;
      roomState.lastActivityAt = Date.now();
      
      await this.storage.updateGameRoom(roomId, {
        crownHolderId: newCrownHolder.userId,
        hostId: newCrownHolder.userId,
        lastActivityAt: new Date()
      });
      
      await this.broadcastToRoom(roomId, {
        type: 'crown_auto_transferred',
        fromUserId: roomState.crownHolderId,
        toUserId: newCrownHolder.userId,
        reason: 'idle_timeout',
        timestamp: Date.now()
      });
    }
  }
  
  private async sendIdleWarning(roomId: string) {
    const roomState = this.rooms.get(roomId);
    if (!roomState) return;
    
    // Only send warning once
    const room = await this.storage.getGameRoomById(roomId);
    if (room?.idleWarningAt) return;
    
    await this.storage.updateGameRoom(roomId, {
      idleWarningAt: new Date()
    });
    
    await this.broadcastToRoom(roomId, {
      type: 'idle_warning',
      crownHolderId: roomState.crownHolderId,
      timeRemaining: 60000, // 1 minute remaining
      timestamp: Date.now()
    });
  }
  
  cleanup() {
    clearInterval(this.pingInterval);
    this.wss.close();
  }
}