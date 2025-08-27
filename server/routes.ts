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

  // Betting Game Room API Routes
  // Get available lobbies for a specific stake
  app.get('/api/game-rooms/lobbies/:betAmount', isAuthenticated, async (req: any, res) => {
    try {
      const betAmount = parseInt(req.params.betAmount);
      const lobbies = await storage.getPublishedLobbiesByStake(betAmount);
      res.json(lobbies);
    } catch (error) {
      console.error("Error fetching lobbies:", error);
      res.status(500).json({ message: "Failed to fetch lobbies" });
    }
  });

  // Get ALL available lobbies (for new consolidated view) - PUBLIC endpoint
  app.get('/api/game-rooms/all-lobbies', async (req: any, res) => {
    try {
      const allLobbies = await storage.getAllPublishedLobbies();
      res.json(allLobbies);
    } catch (error) {
      console.error("Error fetching all lobbies:", error);
      res.status(500).json({ message: "Failed to fetch lobbies" });
    }
  });

  // Create a new crown-managed lobby
  app.post('/api/game-rooms/create-lobby', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { betAmount, maxPlayers = 4, rounds = 9, isPrivate = true } = req.body;
      
      // Check if user has enough coins for non-free games
      if (betAmount > 0) {
        const user = await storage.getUser(userId);
        if (!user || (user.currency || 0) < betAmount) {
          return res.status(400).json({ message: "Insufficient coins" });
        }
      }
      
      // Create new crown-managed lobby
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const gameRoom = await storage.createBettingRoom({
        code,
        hostId: userId,
        betAmount,
        maxPlayers,
        settings: { rounds, mode: 'online' }
      });
      
      // Creator automatically joins and gets crown
      await storage.joinGameRoom(gameRoom.id, userId, betAmount);
      
      // Broadcast new lobby creation to all connected clients
      broadcastToAll({
        type: 'lobby_updated',
        action: 'lobby_created',
        roomCode: gameRoom.code
      });
      
      res.json({ code: gameRoom.code, room: gameRoom });
    } catch (error) {
      console.error("Error creating lobby:", error);
      res.status(500).json({ message: "Failed to create lobby" });
    }
  });

  // Join a specific lobby by code
  app.post('/api/game-rooms/join-lobby', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { roomCode, betAmount } = req.body;
      
      // Check if user has enough coins for non-free games
      if (betAmount > 0) {
        const user = await storage.getUser(userId);
        if (!user || (user.currency || 0) < betAmount) {
          return res.status(400).json({ message: "Insufficient coins" });
        }
      }
      
      // Get room by code
      const room = await storage.getGameRoom(roomCode);
      if (!room) {
        return res.status(404).json({ message: "Lobby not found" });
      }
      
      // Check if room is published and has space
      if (!room.isPublished && room.isPrivate) {
        return res.status(403).json({ message: "This lobby is private" });
      }
      
      // Join the room
      await storage.joinGameRoom(room.id, userId, betAmount);
      
      // Broadcast lobby update to all connected clients
      broadcastToAll({
        type: 'lobby_updated',
        action: 'player_joined',
        roomCode: room.code
      });
      
      res.json({ code: room.code, room });
    } catch (error) {
      console.error("Error joining lobby:", error);
      res.status(500).json({ message: "Failed to join lobby" });
    }
  });

  app.post('/api/game-rooms/join-betting', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { betAmount } = req.body;
      
      // Check if user has enough coins for non-free games
      if (betAmount > 0) {
        const user = await storage.getUser(userId);
        if (!user || (user.currency || 0) < betAmount) {
          return res.status(400).json({ message: "Insufficient coins" });
        }
      }
      
      // Look for existing published rooms with same bet amount that have space
      const availableLobbies = await storage.getPublishedLobbiesByStake(betAmount);
      const availableRoom = availableLobbies.find(room => 
        room.status === 'waiting' && 
        room.currentPlayers < room.maxPlayers &&
        !room.isPrivate
      );
      
      if (availableRoom) {
        // Join existing published room
        await storage.joinGameRoom(availableRoom.id, userId, betAmount);
        res.json({ code: availableRoom.code, room: availableRoom });
      } else {
        // Create new crown-managed lobby (initially private)
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const gameRoom = await storage.createBettingRoom({
          code,
          hostId: userId,
          betAmount,
          maxPlayers: 4,
          settings: { rounds: 9, mode: 'online' }
        });
        
        // Host automatically joins with their bet
        await storage.joinGameRoom(gameRoom.id, userId, betAmount);
        res.json({ code: gameRoom.code, room: gameRoom });
      }
    } catch (error) {
      console.error("Error joining betting room:", error);
      res.status(500).json({ message: "Failed to join betting room" });
    }
  });

  // Update room settings via HTTP (as fallback to WebSocket)
  app.patch('/api/game-rooms/:roomCode/settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { roomCode } = req.params;
      const { maxPlayers, settings } = req.body;
      
      // Get the game room by code (consistent with other endpoints)
      const gameRoom = await storage.getGameRoom(roomCode);
      if (!gameRoom) {
        return res.status(404).json({ message: "Room not found" });
      }
      
      // Only crown holder can update settings
      if (gameRoom.crownHolderId !== userId) {
        return res.status(403).json({ message: "Only the crown holder can update room settings" });
      }
      
      // Check if settings are locked
      if (gameRoom.settingsLocked) {
        return res.status(403).json({ message: "Settings are locked after lobby is published" });
      }
      
      // Update the room
      const updateData: any = {};
      if (maxPlayers !== undefined) updateData.maxPlayers = maxPlayers;
      if (settings !== undefined) updateData.settings = { ...gameRoom.settings, ...settings };
      
      await storage.updateGameRoomById(gameRoom.id, updateData);
      
      // Get updated room data
      const updatedRoom = await storage.getGameRoomById(gameRoom.id);
      res.json({ success: true, room: updatedRoom });
    } catch (error) {
      console.error("Error updating room settings:", error);
      res.status(500).json({ message: "Failed to update room settings" });
    }
  });

  // Update user ready status in game room with auto-start logic
  app.patch('/api/game-rooms/:gameRoomId/ready', isAuthenticated, async (req: any, res) => {
    try {
      const { gameRoomId } = req.params;
      const { isReady } = req.body;
      const userId = req.user.claims.sub;
      
      await storage.updateParticipantReady(gameRoomId, userId, isReady);
      
      // Check for auto-start (same logic as WebSocket)
      const gameRoom = await storage.getGameRoomById(gameRoomId);
      const allParticipants = await storage.getGameParticipants(gameRoomId);
      const activeParticipants = allParticipants.filter(p => !p.leftAt);
      const allPlayersReady = activeParticipants.length >= 2 && activeParticipants.every(p => p.isReady);
      
      if (allPlayersReady && gameRoom && gameRoom.status === 'waiting') {
        console.log(`🚀 HTTP Auto-starting game for room ${gameRoom.code} - all ${activeParticipants.length} players ready`);
        
        // Update room status to 'active'
        await storage.updateGameRoom(gameRoom.code, { status: 'active' });

        // Deduct coins from all participants now that game is starting
        for (const participant of activeParticipants) {
          if (participant.betPaid > 0) {
            try {
              await storage.spendCurrency(participant.userId, participant.betPaid);
            } catch (error) {
              console.error(`Failed to deduct coins for user ${participant.userId}:`, error);
            }
          }
        }

        // Remove from Active Lobbies since game started
        broadcastToAll({
          type: 'lobby_updated',
          action: 'lobby_deleted', 
          roomCode: gameRoom.code
        });
        
        res.json({ 
          success: true, 
          allPlayersReady: true,
          gameStarted: true,
          gameSettings: { 
            rounds: gameRoom.settings?.rounds || 9, 
            mode: 'online', 
            playerCount: activeParticipants.length 
          }
        });
        return;
      }
      
      res.json({ 
        success: true, 
        allPlayersReady,
        gameStarted: false
      });
    } catch (error) {
      console.error('Update ready error:', error);
      res.status(500).json({ error: 'Failed to update ready status' });
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
        players: [],
        maxPlayers: maxPlayers || 4,
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

      // Get participants with ready status from gameParticipants table
      const participants = await storage.getGameRoomParticipants(gameRoom.id);
      
      // Force no cache for this response
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      res.json({
        ...gameRoom,
        players: participants
      });
    } catch (error) {
      console.error("Error fetching game room:", error);
      res.status(500).json({ message: "Failed to fetch game room" });
    }
  });

  // REMOVED DUPLICATE POST ENDPOINT - Using PATCH above instead

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
        console.log('📨 WebSocket message received:', message.type, JSON.stringify(message, null, 2));
        
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
            
          case 'start_game':
            await handleStartGame(ws, message);
            break;

          // Crown-based lobby management
          case 'publish_lobby':
            await handlePublishLobby(ws, message);
            break;
            
          case 'transfer_crown':
            await handleTransferCrown(ws, message);
            break;
            
          case 'update_room_settings':
            await handleUpdateRoomSettings(ws, message);
            break;
            
          case 'lobby_activity':
            await handleLobbyActivity(ws, message);
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
      console.log('Handling authentication:', message);
      const { userId } = message;
      if (!userId) {
        console.log('No userId provided');
        ws.send(JSON.stringify({ type: 'auth_error', message: 'User ID required' }));
        return;
      }

      console.log('Looking up user:', userId);
      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        console.log('User not found:', userId);
        ws.send(JSON.stringify({ type: 'auth_error', message: 'User not found' }));
        return;
      }

      // Store connection
      const connectionId = generateConnectionId();
      activeConnections.set(connectionId, { ws, userId });
      
      console.log('User authenticated successfully:', userId, 'connectionId:', connectionId);
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
      console.log('Handling join room:', message);
      const connection = findConnection(ws);
      if (!connection) {
        console.log('User not authenticated for join room');
        ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
        return;
      }

      const { gameRoomId: roomCode } = message;
      
      // Get room by code to get the actual room ID
      const gameRoom = await storage.getGameRoom(roomCode);
      if (!gameRoom) {
        ws.send(JSON.stringify({ type: 'error', message: 'Game room not found' }));
        return;
      }
      
      // Join game room in database with correct parameter order
      const participant = await storage.joinGameRoom(gameRoom.id, connection.userId, 0);
      
      // Update connection with room ID
      connection.gameRoomId = gameRoom.id;
      
      // Add to active game room
      if (!activeGameRooms.has(gameRoom.id)) {
        activeGameRooms.set(gameRoom.id, {
          participants: new Set(),
          spectators: new Set(),
          gameState: null
        });
      }
      activeGameRooms.get(gameRoom.id)!.participants.add(connection.userId);
      
      // Get user info for broadcasting
      const user = await storage.getUser(connection.userId);
      const playerName = user?.firstName || user?.email?.split('@')[0] || 'Player';
      
      // Broadcast room update to all participants
      await broadcastToRoom(gameRoom.id, {
        type: 'player_joined',
        userId: connection.userId,
        playerName,
        gameRoomId: roomCode,
        player: {
          id: connection.userId,
          name: playerName,
          level: user?.level || 1,
          isReady: participant.isReady || false
        }
      });
      
      // Send current room state to joining player
      const allParticipants = await storage.getGameParticipants(gameRoom.id);
      const connectedPlayers: { [key: string]: any } = {};
      
      for (const p of allParticipants) {
        const pUser = await storage.getUser(p.userId);
        const pName = pUser?.firstName || pUser?.email?.split('@')[0] || 'Player';
        connectedPlayers[p.userId] = {
          id: p.userId,
          name: pName,
          level: pUser?.level || 1,
          isReady: p.isReady || false
        };
      }
      
      ws.send(JSON.stringify({ 
        type: 'room_joined', 
        gameRoomId: roomCode,
        gameState: {
          gameRoomId: roomCode,
          hostId: gameRoom.hostId,
          isHost: connection.userId === gameRoom.hostId,
          connectedPlayers,
          waitingForPlayers: true,
          allPlayersReady: allParticipants.every(p => p.isReady)
        }
      }));
      
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
      
      // Get room details for the broadcast
      const gameRoom = await storage.getGameRoomById(gameRoomId);
      
      // Check if room is now empty and should be deleted
      const remainingParticipants = await storage.getGameParticipants(gameRoomId);
      const activeParticipants = remainingParticipants.filter(p => !p.leftAt);
      
      if (activeParticipants.length === 0) {
        // Room is empty, delete it
        console.log(`🗑️ Deleting empty room: ${gameRoom?.code || gameRoomId}`);
        await storage.deleteGameRoom(gameRoomId);
        
        // Broadcast to all clients that the lobby was removed
        broadcastToAll({
          type: 'lobby_updated',
          action: 'lobby_deleted',
          roomCode: gameRoom?.code || gameRoomId
        });
      } else {
        // Broadcast to remaining participants
        await broadcastToRoom(gameRoomId, {
          type: 'player_left',
          userId: connection.userId,
          gameRoomId
        });
        
        // Also broadcast lobby update to all clients (player count changed)
        broadcastToAll({
          type: 'lobby_updated',
          action: 'player_left',
          roomCode: gameRoom?.code || gameRoomId
        });
      }
      
      connection.gameRoomId = undefined;
      ws.send(JSON.stringify({ type: 'room_left', gameRoomId }));
      
    } catch (error) {
      console.error('Leave room error:', error);
    }
  }

  async function handleReadyToggle(ws: WebSocket, message: any) {
    try {
      const connection = findConnection(ws);
      if (!connection || !connection.gameRoomId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not in a game room' }));
        return;
      }

      const { isReady } = message;
      
      // Update participant ready status
      await storage.updateParticipantReady(connection.gameRoomId, connection.userId, isReady);
      
      // Get the room details using room ID
      const gameRoom = await storage.getGameRoomById(connection.gameRoomId);
      const allParticipants = await storage.getGameParticipants(connection.gameRoomId);
      const allPlayersReady = allParticipants.length >= 2 && allParticipants.every(p => p.isReady);
      
      // Broadcast the ready status change to all participants
      await broadcastToRoom(connection.gameRoomId, {
        type: 'player_ready_changed',
        userId: connection.userId,
        isReady,
        allPlayersReady
      });

      // Auto-start the game if all players are ready
      if (allPlayersReady && gameRoom) {
        console.log(`🚀 Auto-starting game for room ${gameRoom.code} - all ${allParticipants.length} players ready`);
        
        // Update room status to 'active'
        await storage.updateGameRoom(gameRoom.code, { status: 'active' });

        // Deduct coins from all participants now that game is starting
        for (const participant of allParticipants) {
          if (participant.betPaid > 0) {
            try {
              await storage.spendCurrency(participant.userId, participant.betPaid);
            } catch (error) {
              console.error(`Failed to deduct coins for user ${participant.userId}:`, error);
            }
          }
        }

        // Auto-start the game via WebSocket
        await broadcastToRoom(connection.gameRoomId, {
          type: 'start_game',
          gameRoomId: connection.gameRoomId,
          settings: { rounds: gameRoom.settings?.rounds || 9, mode: 'online', playerCount: allParticipants.length }
        });
        
        // Also remove from Active Lobbies since game started
        broadcastToAll({
          type: 'lobby_updated',
          action: 'lobby_deleted', 
          roomCode: gameRoom.code
        });
      }
      
    } catch (error) {
      console.error('Ready toggle error:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to toggle ready status' }));
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

  // Crown-based lobby management handlers
  async function handlePublishLobby(ws: WebSocket, message: any) {
    try {
      const connection = findConnection(ws);
      if (!connection || !connection.gameRoomId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not in a game room' }));
        return;
      }

      const { isPrivate = false } = message;
      const gameRoom = await storage.getGameRoomById(connection.gameRoomId);
      
      // Only crown holder can publish lobby
      if (!gameRoom || gameRoom.crownHolderId !== connection.userId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Only the crown holder can publish the lobby' }));
        return;
      }

      // Already published
      if (gameRoom.isPublished) {
        ws.send(JSON.stringify({ type: 'error', message: 'Lobby is already published' }));
        return;
      }

      // Publish the lobby
      await storage.publishLobby(connection.gameRoomId, isPrivate);
      
      // Update room activity
      await storage.updateRoomActivity(connection.gameRoomId);

      // Broadcast lobby published event
      await broadcastToRoom(connection.gameRoomId, {
        type: 'lobby_published',
        gameRoomId: connection.gameRoomId,
        isPrivate,
        settingsLocked: true,
        publishedBy: connection.userId
      });

      ws.send(JSON.stringify({ 
        type: 'lobby_publish_success', 
        message: isPrivate ? 'Lobby published as private' : 'Lobby published publicly' 
      }));
      
    } catch (error) {
      console.error('Publish lobby error:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to publish lobby' }));
    }
  }

  async function handleTransferCrown(ws: WebSocket, message: any) {
    try {
      const connection = findConnection(ws);
      if (!connection || !connection.gameRoomId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not in a game room' }));
        return;
      }

      const { targetUserId } = message;
      const gameRoom = await storage.getGameRoomById(connection.gameRoomId);
      
      // Only crown holder can transfer crown
      if (!gameRoom || gameRoom.crownHolderId !== connection.userId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Only the crown holder can transfer the crown' }));
        return;
      }

      // Check if target user is in the room
      const participants = await storage.getGameParticipants(connection.gameRoomId);
      const targetParticipant = participants.find(p => p.userId === targetUserId);
      
      if (!targetParticipant) {
        ws.send(JSON.stringify({ type: 'error', message: 'Target player is not in this lobby' }));
        return;
      }

      // Transfer the crown
      await storage.transferCrown(connection.gameRoomId, targetUserId);

      // Broadcast crown transfer event
      await broadcastToRoom(connection.gameRoomId, {
        type: 'crown_transferred',
        gameRoomId: connection.gameRoomId,
        previousCrownHolder: connection.userId,
        newCrownHolder: targetUserId
      });

      ws.send(JSON.stringify({ 
        type: 'crown_transfer_success', 
        message: 'Crown transferred successfully' 
      }));
      
    } catch (error) {
      console.error('Transfer crown error:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to transfer crown' }));
    }
  }

  async function handleUpdateRoomSettings(ws: WebSocket, message: any) {
    try {
      const connection = findConnection(ws);
      if (!connection || !connection.gameRoomId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not in a game room' }));
        return;
      }

      const { settings } = message;
      const gameRoom = await storage.getGameRoomById(connection.gameRoomId);
      
      // Only crown holder can update settings
      if (!gameRoom || gameRoom.crownHolderId !== connection.userId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Only the crown holder can update room settings' }));
        return;
      }

      // Check if settings are locked (published lobby)
      if (gameRoom.settingsLocked) {
        ws.send(JSON.stringify({ type: 'error', message: 'Settings are locked after lobby is published' }));
        return;
      }

      // Update settings
      await storage.updateGameRoomById(connection.gameRoomId, { settings });
      
      // Update room activity
      await storage.updateRoomActivity(connection.gameRoomId);

      // Broadcast settings update
      await broadcastToRoom(connection.gameRoomId, {
        type: 'room_settings_updated',
        gameRoomId: connection.gameRoomId,
        settings,
        updatedBy: connection.userId
      });

      ws.send(JSON.stringify({ 
        type: 'settings_update_success', 
        message: 'Room settings updated successfully' 
      }));
      
    } catch (error) {
      console.error('Update room settings error:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to update room settings' }));
    }
  }

  async function handleLobbyActivity(ws: WebSocket, message: any) {
    try {
      const connection = findConnection(ws);
      if (!connection || !connection.gameRoomId) {
        return; // Silently ignore if not in room
      }

      const gameRoom = await storage.getGameRoomById(connection.gameRoomId);
      
      // Only track activity for crown holder
      if (gameRoom && gameRoom.crownHolderId === connection.userId) {
        // Update last activity timestamp
        await storage.updateRoomActivity(connection.gameRoomId);
        
        // Clear idle warning if it was set
        if (gameRoom.idleWarningAt) {
          await storage.updateGameRoomById(connection.gameRoomId, { idleWarningAt: null });
        }
      }
      
    } catch (error) {
      console.error('Lobby activity error:', error);
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

  async function handleDisconnection(ws: WebSocket) {
    const connection = findConnection(ws);
    if (connection) {
      // Handle room cleanup when user disconnects
      if (connection.gameRoomId && connection.userId) {
        try {
          console.log(`🔌 Cleaning up disconnected user ${connection.userId} from room ${connection.gameRoomId}`);
          
          // Mark user as left in database
          await storage.leaveGameRoom(connection.userId, connection.gameRoomId);
          
          // Remove from active game room
          const room = activeGameRooms.get(connection.gameRoomId);
          if (room) {
            room.participants.delete(connection.userId);
            room.spectators.delete(connection.userId);
            
            if (room.participants.size === 0 && room.spectators.size === 0) {
              activeGameRooms.delete(connection.gameRoomId);
            }
          }
          
          // Check if room is now empty and should be deleted
          const remainingParticipants = await storage.getGameParticipants(connection.gameRoomId);
          const activeParticipants = remainingParticipants.filter(p => !p.leftAt);
          
          if (activeParticipants.length === 0) {
            // Get room details for broadcast
            const gameRoom = await storage.getGameRoomById(connection.gameRoomId);
            console.log(`🗑️ Deleting empty room after disconnect: ${gameRoom?.code || connection.gameRoomId}`);
            await storage.deleteGameRoom(connection.gameRoomId);
            
            // Broadcast lobby deletion to all clients
            broadcastToAll({
              type: 'lobby_updated',
              action: 'lobby_deleted',
              roomCode: gameRoom?.code || connection.gameRoomId
            });
          } else {
            // Get room details for broadcast
            const gameRoom = await storage.getGameRoomById(connection.gameRoomId);
            
            // Broadcast player left to remaining participants
            await broadcastToRoom(connection.gameRoomId, {
              type: 'player_left',
              userId: connection.userId,
              gameRoomId: connection.gameRoomId
            });
            
            // Broadcast lobby update to all clients
            broadcastToAll({
              type: 'lobby_updated',
              action: 'player_left',
              roomCode: gameRoom?.code || connection.gameRoomId
            });
          }
        } catch (error) {
          console.error('Error cleaning up disconnected user:', error);
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

  async function handleStartGame(ws: WebSocket, message: any) {
    try {
      const connection = findConnection(ws);
      if (!connection || !connection.gameRoomId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not in a game room' }));
        return;
      }

      const { gameRoomId, settings } = message;
      if (!gameRoomId || !settings) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid start game request' }));
        return;
      }

      // Get the game room details
      const room = await storage.getGameRoom(gameRoomId);
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', message: 'Game room not found' }));
        return;
      }

      // Only host can start the game
      if (room.hostId !== connection.userId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Only host can start the game' }));
        return;
      }

      // Get all participants and deduct bet amounts
      const participants = await storage.getGameParticipants(room.id);
      for (const participant of participants) {
        if (participant.betPaid > 0) {
          try {
            await storage.spendCurrency(participant.userId, participant.betPaid);
          } catch (error) {
            console.error(`Failed to deduct coins for user ${participant.userId}:`, error);
            // Continue with other participants, don't fail the entire start
          }
        }
      }

      // Update room status to 'active'
      await storage.updateGameRoom(room.code, { status: 'active' });

      // Broadcast game start to all room participants
      await broadcastToRoom(room.id, {
        type: 'start_game',
        gameRoomId: room.id,
        settings
      });
      
      // Broadcast lobby removal to all connected clients (room no longer available)
      broadcastToAll({
        type: 'lobby_updated',
        action: 'game_started',
        roomCode: room.code
      });

    } catch (error) {
      console.error('Start game error:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to start game' }));
    }
  }

  // Idle detection system for crown holders
  setInterval(async () => {
    try {
      // Get all active rooms with crown holders
      const activeRooms = await storage.getActiveRoomsWithCrowns();
      const now = new Date();
      
      for (const room of activeRooms) {
        const timeSinceActivity = now.getTime() - new Date(room.lastActivityAt).getTime();
        const fourMinutesMs = 4 * 60 * 1000;
        const fiveMinutesMs = 5 * 60 * 1000;
        
        // Check if crown holder has been idle for more than 4 minutes
        if (timeSinceActivity > fourMinutesMs && !room.idleWarningAt) {
          // Send idle warning
          await storage.setIdleWarning(room.id);
          
          await broadcastToRoom(room.id, {
            type: 'idle_warning',
            crownHolderId: room.crownHolderId,
            message: 'Crown holder has been idle for 4 minutes. Please acknowledge or crown will be transferred.',
            timeRemaining: 60000 // 1 minute remaining
          });
        }
        // Check if crown holder should be removed (5 minutes total idle time with warning)
        else if (room.idleWarningAt && timeSinceActivity > fiveMinutesMs) {
          // Get room participants to find next crown holder
          const participants = await storage.getGameParticipants(room.id);
          const activePlayers = participants.filter(p => p.userId !== room.crownHolderId);
          
          if (activePlayers.length > 0) {
            // Transfer crown to next player
            const newCrownHolder = activePlayers[0];
            await storage.transferCrown(room.id, newCrownHolder.userId);
            
            await broadcastToRoom(room.id, {
              type: 'crown_transferred_idle',
              previousCrownHolder: room.crownHolderId,
              newCrownHolder: newCrownHolder.userId,
              reason: 'Previous crown holder was idle for too long'
            });
          } else {
            // No other players, close the room
            await storage.updateGameRoomById(room.id, { status: 'closed' });
            
            await broadcastToRoom(room.id, {
              type: 'room_closed',
              reason: 'Crown holder was idle and no other players remain'
            });
          }
        }
      }
    } catch (error) {
      console.error('Idle detection error:', error);
    }
  }, 60000); // Check every minute

  return httpServer;
}