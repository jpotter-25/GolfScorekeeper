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
  updateGameRoom(code: string, updates: Partial<GameRoom>): Promise<GameRoom | undefined>;
  joinGameRoom(roomId: string, userId: string, betAmount?: number): Promise<GameParticipant>;
  leaveGameRoom(userId: string, gameRoomId: string): Promise<void>;
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
        createdAt: new Date().toISOString()
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
        createdAt: new Date().toISOString()
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

  async getGameRoom(code: string): Promise<GameRoom | undefined> {
    const [room] = await db.select().from(gameRooms).where(eq(gameRooms.code, code));
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

    // For betting rooms, deduct the bet amount from user's coins
    if (betAmount > 0) {
      await this.spendCurrency(userId, betAmount);
    }

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
        playerIndex: participantCount[0].count,
        betPaid: betAmount,
        isReady: false,
        isSpectator: false
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

  async leaveGameRoom(userId: string, gameRoomId: string): Promise<void> {
    await db
      .update(gameParticipants)
      .set({ leftAt: new Date() })
      .where(and(
        eq(gameParticipants.userId, userId),
        eq(gameParticipants.gameRoomId, gameRoomId)
      ));
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
