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
  type InsertGameStats,
  type InsertGameHistory,
  type InsertUserAchievement,
  type InsertUserCosmetic,
  type InsertUserSettings,
  type UpdateUserSettings,
  type InsertGameRoom,
  type StakeBracket,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, gt, lt, ne } from "drizzle-orm";

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
  getGameRoom(code: string): Promise<GameRoom | undefined>;
  updateGameRoom(code: string, updates: Partial<GameRoom>): Promise<GameRoom | undefined>;
  deleteGameRoom(code: string): Promise<void>;
  getActiveRoomsByStake(stakeBracket: StakeBracket): Promise<GameRoom[]>;
  getAllActiveRooms(): Promise<GameRoom[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
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
  async createGameRoom(roomData: InsertGameRoom & { status?: string; gameState?: any }): Promise<GameRoom> {
    // Calculate player count from players array
    const playerCount = Array.isArray(roomData.players) ? roomData.players.length : 1;
    
    // Default settings
    const defaultSettings = {
      rounds: 9,
      playerCount: 4,
      ...(roomData.settings || {})
    };
    
    // Extract maxPlayers from settings or use default
    const maxPlayers = defaultSettings.playerCount || 4;
    
    // Use raw SQL to ensure all fields are properly set
    const result = await db.execute(sql`
      INSERT INTO game_rooms (
        code, 
        host_id, 
        players, 
        settings, 
        stake_bracket, 
        player_count, 
        status, 
        visibility, 
        max_players,
        version,
        game_state
      )
      VALUES (
        ${roomData.code},
        ${roomData.hostId},
        ${JSON.stringify(roomData.players)}::jsonb,
        ${JSON.stringify(defaultSettings)}::jsonb,
        ${roomData.stakeBracket || 'free'},
        ${playerCount},
        ${roomData.status || 'room'},
        'public',
        ${maxPlayers},
        1,
        ${roomData.gameState ? JSON.stringify(roomData.gameState) : null}::jsonb
      )
      RETURNING *
    `);
    
    return result.rows[0] as GameRoom;
  }

  async getGameRoom(code: string): Promise<GameRoom | undefined> {
    const [room] = await db.select().from(gameRooms).where(eq(gameRooms.code, code));
    return room;
  }

  async updateGameRoom(code: string, updates: Partial<GameRoom>): Promise<GameRoom | undefined> {
    // If updating players, also update player_count
    if (updates.players) {
      const players = updates.players as any[];
      const result = await db.execute(sql`
        UPDATE game_rooms 
        SET 
          players = ${JSON.stringify(updates.players)}::jsonb,
          player_count = ${players.length},
          host_id = ${updates.hostId || sql`host_id`}
        WHERE code = ${code}
        RETURNING *
      `);
      return result.rows[0] as GameRoom;
    }
    
    const [room] = await db
      .update(gameRooms)
      .set(updates)
      .where(eq(gameRooms.code, code))
      .returning();
    return room;
  }

  async deleteGameRoom(code: string): Promise<void> {
    // Delete with CASCADE to handle foreign key constraints
    await db.execute(sql`
      DELETE FROM game_rooms 
      WHERE code = ${code}
    `);
  }

  async getActiveRoomsByStake(stakeBracket: StakeBracket): Promise<GameRoom[]> {
    const rooms = await db
      .select()
      .from(gameRooms)
      .where(
        and(
          eq(gameRooms.isActive, true),
          eq(gameRooms.stakeBracket, stakeBracket),
          gt(gameRooms.playerCount, 0), // Must have at least one player
          lt(gameRooms.playerCount, gameRooms.maxPlayers), // Must have open seats (not full)
          ne(gameRooms.status, 'finished') // Not finished games
        )
      );
    
    // Additional filtering per Active Room definition
    // Active Rooms = Tables with Open Seats
    const validRooms = rooms.filter(room => {
      const players = room.players as any[];
      
      // Delete empty rooms immediately
      if (!players || players.length === 0) {
        // Schedule deletion but don't await to avoid blocking
        this.deleteGameRoom(room.code).catch(err => 
          console.error(`Failed to delete empty room ${room.code}:`, err)
        );
        return false;
      }
      
      // Active Room criteria:
      // 1. players ≥ 1 (at least one seated)
      const hasPlayers = players.length >= 1;
      
      // 2. seatsOpen > 0 (MUST have open seats - not full)
      const maxPlayers = room.maxPlayers || 4;
      const seatsOpen = maxPlayers - players.length;
      const hasOpenSeats = seatsOpen > 0;
      
      // 3. visibility allows listing (default to public if not set)
      const visibility = room.visibility || 'public';
      const isListable = visibility === 'public';
      
      // Only show tables with open seats
      return hasPlayers && hasOpenSeats && isListable;
    });
    
    return validRooms;
  }

  async getAllActiveRooms(): Promise<GameRoom[]> {
    const rooms = await db
      .select()
      .from(gameRooms)
      .where(eq(gameRooms.isActive, true));
    return rooms;
  }
}

export const storage = new DatabaseStorage();
