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
import { eq, desc, sql, and, gt, lt } from "drizzle-orm";

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
  async createGameRoom(roomData: InsertGameRoom): Promise<GameRoom> {
    // Calculate player count from players array
    const playerCount = Array.isArray(roomData.players) ? roomData.players.length : 1;
    
    // Default settings
    const defaultSettings = {
      rounds: 9,
      playerCount: 4,
      ...roomData.settings
    };
    
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
        version
      )
      VALUES (
        ${roomData.code},
        ${roomData.hostId},
        ${JSON.stringify(roomData.players)}::jsonb,
        ${JSON.stringify(defaultSettings)}::jsonb,
        ${roomData.stakeBracket || 'free'},
        ${playerCount},
        'room',
        'public',
        4,
        1
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
          host_id = ${updates.hostId || sql`host_id`},
          version = COALESCE(version, 1) + 1
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

  async joinGameRoom(code: string, userId: string, userEmail: string): Promise<{ 
    success: boolean; 
    room: GameRoom | null; 
    message?: string;
    isAlreadyInRoom?: boolean;
  }> {
    // Atomic join operation using a transaction
    return await db.transaction(async (tx) => {
      // Get latest room state with row-level lock to prevent concurrent modifications
      const result = await tx.execute(sql`
        SELECT * FROM game_rooms 
        WHERE code = ${code} AND is_active = true
        FOR UPDATE
      `);
      
      const room = result.rows[0] as GameRoom | undefined;
      
      if (!room) {
        return { 
          success: false, 
          room: null, 
          message: "Room not found or inactive" 
        };
      }
      
      const players = room.players as any[];
      const maxPlayers = room.maxPlayers || 4;
      
      // Check if player is already in the room (idempotent)
      const existingPlayer = players.find(p => p.id === userId);
      if (existingPlayer) {
        return { 
          success: true, 
          room: room,
          isAlreadyInRoom: true 
        };
      }
      
      // Check if room is full
      if (players.length >= maxPlayers) {
        return { 
          success: false, 
          room: room, 
          message: "Room is full" 
        };
      }
      
      // Check if room has already started
      if (room.status !== 'room') {
        return { 
          success: false, 
          room: room, 
          message: "Game has already started" 
        };
      }
      
      // Add player to room atomically
      const newPlayers = [...players, { 
        id: userId, 
        name: userEmail || 'Player',
        ready: false 
      }];
      
      const updateResult = await tx.execute(sql`
        UPDATE game_rooms 
        SET 
          players = ${JSON.stringify(newPlayers)}::jsonb,
          version = COALESCE(version, 1) + 1
        WHERE code = ${code}
        RETURNING *
      `);
      
      const updatedRoom = updateResult.rows[0] as GameRoom;
      
      return { 
        success: true, 
        room: updatedRoom 
      };
    });
  }

  async leaveGameRoom(code: string, userId: string): Promise<{
    success: boolean;
    roomDeleted?: boolean;
    newHost?: string;
    room?: GameRoom | null;
    message?: string;
  }> {
    // Atomic leave operation using a transaction
    return await db.transaction(async (tx) => {
      // Get latest room state with row-level lock
      const result = await tx.execute(sql`
        SELECT * FROM game_rooms 
        WHERE code = ${code} AND is_active = true
        FOR UPDATE
      `);
      
      const room = result.rows[0] as GameRoom | undefined;
      
      if (!room) {
        return { 
          success: false, 
          message: "Room not found or inactive" 
        };
      }
      
      const players = room.players as any[];
      
      // Check if player is in the room
      const playerIndex = players.findIndex(p => p.id === userId);
      if (playerIndex === -1) {
        return { 
          success: false, 
          message: "Player not in room" 
        };
      }
      
      // Remove player from room
      const updatedPlayers = players.filter(p => p.id !== userId);
      
      // If room is now empty, delete it
      if (updatedPlayers.length === 0) {
        await tx.execute(sql`
          DELETE FROM game_rooms 
          WHERE code = ${code}
        `);
        
        return { 
          success: true, 
          roomDeleted: true,
          room: null
        };
      }
      
      // Handle host transfer if needed
      let newHostId = room.hostId;
      if (room.hostId === userId && updatedPlayers.length > 0) {
        // Transfer host to the first remaining player (earliest joiner)
        newHostId = updatedPlayers[0].id;
      }
      
      // Update room with new players list and potentially new host
      const updateResult = await tx.execute(sql`
        UPDATE game_rooms 
        SET 
          players = ${JSON.stringify(updatedPlayers)}::jsonb,
          host_id = ${newHostId},
          version = COALESCE(version, 1) + 1
        WHERE code = ${code}
        RETURNING *
      `);
      
      const updatedRoom = updateResult.rows[0] as GameRoom;
      
      return { 
        success: true, 
        room: updatedRoom,
        newHost: newHostId !== room.hostId ? newHostId : undefined
      };
    });
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
          eq(gameRooms.stakeBracket, stakeBracket)
        )
      );
    
    // Filter out phantom rooms (0 players) and full rooms
    const validRooms = rooms.filter(room => {
      const players = room.players as any[];
      const maxPlayers = room.maxPlayers || 4;
      // Check that room actually has players and isn't full
      return players && players.length > 0 && players.length < maxPlayers;
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
