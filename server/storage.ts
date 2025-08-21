import {
  users,
  gameStats,
  gameHistory,
  achievements,
  userAchievements,
  cosmetics,
  userCosmetics,
  gameRooms,
  type User,
  type UpsertUser,
  type GameStats,
  type GameHistory,
  type Achievement,
  type UserAchievement,
  type Cosmetic,
  type UserCosmetic,
  type GameRoom,
  type InsertGameStats,
  type InsertGameHistory,
  type InsertUserAchievement,
  type InsertUserCosmetic,
  type InsertGameRoom,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

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
  
  // Game room operations
  createGameRoom(room: InsertGameRoom): Promise<GameRoom>;
  getGameRoom(code: string): Promise<GameRoom | undefined>;
  updateGameRoom(code: string, updates: Partial<GameRoom>): Promise<GameRoom | undefined>;
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
    // First unequip all cosmetics of the same type
    const [cosmetic] = await db.select().from(cosmetics).where(eq(cosmetics.id, cosmeticId));
    if (cosmetic) {
      await db
        .update(userCosmetics)
        .set({ equipped: false })
        .where(eq(userCosmetics.userId, userId));
      
      // Then equip the selected one
      await db
        .update(userCosmetics)
        .set({ equipped: true })
        .where(eq(userCosmetics.cosmeticId, cosmeticId));
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

  // Game room operations
  async createGameRoom(roomData: InsertGameRoom): Promise<GameRoom> {
    const [room] = await db
      .insert(gameRooms)
      .values(roomData)
      .returning();
    return room;
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
}

export const storage = new DatabaseStorage();
