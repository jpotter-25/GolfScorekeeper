import {
  users,
  gameStats,
  gameHistory,
  achievements,
  userAchievements,
  cosmetics,
  userCosmetics,
  userSettings,
  gameRooms,
  gameParticipants,
  friendships,
  chatMessages,
  tournaments,
  tournamentParticipants,
  tournamentMatches,
  gameSpectators,
  socialPosts,
  socialPostLikes,
  type User,
  type UpsertUser,
  type GameStats,
  type GameHistory,
  type Achievement,
  type UserAchievement,
  type Cosmetic,
  type UserCosmetic,
  type UserSettings,
  type GameRoom,
  type GameParticipant,
  type Friendship,
  type ChatMessage,
  type Tournament,
  type TournamentParticipant,
  type TournamentMatch,
  type GameSpectator,
  type SocialPost,
  type SocialPostLike,
  type InsertGameStats,
  type InsertGameHistory,
  type InsertUserAchievement,
  type InsertUserCosmetic,
  type InsertUserSettings,
  type UpdateUserSettings,
  type InsertGameRoom,
  type InsertGameParticipant,
  type InsertFriendship,
  type InsertChatMessage,
  type InsertTournament,
  type InsertTournamentParticipant,
  type InsertTournamentMatch,
  type InsertGameSpectator,
  type InsertSocialPost,
  type InsertSocialPostLike,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Game progression operations
  getUserStats(userId: string): Promise<GameStats | undefined>;
  updateUserStats(userId: string, stats: Partial<InsertGameStats>): Promise<GameStats>;
  addGameToHistory(gameData: InsertGameHistory): Promise<GameHistory>;
  getUserGameHistory(userId: string, limit?: number): Promise<GameHistory[]>;
  
  // Achievement operations
  getUserAchievements(userId: string): Promise<UserAchievement[]>;
  unlockAchievement(data: InsertUserAchievement): Promise<UserAchievement>;
  getAllAchievements(): Promise<Achievement[]>;
  
  // Cosmetic operations
  getUserCosmetics(userId: string): Promise<UserCosmetic[]>;
  purchaseCosmetic(data: InsertUserCosmetic): Promise<UserCosmetic>;
  equipCosmetic(userId: string, cosmeticId: string): Promise<void>;
  getAllCosmetics(): Promise<Cosmetic[]>;
  
  // Currency and XP operations
  addCurrency(userId: string, amount: number): Promise<User>;
  spendCurrency(userId: string, amount: number): Promise<User>;
  addExperience(userId: string, amount: number): Promise<User>;
  
  // Settings operations
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  upsertUserSettings(userId: string, settings: UpdateUserSettings): Promise<UserSettings>;
  
  // Game room operations
  createGameRoom(room: InsertGameRoom): Promise<GameRoom>;
  createBettingRoom(room: any): Promise<GameRoom>;
  getBettingRoomsByAmount(betAmount: number): Promise<any[]>;
  getGameRoom(code: string): Promise<GameRoom | undefined>;
  getGameRooms(): Promise<GameRoom[]>;
  getAllPublicRooms(): Promise<any[]>;
  updateGameRoom(code: string, updates: Partial<GameRoom>): Promise<GameRoom | undefined>;
  joinGameRoom(roomId: string, userId: string, betAmount?: number): Promise<GameParticipant>;
  leaveGameRoom(userId: string, gameRoomId: string): Promise<void>;
  setPlayerReady(roomId: string, userId: string, isReady: boolean): Promise<void>;
  getGameRoomParticipants(roomId: string): Promise<any[]>;
  updateGameState(gameRoomId: string, gameState: any): Promise<void>;
  
  // Friend system operations
  sendFriendRequest(requesterId: string, addresseeId: string): Promise<Friendship>;
  respondToFriendRequest(friendshipId: string, status: 'accepted' | 'declined'): Promise<Friendship>;
  getFriends(userId: string): Promise<User[]>;
  getFriendRequests(userId: string): Promise<Friendship[]>;
  findUserByFriendCode(friendCode: string): Promise<User | undefined>;
  
  // Chat operations
  addChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatHistory(gameRoomId?: string, limit?: number): Promise<ChatMessage[]>;
  
  // Tournament operations
  createTournament(tournament: InsertTournament): Promise<Tournament>;
  joinTournament(tournamentId: string, userId: string): Promise<TournamentParticipant>;
  leaveTournament(tournamentId: string, userId: string): Promise<void>;
  getTournaments(status?: string): Promise<Tournament[]>;
  getTournamentParticipants(tournamentId: string): Promise<TournamentParticipant[]>;
  
  // Spectator operations
  addSpectator(gameRoomId: string, userId: string): Promise<GameSpectator>;
  removeSpectator(gameRoomId: string, userId: string): Promise<void>;
  getSpectators(gameRoomId: string): Promise<User[]>;
  
  // Social sharing operations
  createSocialPost(post: InsertSocialPost): Promise<SocialPost>;
  likeSocialPost(postId: string, userId: string): Promise<SocialPostLike>;
  unlikeSocialPost(postId: string, userId: string): Promise<void>;
  getSocialFeed(userId: string, limit?: number): Promise<SocialPost[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Generate unique friend code if not provided
    if (!userData.friendCode) {
      userData.friendCode = await this.generateUniqueFriendCode();
    }
    
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    
    // Check if user has default cosmetics, if not, give them
    const userCosmeticsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(userCosmetics)
      .where(eq(userCosmetics.userId, user.id));
    
    if (userCosmeticsCount[0].count === 0) {
      // Give user default cosmetics (all free ones)
      const freeCosmetics = await db
        .select()
        .from(cosmetics)
        .where(eq(cosmetics.cost, 0));
      
      for (const cosmetic of freeCosmetics) {
        await db.insert(userCosmetics).values({
          userId: user.id,
          cosmeticId: cosmetic.id,
          equipped: true // Equip all default cosmetics
        });
      }
    }
    
    return user;
  }

  // Game progression operations
  async getUserStats(userId: string): Promise<GameStats | undefined> {
    const [stats] = await db.select().from(gameStats).where(eq(gameStats.userId, userId));
    if (!stats) {
      // Create initial stats for new user
      const [newStats] = await db
        .insert(gameStats)
        .values({ userId })
        .returning();
      return newStats;
    }
    return stats;
  }

  async updateUserStats(userId: string, statsUpdate: Partial<InsertGameStats>): Promise<GameStats> {
    const [updated] = await db
      .update(gameStats)
      .set({ ...statsUpdate, updatedAt: new Date() })
      .where(eq(gameStats.userId, userId))
      .returning();
    return updated;
  }

  async addGameToHistory(gameData: InsertGameHistory): Promise<GameHistory> {
    const [history] = await db
      .insert(gameHistory)
      .values(gameData)
      .returning();
    return history;
  }

  async getUserGameHistory(userId: string, limit = 10): Promise<GameHistory[]> {
    return await db
      .select()
      .from(gameHistory)
      .where(eq(gameHistory.userId, userId))
      .orderBy(desc(gameHistory.createdAt))
      .limit(limit);
  }

  // Achievement operations
  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    return await db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId));
  }

  async unlockAchievement(data: InsertUserAchievement): Promise<UserAchievement> {
    const [achievement] = await db
      .insert(userAchievements)
      .values(data)
      .returning();
    return achievement;
  }

  async getAllAchievements(): Promise<Achievement[]> {
    return await db.select().from(achievements);
  }

  // Cosmetic operations
  async getUserCosmetics(userId: string): Promise<UserCosmetic[]> {
    return await db
      .select()
      .from(userCosmetics)
      .where(eq(userCosmetics.userId, userId));
  }

  async purchaseCosmetic(data: InsertUserCosmetic): Promise<UserCosmetic> {
    const [cosmetic] = await db
      .insert(userCosmetics)
      .values(data)
      .returning();
    return cosmetic;
  }

  async equipCosmetic(userId: string, cosmeticId: string): Promise<void> {
    // Get the cosmetic type
    const [cosmetic] = await db.select().from(cosmetics).where(eq(cosmetics.id, cosmeticId));
    if (cosmetic) {
      // First, unequip all cosmetics of the same type for this user
      await db
        .update(userCosmetics)
        .set({ equipped: false })
        .where(and(
          eq(userCosmetics.userId, userId),
          sql`${userCosmetics.cosmeticId} IN (SELECT id FROM ${cosmetics} WHERE type = ${cosmetic.type})`
        ));
      
      // Then equip the selected one
      await db
        .update(userCosmetics)
        .set({ equipped: true })
        .where(and(
          eq(userCosmetics.userId, userId),
          eq(userCosmetics.cosmeticId, cosmeticId)
        ));
    }
  }

  async getAllCosmetics(): Promise<Cosmetic[]> {
    return await db.select().from(cosmetics);
  }

  // Currency and XP operations
  async addCurrency(userId: string, amount: number): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        currency: sql`${users.currency} + ${amount}`,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async spendCurrency(userId: string, amount: number): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        currency: sql`${users.currency} - ${amount}`,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async addExperience(userId: string, amount: number): Promise<User> {
    const currentUser = await this.getUser(userId);
    if (!currentUser) throw new Error('User not found');
    
    const newExperience = (currentUser.experience || 0) + amount;
    const newLevel = Math.floor(newExperience / 100) + 1; // Simple level calculation
    
    const [user] = await db
      .update(users)
      .set({ 
        experience: newExperience,
        level: newLevel,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Settings operations
  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return settings;
  }

  async upsertUserSettings(userId: string, settingsData: UpdateUserSettings): Promise<UserSettings> {
    const [settings] = await db
      .insert(userSettings)
      .values({ userId, ...settingsData })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          ...settingsData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return settings;
  }

  // Game room operations
  async createGameRoom(roomData: InsertGameRoom): Promise<GameRoom> {
    const [room] = await db
      .insert(gameRooms)
      .values({
        ...roomData,
        players: [], // Empty array initially, players added when they join
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivityAt: new Date()
      })
      .returning();
    return room;
  }

  async createBettingRoom(roomData: any): Promise<GameRoom> {
    const [room] = await db
      .insert(gameRooms)
      .values({
        ...roomData,
        players: [], // Empty array initially, players added when they join
        prizePool: 0, // Will be updated as players join
        status: 'waiting',
        isActive: true,
        // Crown-based lobby management - creator gets crown
        crownHolderId: roomData.hostId,
        isPublished: false, // Start as unpublished (private)
        isPrivate: true,
        settingsLocked: false,
        lastActivityAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return room;
  }

  async getBettingRoomsByAmount(betAmount: number): Promise<any[]> {
    const rooms = await db
      .select({
        id: gameRooms.id,
        code: gameRooms.code,
        hostId: gameRooms.hostId,
        betAmount: gameRooms.betAmount,
        prizePool: gameRooms.prizePool,
        maxPlayers: gameRooms.maxPlayers,
        status: gameRooms.status,
        currentPlayers: sql<number>`(
          SELECT COUNT(*) 
          FROM ${gameParticipants} 
          WHERE ${gameParticipants.gameRoomId} = ${gameRooms.id}
          AND ${gameParticipants.leftAt} IS NULL
        )`
      })
      .from(gameRooms)
      .where(eq(gameRooms.betAmount, betAmount));
    return rooms;
  }

  async getGameRooms(): Promise<GameRoom[]> {
    const rooms = await db.select().from(gameRooms);
    return rooms;
  }
  
  async getAllPublicRooms(): Promise<any[]> {
    const rooms = await db
      .select({
        id: gameRooms.id,
        code: gameRooms.code,
        name: gameRooms.name,
        hostId: gameRooms.hostId,
        crownHolderName: gameRooms.crownHolderId,
        betAmount: gameRooms.betAmount,
        maxPlayers: gameRooms.maxPlayers,
        rounds: gameRooms.rounds,
        status: gameRooms.status,
        isPrivate: gameRooms.isPrivate,
        playerCount: sql<number>`(
          SELECT COUNT(*) 
          FROM ${gameParticipants} 
          WHERE ${gameParticipants.gameRoomId} = ${gameRooms.id}
          AND ${gameParticipants.leftAt} IS NULL
        )`
      })
      .from(gameRooms)
      .where(eq(gameRooms.isPublished, true));
    return rooms;
  }

  async getGameRoom(code: string): Promise<GameRoom | undefined> {
    const [room] = await db.select().from(gameRooms).where(eq(gameRooms.code, code));
    return room;
  }

  async getGameRoomById(id: string): Promise<GameRoom | undefined> {
    const [room] = await db.select().from(gameRooms).where(eq(gameRooms.id, id));
    return room;
  }

  async updateGameRoom(code: string, updates: Partial<GameRoom>): Promise<GameRoom | undefined> {
    const [room] = await db
      .update(gameRooms)
      .set(updates)
      .where(eq(gameRooms.code, code))
      .returning();
    return room;
  }

  async updateGameRoomById(roomId: string, updates: Partial<GameRoom>): Promise<GameRoom | undefined> {
    const [room] = await db
      .update(gameRooms)
      .set(updates)
      .where(eq(gameRooms.id, roomId))
      .returning();
    return room;
  }

  // Crown-based lobby management methods
  async transferCrown(roomId: string, newCrownHolderId: string): Promise<GameRoom | undefined> {
    const [room] = await db
      .update(gameRooms)
      .set({ 
        crownHolderId: newCrownHolderId,
        lastActivityAt: new Date()
      })
      .where(eq(gameRooms.id, roomId))
      .returning();
    return room;
  }

  async updateRoomActivity(roomId: string): Promise<void> {
    await db
      .update(gameRooms)
      .set({ lastActivityAt: new Date() })
      .where(eq(gameRooms.id, roomId));
  }

  async setIdleWarning(roomId: string): Promise<void> {
    await db
      .update(gameRooms)
      .set({ idleWarningAt: new Date() })
      .where(eq(gameRooms.id, roomId));
  }

  async publishLobby(roomId: string, isPrivate: boolean = false): Promise<GameRoom | undefined> {
    const [room] = await db
      .update(gameRooms)
      .set({ 
        isPublished: true,
        isPrivate,
        settingsLocked: true, // Lock settings when published
        lastActivityAt: new Date()
      })
      .where(eq(gameRooms.id, roomId))
      .returning();
    return room;
  }

  async getPublishedLobbiesByStake(betAmount: number): Promise<any[]> {
    const rooms = await db
      .select({
        id: gameRooms.id,
        code: gameRooms.code,
        hostId: gameRooms.hostId,
        crownHolderId: gameRooms.crownHolderId,
        betAmount: gameRooms.betAmount,
        prizePool: gameRooms.prizePool,
        maxPlayers: gameRooms.maxPlayers,
        settings: gameRooms.settings,
        status: gameRooms.status,
        isPrivate: gameRooms.isPrivate,
        currentPlayers: sql<number>`(
          SELECT COUNT(*) 
          FROM ${gameParticipants} 
          WHERE ${gameParticipants.gameRoomId} = ${gameRooms.id}
          AND ${gameParticipants.leftAt} IS NULL
        )`
      })
      .from(gameRooms)
      .where(and(
        eq(gameRooms.betAmount, betAmount),
        eq(gameRooms.isPublished, true),
        eq(gameRooms.status, 'waiting')
      ));
    
    // Add crown holder names
    const roomsWithNames = await Promise.all(
      rooms.map(async (room) => {
        let crownHolderName = 'Unknown';
        if (room.crownHolderId) {
          const crownHolder = await this.getUser(room.crownHolderId);
          if (crownHolder) {
            crownHolderName = crownHolder.firstName && crownHolder.lastName 
              ? `${crownHolder.firstName} ${crownHolder.lastName}`
              : crownHolder.email?.split('@')[0] || 'Player';
          }
        }
        
        return {
          ...room,
          crownHolderName,
          playerCount: room.currentPlayers,
          rounds: (room.settings as any)?.rounds || 9
        };
      })
    );
    
    return roomsWithNames;
  }

  // Alias for consistency
  async getAvailableLobbiesByStake(betAmount: number): Promise<any[]> {
    return this.getPublishedLobbiesByStake(betAmount);
  }

  // Get ALL published lobbies (for consolidated view)
  async getAllPublishedLobbies(): Promise<any[]> {
    const rooms = await db
      .select({
        id: gameRooms.id,
        code: gameRooms.code,
        hostId: gameRooms.hostId,
        crownHolderId: gameRooms.crownHolderId,
        betAmount: gameRooms.betAmount,
        prizePool: gameRooms.prizePool,
        maxPlayers: gameRooms.maxPlayers,
        settings: gameRooms.settings,
        status: gameRooms.status,
        isPrivate: gameRooms.isPrivate,
        currentPlayers: sql<number>`(
          SELECT COUNT(*) 
          FROM ${gameParticipants} 
          WHERE ${gameParticipants.gameRoomId} = ${gameRooms.id}
          AND ${gameParticipants.leftAt} IS NULL
        )`
      })
      .from(gameRooms)
      .where(and(
        eq(gameRooms.isPublished, true),
        eq(gameRooms.status, 'waiting')
      ))
      .orderBy(gameRooms.betAmount); // Sort by stake amount
    
    // Add crown holder names
    const roomsWithNames = await Promise.all(
      rooms.map(async (room) => {
        let crownHolderName = 'Unknown';
        if (room.crownHolderId) {
          const crownHolder = await this.getUser(room.crownHolderId);
          if (crownHolder) {
            crownHolderName = crownHolder.firstName && crownHolder.lastName 
              ? `${crownHolder.firstName} ${crownHolder.lastName}`
              : crownHolder.email?.split('@')[0] || 'Player';
          }
        }
        
        return {
          ...room,
          crownHolderName,
          playerCount: room.currentPlayers,
          rounds: (room.settings as any)?.rounds || 9
        };
      })
    );
    
    return roomsWithNames;
  }

  async createCrownLobby(userId: string, options: {
    betAmount: number;
    maxPlayers: number;
    rounds: number;
    isPrivate: boolean;
    settings: any;
  }): Promise<any> {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Create the game room with crown holder
    const gameRoom = await this.createBettingRoom({
      code,
      hostId: userId,
      betAmount: options.betAmount,
      maxPlayers: options.maxPlayers,
      settings: options.settings,
      crownHolderId: userId, // Creator gets the crown
      isPrivate: options.isPrivate,
      isPublished: false, // Not published initially
      settingsLocked: false,
      lastActivityAt: new Date()
    });
    
    // Host automatically joins
    await this.joinGameRoom(gameRoom.id, userId, options.betAmount);
    
    return { code: gameRoom.code, room: gameRoom };
  }

  async joinLobbyByCode(roomCode: string, userId: string, betAmount: number): Promise<any> {
    // Get room by code
    const room = await this.getGameRoom(roomCode);
    if (!room) {
      throw new Error('Room not found');
    }
    
    // Check if room has space
    const participants = await this.getGameParticipants(room.id);
    if (participants.length >= (room.maxPlayers || 4)) {
      throw new Error('Room is full');
    }
    
    // Check if room is published and accessible
    if (!room.isPublished && room.isPrivate) {
      throw new Error('This lobby is private');
    }
    
    // Join the room
    await this.joinGameRoom(room.id, userId, betAmount);
    
    return { code: room.code, room };
  }

  // AI replacement system methods
  async replacePlayerWithAI(gameRoomId: string, userId: string): Promise<void> {
    // Apply 50% penalty
    const participant = await db
      .select()
      .from(gameParticipants)
      .where(and(
        eq(gameParticipants.gameRoomId, gameRoomId),
        eq(gameParticipants.userId, userId)
      ));

    if (participant.length > 0) {
      const penalty = Math.floor(participant[0].betPaid * 0.5);
      
      // Deduct penalty from user's currency
      if (penalty > 0) {
        await this.spendCurrency(userId, penalty);
      }

      // Mark as AI replacement and apply penalty
      await db
        .update(gameParticipants)
        .set({
          isAiReplacement: true,
          leftDuringGame: true,
          penaltyApplied: penalty,
          leftAt: new Date()
        })
        .where(and(
          eq(gameParticipants.gameRoomId, gameRoomId),
          eq(gameParticipants.userId, userId)
        ));
    }
  }

  // Idle detection helper method
  async getActiveRoomsWithCrowns(): Promise<any[]> {
    const rooms = await db
      .select({
        id: gameRooms.id,
        crownHolderId: gameRooms.crownHolderId,
        lastActivityAt: gameRooms.lastActivityAt,
        idleWarningAt: gameRooms.idleWarningAt
      })
      .from(gameRooms)
      .where(and(
        eq(gameRooms.status, 'waiting'),
        sql`${gameRooms.crownHolderId} IS NOT NULL`
      ));
    return rooms;
  }

  // Multiplayer game room operations
  async joinGameRoom(roomId: string, userId: string, betAmount: number = 0): Promise<GameParticipant> {
    // Check if already in room
    const existing = await db
      .select()
      .from(gameParticipants)
      .where(and(
        eq(gameParticipants.userId, userId),
        eq(gameParticipants.gameRoomId, roomId)
      ));
    
    if (existing.length > 0) {
      return existing[0];
    }

    // Store bet amount but don't deduct coins until game starts
    // Coins will be deducted when the game actually begins

    // Get current participant count to assign player index
    const participantCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(gameParticipants)
      .where(and(
        eq(gameParticipants.gameRoomId, roomId),
        sql`${gameParticipants.leftAt} IS NULL`
      ));

    const [participant] = await db
      .insert(gameParticipants)
      .values({
        userId,
        gameRoomId: roomId,
        joinOrder: participantCount[0].count + 1,
        playerIndex: participantCount[0].count,
        betPaid: betAmount,
        isReady: false,
        isSpectator: false,
        isHost: participantCount[0].count === 0,
        connected: true
      })
      .returning();

    // Update room's prize pool
    await db
      .update(gameRooms)
      .set({
        prizePool: sql`${gameRooms.prizePool} + ${betAmount}`
      })
      .where(eq(gameRooms.id, roomId));

    return participant;
  }

  async getGameParticipants(roomId: string): Promise<GameParticipant[]> {
    return await db
      .select()
      .from(gameParticipants)
      .where(and(
        eq(gameParticipants.gameRoomId, roomId),
        sql`${gameParticipants.leftAt} IS NULL`
      ));
  }

  async updateParticipantReady(roomId: string, userId: string, isReady: boolean): Promise<void> {
    await db
      .update(gameParticipants)
      .set({ isReady })
      .where(and(
        eq(gameParticipants.gameRoomId, roomId),
        eq(gameParticipants.userId, userId)
      ));
  }

  async leaveGameRoom(userId: string, gameRoomId: string): Promise<void> {
    await db
      .update(gameParticipants)
      .set({ leftAt: new Date() })
      .where(and(
        eq(gameParticipants.userId, userId),
        eq(gameParticipants.gameRoomId, gameRoomId)
      ));
  }

  async setPlayerReady(roomId: string, userId: string, isReady: boolean): Promise<void> {
    await db
      .update(gameParticipants)
      .set({ isReady })
      .where(and(
        eq(gameParticipants.userId, userId),
        eq(gameParticipants.gameRoomId, roomId),
        sql`${gameParticipants.leftAt} IS NULL`
      ));
  }

  async getGameRoomParticipants(roomId: string): Promise<any[]> {
    const participants = await db
      .select({
        userId: gameParticipants.userId,
        userName: users.email,
        isReady: gameParticipants.isReady,
        joinedAt: gameParticipants.joinedAt
      })
      .from(gameParticipants)
      .leftJoin(users, eq(gameParticipants.userId, users.id))
      .where(and(
        eq(gameParticipants.gameRoomId, roomId),
        sql`${gameParticipants.leftAt} IS NULL`
      ));
    
    return participants.map(p => ({
      userId: p.userId,
      userName: p.userName?.split('@')[0] || 'Player',
      isReady: p.isReady || false,
      joinedAt: p.joinedAt
    }));
  }

  async updateGameState(gameRoomId: string, gameState: any): Promise<void> {
    await db
      .update(gameRooms)
      .set({ gameState })
      .where(eq(gameRooms.id, gameRoomId));
  }

  // Friend system operations
  async sendFriendRequest(requesterId: string, addresseeId: string): Promise<Friendship> {
    const [friendship] = await db
      .insert(friendships)
      .values({
        requesterId,
        addresseeId,
        status: 'pending'
      })
      .returning();
    return friendship;
  }

  async respondToFriendRequest(friendshipId: string, status: 'accepted' | 'declined'): Promise<Friendship> {
    const [friendship] = await db
      .update(friendships)
      .set({ 
        status,
        respondedAt: new Date()
      })
      .where(eq(friendships.id, friendshipId))
      .returning();
    return friendship;
  }

  async getFriends(userId: string): Promise<User[]> {
    const friends = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        friendCode: users.friendCode,
        level: users.level,
        experience: users.experience,
        currency: users.currency,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt
      })
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.addresseeId))
      .where(and(
        eq(friendships.requesterId, userId),
        eq(friendships.status, 'accepted')
      ));
    
    const friends2 = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        friendCode: users.friendCode,
        level: users.level,
        experience: users.experience,
        currency: users.currency,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt
      })
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.requesterId))
      .where(and(
        eq(friendships.addresseeId, userId),
        eq(friendships.status, 'accepted')
      ));

    return [...friends, ...friends2];
  }

  async getFriendRequests(userId: string): Promise<Friendship[]> {
    return await db
      .select()
      .from(friendships)
      .where(and(
        eq(friendships.addresseeId, userId),
        eq(friendships.status, 'pending')
      ));
  }

  async findUserByFriendCode(friendCode: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.friendCode, friendCode.toUpperCase()));
    return user;
  }

  // Chat operations
  async addChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [chatMessage] = await db
      .insert(chatMessages)
      .values(message)
      .returning();
    return chatMessage;
  }

  async getChatHistory(gameRoomId?: string, limit: number = 50): Promise<ChatMessage[]> {
    let query = db.select().from(chatMessages);
    
    if (gameRoomId) {
      query = query.where(eq(chatMessages.gameRoomId, gameRoomId));
    } else {
      query = query.where(sql`${chatMessages.gameRoomId} IS NULL`);
    }
    
    return await query
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
  }

  // Tournament operations
  async createTournament(tournament: InsertTournament): Promise<Tournament> {
    const [newTournament] = await db
      .insert(tournaments)
      .values(tournament)
      .returning();
    return newTournament;
  }

  async joinTournament(tournamentId: string, userId: string): Promise<TournamentParticipant> {
    const [participant] = await db
      .insert(tournamentParticipants)
      .values({
        tournamentId,
        userId
      })
      .returning();
    return participant;
  }

  async leaveTournament(tournamentId: string, userId: string): Promise<void> {
    await db
      .delete(tournamentParticipants)
      .where(and(
        eq(tournamentParticipants.tournamentId, tournamentId),
        eq(tournamentParticipants.userId, userId)
      ));
  }

  async getTournaments(status?: string): Promise<Tournament[]> {
    let query = db.select().from(tournaments);
    
    if (status) {
      query = query.where(eq(tournaments.status, status));
    }
    
    return await query.orderBy(desc(tournaments.createdAt));
  }

  async getTournamentParticipants(tournamentId: string): Promise<TournamentParticipant[]> {
    return await db
      .select()
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, tournamentId));
  }

  // Spectator operations
  async addSpectator(gameRoomId: string, userId: string): Promise<GameSpectator> {
    const [spectator] = await db
      .insert(gameSpectators)
      .values({
        gameRoomId,
        userId
      })
      .returning();
    return spectator;
  }

  async removeSpectator(gameRoomId: string, userId: string): Promise<void> {
    await db
      .update(gameSpectators)
      .set({ leftAt: new Date() })
      .where(and(
        eq(gameSpectators.gameRoomId, gameRoomId),
        eq(gameSpectators.userId, userId)
      ));
  }

  async getSpectators(gameRoomId: string): Promise<User[]> {
    return await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        friendCode: users.friendCode,
        level: users.level,
        experience: users.experience,
        currency: users.currency,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt
      })
      .from(gameSpectators)
      .innerJoin(users, eq(users.id, gameSpectators.userId))
      .where(and(
        eq(gameSpectators.gameRoomId, gameRoomId),
        sql`${gameSpectators.leftAt} IS NULL`
      ));
  }

  // Social sharing operations
  async createSocialPost(post: InsertSocialPost): Promise<SocialPost> {
    const [socialPost] = await db
      .insert(socialPosts)
      .values(post)
      .returning();
    return socialPost;
  }

  async likeSocialPost(postId: string, userId: string): Promise<SocialPostLike> {
    const [like] = await db
      .insert(socialPostLikes)
      .values({
        postId,
        userId
      })
      .returning();
    
    // Increment like count
    await db
      .update(socialPosts)
      .set({ likes: sql`${socialPosts.likes} + 1` })
      .where(eq(socialPosts.id, postId));
      
    return like;
  }

  async unlikeSocialPost(postId: string, userId: string): Promise<void> {
    await db
      .delete(socialPostLikes)
      .where(and(
        eq(socialPostLikes.postId, postId),
        eq(socialPostLikes.userId, userId)
      ));
    
    // Decrement like count
    await db
      .update(socialPosts)
      .set({ likes: sql`${socialPosts.likes} - 1` })
      .where(eq(socialPosts.id, postId));
  }

  async getSocialFeed(userId: string, limit: number = 20): Promise<SocialPost[]> {
    return await db
      .select()
      .from(socialPosts)
      .where(eq(socialPosts.isPublic, true))
      .orderBy(desc(socialPosts.createdAt))
      .limit(limit);
  }

  // Helper method to generate unique friend codes
  private async generateUniqueFriendCode(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code: string;
    let isUnique = false;
    
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      // Check if code already exists
      const existingUser = await this.findUserByFriendCode(code);
      isUnique = !existingUser;
    } while (!isUnique);
    
    return code;
  }
}

export const storage = new DatabaseStorage();
