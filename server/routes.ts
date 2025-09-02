import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { type StakeBracket, type GameRoom } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User progression routes
  app.get('/api/user/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });

  app.get('/api/user/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 10;
      const history = await storage.getUserGameHistory(userId, limit);
      res.json(history);
    } catch (error) {
      console.error("Error fetching game history:", error);
      res.status(500).json({ message: "Failed to fetch game history" });
    }
  });

  // Game completion endpoint - awards XP and coins
  app.post('/api/game/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { 
        gameMode, 
        playerCount, 
        rounds, 
        finalScore, 
        placement, 
        won,
        gameDuration 
      } = req.body;

      // Calculate XP and coin rewards
      const baseXP = 10;
      const winBonus = won ? 20 : 0;
      const placementBonus = Math.max(0, (5 - placement) * 5); // 1st: 20, 2nd: 15, 3rd: 10, 4th: 5
      const xpEarned = baseXP + winBonus + placementBonus;

      const baseCoins = 5;
      const coinBonus = won ? 10 : 0;
      const coinsEarned = baseCoins + coinBonus;

      // Add game to history
      await storage.addGameToHistory({
        userId,
        gameMode,
        playerCount,
        rounds,
        finalScore,
        placement,
        won,
        xpEarned,
        coinsEarned,
        gameDuration
      });

      // Update user stats
      const currentStats = await storage.getUserStats(userId);
      await storage.updateUserStats(userId, {
        gamesPlayed: (currentStats?.gamesPlayed || 0) + 1,
        gamesWon: (currentStats?.gamesWon || 0) + (won ? 1 : 0),
        gamesLost: (currentStats?.gamesLost || 0) + (won ? 0 : 1),
        totalScore: (currentStats?.totalScore || 0) + finalScore,
        bestScore: currentStats?.bestScore ? Math.min(currentStats.bestScore, finalScore) : finalScore,
        currentWinStreak: won ? (currentStats?.currentWinStreak || 0) + 1 : 0,
        longestWinStreak: won ? Math.max(currentStats?.longestWinStreak || 0, (currentStats?.currentWinStreak || 0) + 1) : currentStats?.longestWinStreak || 0,
        perfectGames: (currentStats?.perfectGames || 0) + (finalScore === 0 ? 1 : 0),
      });

      // Award currency and XP
      await storage.addCurrency(userId, coinsEarned);
      const updatedUser = await storage.addExperience(userId, xpEarned);

      res.json({ 
        xpEarned, 
        coinsEarned, 
        newLevel: updatedUser.level,
        newExperience: updatedUser.experience,
        newCurrency: updatedUser.currency
      });
    } catch (error) {
      console.error("Error completing game:", error);
      res.status(500).json({ message: "Failed to complete game" });
    }
  });

  // Achievement routes
  app.get('/api/achievements', isAuthenticated, async (req: any, res) => {
    try {
      const achievements = await storage.getAllAchievements();
      res.json(achievements);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  app.get('/api/user/achievements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userAchievements = await storage.getUserAchievements(userId);
      res.json(userAchievements);
    } catch (error) {
      console.error("Error fetching user achievements:", error);
      res.status(500).json({ message: "Failed to fetch user achievements" });
    }
  });


  // Cosmetics routes
  app.get('/api/cosmetics/:category?', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const category = req.params.category;
      
      // Get all cosmetics (filtered by category if provided)
      const allCosmetics = await storage.getAllCosmetics();
      const cosmetics = category 
        ? allCosmetics.filter(c => c.type === category)
        : allCosmetics;
      
      // Get user's owned cosmetics
      const userCosmetics = await storage.getUserCosmetics(userId);
      
      // Combine cosmetic data with ownership info
      const cosmeticsWithOwnership = cosmetics.map(cosmetic => {
        const userCosmetic = userCosmetics.find(uc => uc.cosmeticId === cosmetic.id);
        return {
          ...cosmetic,
          owned: !!userCosmetic,
          equipped: userCosmetic?.equipped || false
        };
      });
      
      res.json(cosmeticsWithOwnership);
    } catch (error) {
      console.error("Error fetching cosmetics:", error);
      res.status(500).json({ message: "Failed to fetch cosmetics" });
    }
  });

  app.get('/api/user/cosmetics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userCosmetics = await storage.getUserCosmetics(userId);
      const allCosmetics = await storage.getAllCosmetics();
      
      // Add cosmetic details to user cosmetics
      const cosmeticsWithDetails = userCosmetics.map(uc => {
        const cosmetic = allCosmetics.find(c => c.id === uc.cosmeticId);
        return {
          ...uc,
          name: cosmetic?.name || '',
          type: cosmetic?.type || '',
          imageUrl: cosmetic?.imageUrl || ''
        };
      });
      
      res.json(cosmeticsWithDetails);
    } catch (error) {
      console.error("Error fetching user cosmetics:", error);
      res.status(500).json({ message: "Failed to fetch user cosmetics" });
    }
  });

  app.post('/api/cosmetics/:cosmeticId/purchase', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { cosmeticId } = req.params;
      
      // Get cosmetic details
      const allCosmetics = await storage.getAllCosmetics();
      const cosmetic = allCosmetics.find(c => c.id === cosmeticId);
      
      if (!cosmetic) {
        return res.status(404).json({ message: "Cosmetic not found" });
      }
      
      // Check if user can afford it
      const user = await storage.getUser(userId);
      if (!user || (user.currency ?? 0) < cosmetic.cost) {
        return res.status(400).json({ message: "Insufficient coins" });
      }
      
      // Check if user meets level requirement
      if ((user.level ?? 1) < (cosmetic.unlockLevel ?? 1)) {
        return res.status(400).json({ message: "Level requirement not met" });
      }
      
      // Check if already owned
      const userCosmetics = await storage.getUserCosmetics(userId);
      if (userCosmetics.some(uc => uc.cosmeticId === cosmeticId)) {
        return res.status(400).json({ message: "Already owned" });
      }
      
      // Purchase cosmetic
      await storage.spendCurrency(userId, cosmetic.cost);
      const userCosmetic = await storage.purchaseCosmetic({
        userId,
        cosmeticId,
      });
      
      res.json(userCosmetic);
    } catch (error) {
      console.error("Error purchasing cosmetic:", error);
      res.status(500).json({ message: "Failed to purchase cosmetic" });
    }
  });

  app.post('/api/cosmetics/:cosmeticId/equip', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { cosmeticId } = req.params;
      
      await storage.equipCosmetic(userId, cosmeticId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error equipping cosmetic:", error);
      res.status(500).json({ message: "Failed to equip cosmetic" });
    }
  });

  // Game room routes
  app.get('/api/rooms/active/:stakeBracket', async (req, res) => {
    try {
      const { stakeBracket } = req.params;
      
      // Validate stake bracket
      const validBrackets = ['free', 'low', 'medium', 'high', 'premium'];
      if (!validBrackets.includes(stakeBracket)) {
        return res.status(400).json({ message: "Invalid stake bracket" });
      }
      
      const rooms = await storage.getActiveRoomsByStake(stakeBracket as any);
      res.json(rooms);
    } catch (error) {
      console.error("Error fetching active rooms:", error);
      res.status(500).json({ message: "Failed to fetch active rooms" });
    }
  });
  
  // Create room endpoint - initializes game table immediately
  app.post('/api/rooms/create', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userName = req.user.claims.email || req.user.claims.name || 'Player';
      const { 
        stakeBracket = 'free',
        rounds = 9,
        maxPlayers = 4 
      } = req.body;
      
      // Generate a unique room code
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Initialize empty game table state with host in seat 0
      const initialGameState = {
        state: 'waiting', // Waiting for players to fill seats
        currentRound: 0,
        currentTurn: 0,
        currentPlayerIndex: 0,
        deck: [],
        discardPile: [],
        tableSlots: Array(maxPlayers).fill(null).map((_, index) => ({
          seatNumber: index,
          isEmpty: index > 0, // Host takes seat 0, others empty
          playerId: index === 0 ? userId : null,
          playerName: index === 0 ? userName : null,
          cards: [],
          score: 0,
          roundScores: [],
          isReady: false,
          isActive: index === 0
        })),
        settings: {
          rounds,
          playerCount: maxPlayers,
          stakeBracket
        }
      };
      
      // Create room with host as first player and game state initialized
      const room = await storage.createGameRoom({
        code: roomCode,
        hostId: userId,
        players: [{ 
          id: userId, 
          name: userName,
          isHost: true,
          joinedAt: new Date().toISOString(),
          connected: true,
          lastSeen: new Date().toISOString(),
          connectionId: null
        }],
        settings: { 
          rounds, 
          playerCount: maxPlayers,
          stakeBracket,
          createdAt: new Date().toISOString()
        },
        stakeBracket,
        status: 'inGame_waiting', // Room is immediately at the table waiting for players
        gameState: initialGameState
      });
      
      // Log room creation
      console.log(`Room ${roomCode} created by ${userName} with stake ${stakeBracket} - game table initialized`);
      
      // Broadcast updated Active Rooms list to all subscribers matching the stake bracket
      const broadcastFn = (global as any).broadcastRoomUpdate;
      if (broadcastFn) {
        // This will automatically filter and send to relevant subscribers
        await broadcastFn('created', room);
      }
      
      // Return a game snapshot for immediate navigation to game view
      const gameSnapshot = {
        code: roomCode,
        hostId: userId,
        status: 'inGame_waiting',
        players: room.players,
        gameState: initialGameState,
        settings: room.settings,
        stakeBracket
      };
      
      res.json({
        success: true,
        room,
        gameSnapshot,
        message: `Game table created - Room ${roomCode}`
      });
    } catch (error) {
      console.error("Error creating room:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to create room",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get room details by code
  app.get('/api/rooms/:code', async (req, res) => {
    try {
      const { code } = req.params;
      
      const room = await storage.getGameRoom(code);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      
      // Serialize BigInt values to strings
      res.json(serializeRoom(room));
    } catch (error) {
      console.error("Error fetching room details:", error);
      res.status(500).json({ message: "Failed to fetch room details" });
    }
  });

  // Join room endpoint - Seat Claim
  app.post('/api/rooms/:code/join', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userName = req.user.claims.email || req.user.claims.name || 'Player';
      const { code } = req.params;
      
      // Re-read latest table state
      const room = await storage.getGameRoom(code);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      
      const players = room.players as any[];
      const gameState = room.gameState as any;
      const maxPlayers = room.maxPlayers || 4;
      
      // Check if player already seated (idempotent)
      const existingPlayer = players.find(p => p.id === userId);
      if (existingPlayer) {
        // Already seated - return current state
        const gameSnapshot = {
          code: room.code,
          hostId: room.hostId,
          status: room.status,
          players: room.players,
          gameState: room.gameState,
          settings: room.settings,
          stakeBracket: room.stakeBracket,
          version: room.version
        };
        return res.json({
          success: true,
          alreadySeated: true,
          gameSnapshot,
          seatNumber: existingPlayer.seatNumber || 0,
          message: "Already seated at this table"
        });
      }
      
      // Check if room is full
      const seatsOpen = maxPlayers - players.length;
      if (seatsOpen <= 0) {
        // Room is full - return error with latest snapshot
        const gameSnapshot = {
          code: room.code,
          hostId: room.hostId,
          status: room.status,
          players: room.players,
          gameState: room.gameState,
          settings: room.settings,
          stakeBracket: room.stakeBracket,
          version: room.version
        };
        return res.status(400).json({ 
          success: false,
          message: "Table is full - no seats available",
          gameSnapshot
        });
      }
      
      // Find next available seat and claim it atomically
      let seatNumber = -1;
      if (gameState && gameState.tableSlots) {
        for (let i = 0; i < gameState.tableSlots.length; i++) {
          if (gameState.tableSlots[i].isEmpty) {
            seatNumber = i;
            // Claim the seat atomically
            gameState.tableSlots[i] = {
              seatNumber: i,
              isEmpty: false,
              playerId: userId,
              playerName: userName,
              cards: [],
              score: 0,
              roundScores: [],
              isReady: false,
              isActive: true
            };
            break;
          }
        }
      }
      
      // Verify seat was actually claimed
      if (seatNumber === -1) {
        const gameSnapshot = {
          code: room.code,
          hostId: room.hostId,
          status: room.status,
          players: room.players,
          gameState: room.gameState,
          settings: room.settings,
          stakeBracket: room.stakeBracket,
          version: room.version
        };
        return res.status(400).json({ 
          success: false,
          message: "No seats available",
          gameSnapshot
        });
      }
      
      // Add player to players array with connection state
      players.push({ 
        id: userId, 
        name: userName,
        seatNumber,
        joinedAt: new Date().toISOString(),
        connected: true,
        lastSeen: new Date().toISOString(),
        connectionId: null
      });
      
      // Increment version for optimistic concurrency
      const newVersion = (room.version ? BigInt(room.version) : BigInt(1)) + BigInt(1);
      
      // Update room with new player and incremented version
      const updatedRoom = await storage.updateGameRoom(code, {
        players,
        gameState,
        version: newVersion
      });
      
      if (!updatedRoom) {
        return res.status(500).json({ message: "Failed to update room" });
      }
      
      // Create full game snapshot with version
      const gameSnapshot = {
        code: updatedRoom.code,
        hostId: updatedRoom.hostId,
        status: updatedRoom.status,
        players: updatedRoom.players,
        gameState: updatedRoom.gameState,
        settings: updatedRoom.settings,
        stakeBracket: updatedRoom.stakeBracket,
        version: updatedRoom.version
      };
      
      // Broadcast to Active Rooms subscribers
      const broadcastFn = (global as any).broadcastRoomUpdate;
      if (broadcastFn) {
        await broadcastFn('updated', updatedRoom);
      }
      
      // TODO: Broadcast to table participants via WebSocket
      // This will be implemented when we have table-specific WebSocket channels
      
      res.json({
        success: true,
        gameSnapshot,
        seatNumber,
        message: `Joined table at seat ${seatNumber}`
      });
      
    } catch (error) {
      console.error("Error joining room:", error);
      res.status(500).json({ message: "Failed to join room" });
    }
  });

  // Leave room endpoint
  app.post('/api/rooms/:code/leave', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { code } = req.params;
      
      const room = await storage.getGameRoom(code);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      
      let players = room.players as any[];
      players = players.filter(p => p.id !== userId);
      
      // If room is now empty, delete it immediately (ghost room prevention)
      if (players.length === 0) {
        await storage.deleteGameRoom(code);
        console.log(`Room ${code} deleted immediately (no players remaining)`);
        
        // Broadcast room removal to Active Rooms subscribers
        const broadcastFn = (global as any).broadcastRoomUpdate;
        if (broadcastFn) {
          broadcastFn('removed', room);
        }
        
        return res.json({ message: "Left room and room deleted" });
      }
      
      // Update room with remaining players
      const updatedRoom = await storage.updateGameRoom(code, {
        players,
        hostId: players[0].id // Transfer host to first remaining player
      });
      
      // Broadcast room update
      const broadcastFn = (global as any).broadcastRoomUpdate;
      if (broadcastFn && updatedRoom) {
        broadcastFn('updated', updatedRoom);
      }
      
      res.json({ message: "Left room successfully", room: updatedRoom });
    } catch (error) {
      console.error("Error leaving room:", error);
      res.status(500).json({ message: "Failed to leave room" });
    }
  });

  // Settings routes
  app.get('/api/user/settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let settings = await storage.getUserSettings(userId);
      
      // Create default settings if none exist
      if (!settings) {
        settings = await storage.upsertUserSettings(userId, {});
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Error fetching user settings:", error);
      res.status(500).json({ message: "Failed to fetch user settings" });
    }
  });

  app.patch('/api/user/settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const updates = req.body;
      
      const settings = await storage.upsertUserSettings(userId, updates);
      res.json(settings);
    } catch (error) {
      console.error("Error updating user settings:", error);
      res.status(500).json({ message: "Failed to update user settings" });
    }
  });


  const httpServer = createServer(app);
  
  // WebSocket server for real-time subscriptions
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Track subscriptions by client
  interface ClientSubscription {
    ws: WebSocket;
    stakeBracket?: StakeBracket;
    subscribedAt: Date;
    userId?: string;
    roomCode?: string;
  }
  
  const activeSubscriptions = new Map<string, ClientSubscription>();
  const userConnections = new Map<string, Set<string>>(); // userId -> Set of clientIds
  const GRACE_PERIOD_MS = 30000; // 30 seconds grace period for reconnection
  
  wss.on('connection', (ws: WebSocket) => {
    const clientId = Math.random().toString(36).substring(7);
    console.log(`WebSocket client connected: ${clientId}`);
    
    ws.on('message', async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle user authentication for connection tracking
        if (data.type === 'authenticate' && data.userId) {
          const subscription = activeSubscriptions.get(clientId) || { ws, subscribedAt: new Date() };
          subscription.userId = data.userId;
          activeSubscriptions.set(clientId, subscription);
          
          // Track user connections
          if (!userConnections.has(data.userId)) {
            userConnections.set(data.userId, new Set());
          }
          userConnections.get(data.userId)!.add(clientId);
          
          // If user joins a room, update their connection state
          if (data.roomCode) {
            subscription.roomCode = data.roomCode;
            await updatePlayerConnectionState(data.roomCode, data.userId, true, clientId);
          }
        }
        
        if (data.type === 'subscribe_rooms') {
          // Subscribe to room updates
          const subscription: ClientSubscription = {
            ws,
            stakeBracket: data.stakeBracket,
            subscribedAt: new Date()
          };
          activeSubscriptions.set(clientId, subscription);
          
          // Send initial room list
          const rooms = await getActiveRooms(data.stakeBracket);
          ws.send(JSON.stringify({
            type: 'rooms_snapshot',
            rooms,
            timestamp: new Date().toISOString()
          }));
          
          console.log(`Client ${clientId} subscribed to rooms (stake: ${data.stakeBracket || 'all'})`);
        }
        
        if (data.type === 'unsubscribe_rooms') {
          activeSubscriptions.delete(clientId);
          console.log(`Client ${clientId} unsubscribed from rooms`);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });
    
    ws.on('close', async () => {
      const subscription = activeSubscriptions.get(clientId);
      
      if (subscription?.userId && subscription?.roomCode) {
        // Mark player as disconnected but don't remove immediately (grace period)
        await updatePlayerConnectionState(subscription.roomCode, subscription.userId, false, clientId);
        
        // Remove from user connections
        const userConns = userConnections.get(subscription.userId);
        if (userConns) {
          userConns.delete(clientId);
          if (userConns.size === 0) {
            userConnections.delete(subscription.userId);
            
            // Start grace period timer
            setTimeout(async () => {
              // Check if user reconnected
              if (!userConnections.has(subscription.userId!)) {
                // User didn't reconnect, clean up their seat
                await cleanupDisconnectedPlayer(subscription.roomCode!, subscription.userId!);
              }
            }, GRACE_PERIOD_MS);
          }
        }
      }
      
      activeSubscriptions.delete(clientId);
      console.log(`WebSocket client disconnected: ${clientId}`);
    });
    
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      activeSubscriptions.delete(clientId);
    });
  });
  
  // Helper function to serialize room data (converts BigInt to string)
  function serializeRoom(room: GameRoom): any {
    return {
      ...room,
      version: room.version ? room.version.toString() : '1'
    };
  }
  
  // Helper function to get active rooms per Active Room definition
  async function getActiveRooms(stakeBracket?: StakeBracket): Promise<GameRoom[]> {
    // Use improved storage method that already filters per Active Room definition
    if (stakeBracket) {
      const rooms = await storage.getActiveRoomsByStake(stakeBracket);
      return rooms.map(serializeRoom);
    }
    
    // Get all active rooms if no stake specified
    const allRooms = await storage.getAllActiveRooms();
    
    // Apply Active Room definition:
    // Active Rooms = Tables with Open Seats
    // 1. players ≥ 1 (at least one seated)
    // 2. seatsOpen > 0 (not full) 
    // 3. visibility allows listing
    // 4. Not in finished state
    const activeRooms: GameRoom[] = [];
    
    for (const room of allRooms) {
      const players = room.players as any[];
      
      // Delete zero-player rooms immediately
      if (!players || players.length === 0) {
        await storage.deleteGameRoom(room.code);
        console.log(`Deleted empty room ${room.code} (zero players)`);
        continue;
      }
      
      // Active Room criteria check
      const hasPlayers = players.length >= 1;
      const maxPlayers = room.maxPlayers || 4;
      const seatsOpen = maxPlayers - players.length;
      const hasOpenSeats = seatsOpen > 0; // MUST have open seats to be listed
      const visibility = room.visibility || 'public';
      const isListable = visibility === 'public';
      const notFinished = room.status !== 'finished';
      
      // Only list tables with open seats (not full)
      if (hasPlayers && hasOpenSeats && isListable && notFinished) {
        activeRooms.push(serializeRoom(room));
      }
    }
    
    return activeRooms;
  }
  
  // Broadcast room changes to subscribers
  async function broadcastRoomUpdate(changeType: 'created' | 'updated' | 'removed', room: GameRoom) {
    const allRooms = await getActiveRooms();
    
    activeSubscriptions.forEach((subscription, clientId) => {
      // Filter rooms based on subscription's stake bracket
      const filteredRooms = subscription.stakeBracket 
        ? allRooms.filter(r => r.stakeBracket === subscription.stakeBracket)
        : allRooms;
      
      // Check if this room change is relevant to the subscriber
      const isRelevant = !subscription.stakeBracket || room.stakeBracket === subscription.stakeBracket;
      
      if (isRelevant && subscription.ws.readyState === WebSocket.OPEN) {
        subscription.ws.send(JSON.stringify({
          type: 'rooms_update',
          changeType,
          room: serializeRoom(room),
          rooms: filteredRooms, // Already serialized from getActiveRooms
          timestamp: new Date().toISOString()
        }));
      }
    });
  }
  
  // Helper function to update player connection state
  async function updatePlayerConnectionState(roomCode: string, userId: string, connected: boolean, connectionId?: string) {
    try {
      const room = await storage.getGameRoom(roomCode);
      if (!room) return;
      
      const players = room.players as any[];
      const player = players.find(p => p.id === userId);
      
      if (player) {
        // Update connection state
        player.connected = connected;
        player.lastSeen = new Date().toISOString();
        if (connectionId) {
          player.connectionId = connectionId;
        }
        
        // Update room with new player state
        await storage.updateGameRoom(roomCode, { players });
        
        // Broadcast update
        broadcastRoomUpdate('updated', room);
      }
    } catch (error) {
      console.error(`Error updating connection state for ${userId} in room ${roomCode}:`, error);
    }
  }
  
  // Helper function to clean up disconnected player after grace period
  async function cleanupDisconnectedPlayer(roomCode: string, userId: string) {
    try {
      const room = await storage.getGameRoom(roomCode);
      if (!room) return;
      
      let players = room.players as any[];
      const player = players.find(p => p.id === userId);
      
      if (player && !player.connected) {
        const lastSeenTime = new Date(player.lastSeen).getTime();
        const now = Date.now();
        
        // Check if grace period has expired
        if (now - lastSeenTime >= GRACE_PERIOD_MS) {
          // Remove player from room
          players = players.filter(p => p.id !== userId);
          
          // Update game state to vacate seat
          const gameState = room.gameState as any;
          if (gameState?.tableSlots) {
            const seat = gameState.tableSlots.find((s: any) => s.playerId === userId);
            if (seat) {
              seat.isEmpty = true;
              seat.playerId = null;
              seat.playerName = null;
              seat.isActive = false;
            }
          }
          
          // If room is now empty, delete it
          if (players.length === 0) {
            await storage.deleteGameRoom(roomCode);
            console.log(`[Grace Period] Room ${roomCode} deleted (all players disconnected)`);
            broadcastRoomUpdate('removed', room);
          } else {
            // Update room with remaining players
            const updatedRoom = await storage.updateGameRoom(roomCode, { 
              players,
              gameState,
              hostId: players[0].id // Transfer host if needed
            });
            
            if (updatedRoom) {
              console.log(`[Grace Period] Player ${userId} removed from room ${roomCode} after grace period`);
              broadcastRoomUpdate('updated', updatedRoom);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error cleaning up disconnected player ${userId} in room ${roomCode}:`, error);
    }
  }
  
  // Export broadcast function for use in other parts of the application
  (global as any).broadcastRoomUpdate = broadcastRoomUpdate;
  
  // Periodic cleanup of phantom rooms (every 30 seconds)
  setInterval(async () => {
    try {
      const allRooms = await storage.getAllActiveRooms();
      let cleanedCount = 0;
      
      for (const room of allRooms) {
        const players = room.players as any[];
        
        // Delete rooms with zero players
        if (!players || players.length === 0) {
          await storage.deleteGameRoom(room.code);
          cleanedCount++;
          console.log(`[Cleanup] Deleted phantom room ${room.code} (zero players)`);
          
          // Broadcast removal
          broadcastRoomUpdate('removed', room);
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`[Cleanup] Removed ${cleanedCount} phantom rooms`);
      }
    } catch (error) {
      console.error('[Cleanup] Error during phantom room cleanup:', error);
    }
  }, 30000); // Run every 30 seconds
  
  return httpServer;
}