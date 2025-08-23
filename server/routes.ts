import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";

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

  // Multiplayer Game Room API Routes
  app.post('/api/game-rooms', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, maxPlayers, isPrivate, settings } = req.body;
      
      // Generate unique room code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const gameRoom = await storage.createGameRoom({
        code,
        hostId: userId,
        name: name || `${req.user.claims.first_name || 'Player'}'s Game`,
        maxPlayers: maxPlayers || 4,
        isPrivate: isPrivate || false,
        settings: settings || { rounds: 9, timeLimit: 60 }
      });
      
      res.json(gameRoom);
    } catch (error) {
      console.error("Error creating game room:", error);
      res.status(500).json({ message: "Failed to create game room" });
    }
  });

  app.get('/api/game-rooms/:code', isAuthenticated, async (req: any, res) => {
    try {
      const { code } = req.params;
      const gameRoom = await storage.getGameRoom(code);
      
      if (!gameRoom) {
        return res.status(404).json({ message: "Game room not found" });
      }
      
      res.json(gameRoom);
    } catch (error) {
      console.error("Error fetching game room:", error);
      res.status(500).json({ message: "Failed to fetch game room" });
    }
  });

  // Friend System API Routes
  app.get('/api/friends', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const friends = await storage.getFriends(userId);
      res.json(friends);
    } catch (error) {
      console.error("Error fetching friends:", error);
      res.status(500).json({ message: "Failed to fetch friends" });
    }
  });

  app.post('/api/friends/request', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { addresseeId, friendCode } = req.body;
      
      let targetUserId = addresseeId;
      
      // If friend code is provided, find user by friend code
      if (friendCode && !addresseeId) {
        const targetUser = await storage.findUserByFriendCode(friendCode);
        if (!targetUser) {
          return res.status(404).json({ message: "User with friend code not found" });
        }
        targetUserId = targetUser.id;
      }
      
      if (userId === targetUserId) {
        return res.status(400).json({ message: "Cannot send friend request to yourself" });
      }
      
      const friendRequest = await storage.sendFriendRequest(userId, targetUserId);
      res.json(friendRequest);
    } catch (error) {
      console.error("Error sending friend request:", error);
      res.status(500).json({ message: "Failed to send friend request" });
    }
  });

  app.patch('/api/friends/respond/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!['accepted', 'declined'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const friendship = await storage.respondToFriendRequest(id, status);
      res.json(friendship);
    } catch (error) {
      console.error("Error responding to friend request:", error);
      res.status(500).json({ message: "Failed to respond to friend request" });
    }
  });

  app.get('/api/friends/requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getFriendRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching friend requests:", error);
      res.status(500).json({ message: "Failed to fetch friend requests" });
    }
  });

  // Find user by friend code
  app.get('/api/users/find/:friendCode', isAuthenticated, async (req: any, res) => {
    try {
      const { friendCode } = req.params;
      const user = await storage.findUserByFriendCode(friendCode);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't return sensitive information
      const { email, ...publicUser } = user;
      res.json(publicUser);
    } catch (error) {
      console.error("Error finding user by friend code:", error);
      res.status(500).json({ message: "Failed to find user" });
    }
  });

  // Chat API Routes
  app.get('/api/chat/:gameRoomId?', isAuthenticated, async (req: any, res) => {
    try {
      const { gameRoomId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const messages = await storage.getChatHistory(gameRoomId, limit);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat history:", error);
      res.status(500).json({ message: "Failed to fetch chat history" });
    }
  });

  // Tournament API Routes
  app.get('/api/tournaments', isAuthenticated, async (req: any, res) => {
    try {
      const { status } = req.query;
      const tournaments = await storage.getTournaments(status as string);
      res.json(tournaments);
    } catch (error) {
      console.error("Error fetching tournaments:", error);
      res.status(500).json({ message: "Failed to fetch tournaments" });
    }
  });

  app.post('/api/tournaments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const {
        name,
        description,
        maxParticipants,
        entryFee,
        prizePool,
        registrationEnd,
        tournamentStart,
        rules
      } = req.body;
      
      const tournament = await storage.createTournament({
        name,
        description,
        organizerId: userId,
        maxParticipants,
        entryFee: entryFee || 0,
        prizePool: prizePool || 0,
        registrationEnd: new Date(registrationEnd),
        tournamentStart: new Date(tournamentStart),
        rules: rules || {}
      });
      
      res.json(tournament);
    } catch (error) {
      console.error("Error creating tournament:", error);
      res.status(500).json({ message: "Failed to create tournament" });
    }
  });

  app.post('/api/tournaments/:id/join', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      const participant = await storage.joinTournament(id, userId);
      res.json(participant);
    } catch (error) {
      console.error("Error joining tournament:", error);
      res.status(500).json({ message: "Failed to join tournament" });
    }
  });

  app.delete('/api/tournaments/:id/leave', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      await storage.leaveTournament(id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error leaving tournament:", error);
      res.status(500).json({ message: "Failed to leave tournament" });
    }
  });

  // Social Sharing API Routes
  app.get('/api/social/feed', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const feed = await storage.getSocialFeed(userId, limit);
      res.json(feed);
    } catch (error) {
      console.error("Error fetching social feed:", error);
      res.status(500).json({ message: "Failed to fetch social feed" });
    }
  });

  app.post('/api/social/posts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { type, content, metadata, isPublic } = req.body;
      
      const post = await storage.createSocialPost({
        userId,
        type,
        content,
        metadata: metadata || {},
        isPublic: isPublic !== false
      });
      
      res.json(post);
    } catch (error) {
      console.error("Error creating social post:", error);
      res.status(500).json({ message: "Failed to create social post" });
    }
  });

  app.post('/api/social/posts/:id/like', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      const like = await storage.likeSocialPost(id, userId);
      res.json(like);
    } catch (error) {
      console.error("Error liking post:", error);
      res.status(500).json({ message: "Failed to like post" });
    }
  });

  app.delete('/api/social/posts/:id/like', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      await storage.unlikeSocialPost(id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unliking post:", error);
      res.status(500).json({ message: "Failed to unlike post" });
    }
  });


  const httpServer = createServer(app);
  
  // WebSocket server setup for real-time multiplayer
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store active connections with user information
  const activeConnections = new Map<string, {
    ws: WebSocket;
    userId: string;
    gameRoomId?: string;
    isSpectator?: boolean;
  }>();
  
  // Store game rooms with active players
  const activeGameRooms = new Map<string, {
    participants: Set<string>;
    spectators: Set<string>;
    gameState?: any;
  }>();

  wss.on('connection', (ws, req) => {
    console.log('WebSocket connection established');
    
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'authenticate':
            await handleAuthentication(ws, message);
            break;
            
          case 'join_room':
            await handleJoinRoom(ws, message);
            break;
            
          case 'leave_room':
            await handleLeaveRoom(ws, message);
            break;
            
          case 'ready_toggle':
            await handleReadyToggle(ws, message);
            break;
            
          case 'game_action':
            await handleGameAction(ws, message);
            break;
            
          case 'chat_message':
            await handleChatMessage(ws, message);
            break;
            
          case 'spectate_game':
            await handleSpectateGame(ws, message);
            break;
            
          case 'friend_request':
            await handleFriendRequest(ws, message);
            break;
            
          case 'friend_response':
            await handleFriendResponse(ws, message);
            break;
            
          default:
            ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      handleDisconnection(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      handleDisconnection(ws);
    });
  });

  // WebSocket message handlers
  async function handleAuthentication(ws: WebSocket, message: any) {
    try {
      const { userId } = message;
      if (!userId) {
        ws.send(JSON.stringify({ type: 'auth_error', message: 'User ID required' }));
        return;
      }

      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        ws.send(JSON.stringify({ type: 'auth_error', message: 'User not found' }));
        return;
      }

      // Store connection
      const connectionId = generateConnectionId();
      activeConnections.set(connectionId, { ws, userId });
      
      ws.send(JSON.stringify({ 
        type: 'authenticated', 
        connectionId,
        user 
      }));
      
    } catch (error) {
      console.error('Authentication error:', error);
      ws.send(JSON.stringify({ type: 'auth_error', message: 'Authentication failed' }));
    }
  }

  async function handleJoinRoom(ws: WebSocket, message: any) {
    try {
      const connection = findConnection(ws);
      if (!connection) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
        return;
      }

      const { gameRoomId } = message;
      
      // Join game room in database
      await storage.joinGameRoom(connection.userId, gameRoomId);
      
      // Update connection
      connection.gameRoomId = gameRoomId;
      
      // Add to active game room
      if (!activeGameRooms.has(gameRoomId)) {
        activeGameRooms.set(gameRoomId, {
          participants: new Set(),
          spectators: new Set()
        });
      }
      activeGameRooms.get(gameRoomId)!.participants.add(connection.userId);
      
      // Broadcast room update to all participants
      await broadcastToRoom(gameRoomId, {
        type: 'player_joined',
        userId: connection.userId,
        gameRoomId
      });
      
      ws.send(JSON.stringify({ type: 'room_joined', gameRoomId }));
      
    } catch (error) {
      console.error('Join room error:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to join room' }));
    }
  }

  async function handleLeaveRoom(ws: WebSocket, message: any) {
    try {
      const connection = findConnection(ws);
      if (!connection || !connection.gameRoomId) return;

      const gameRoomId = connection.gameRoomId;
      
      // Remove from active game room
      const room = activeGameRooms.get(gameRoomId);
      if (room) {
        room.participants.delete(connection.userId);
        room.spectators.delete(connection.userId);
        
        if (room.participants.size === 0 && room.spectators.size === 0) {
          activeGameRooms.delete(gameRoomId);
        }
      }
      
      // Update database
      await storage.leaveGameRoom(connection.userId, gameRoomId);
      
      // Broadcast to remaining participants
      await broadcastToRoom(gameRoomId, {
        type: 'player_left',
        userId: connection.userId,
        gameRoomId
      });
      
      connection.gameRoomId = undefined;
      ws.send(JSON.stringify({ type: 'room_left', gameRoomId }));
      
    } catch (error) {
      console.error('Leave room error:', error);
    }
  }

  async function handleChatMessage(ws: WebSocket, message: any) {
    try {
      const connection = findConnection(ws);
      if (!connection) return;

      const { content, gameRoomId } = message;
      
      // Save chat message to database
      const chatMessage = await storage.addChatMessage({
        senderId: connection.userId,
        gameRoomId: gameRoomId || null,
        content,
        type: 'message'
      });
      
      // Broadcast to appropriate audience
      if (gameRoomId) {
        await broadcastToRoom(gameRoomId, {
          type: 'chat_message',
          message: chatMessage
        });
      } else {
        // Global chat - broadcast to all connected users
        broadcastToAll({
          type: 'chat_message',
          message: chatMessage
        });
      }
      
    } catch (error) {
      console.error('Chat message error:', error);
    }
  }

  async function handleGameAction(ws: WebSocket, message: any) {
    try {
      const connection = findConnection(ws);
      if (!connection || !connection.gameRoomId) return;

      const { action, data } = message;
      const gameRoomId = connection.gameRoomId;
      
      // Update game state in database and memory
      await storage.updateGameState(gameRoomId, { action, data, playerId: connection.userId });
      
      // Broadcast action to all room participants
      await broadcastToRoom(gameRoomId, {
        type: 'game_action',
        action,
        data,
        playerId: connection.userId
      });
      
    } catch (error) {
      console.error('Game action error:', error);
    }
  }

  // Helper functions
  function findConnection(ws: WebSocket) {
    for (const [id, connection] of Array.from(activeConnections)) {
      if (connection.ws === ws) return connection;
    }
    return null;
  }

  function generateConnectionId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  async function broadcastToRoom(gameRoomId: string, message: any) {
    const room = activeGameRooms.get(gameRoomId);
    if (!room) return;

    const allUsers = new Set([...Array.from(room.participants), ...Array.from(room.spectators)]);
    
    for (const [id, connection] of Array.from(activeConnections)) {
      if (allUsers.has(connection.userId) && connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(JSON.stringify(message));
      }
    }
  }

  function broadcastToAll(message: any) {
    for (const [id, connection] of Array.from(activeConnections)) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(JSON.stringify(message));
      }
    }
  }

  function handleDisconnection(ws: WebSocket) {
    const connection = findConnection(ws);
    if (connection) {
      // Remove from active game room if in one
      if (connection.gameRoomId) {
        const room = activeGameRooms.get(connection.gameRoomId);
        if (room) {
          room.participants.delete(connection.userId);
          room.spectators.delete(connection.userId);
          
          // Broadcast disconnection
          broadcastToRoom(connection.gameRoomId, {
            type: 'player_disconnected',
            userId: connection.userId
          });
        }
      }
      
      // Remove connection
      for (const [id, conn] of Array.from(activeConnections)) {
        if (conn.ws === ws) {
          activeConnections.delete(id);
          break;
        }
      }
    }
  }

  // Additional handlers for friend system, spectating, etc.
  async function handleSpectateGame(ws: WebSocket, message: any) {
    // Implementation for spectator mode
  }

  async function handleFriendRequest(ws: WebSocket, message: any) {
    // Implementation for friend requests
  }

  async function handleFriendResponse(ws: WebSocket, message: any) {
    // Implementation for friend request responses
  }

  async function handleReadyToggle(ws: WebSocket, message: any) {
    // Implementation for ready state toggling
  }

  return httpServer;
}