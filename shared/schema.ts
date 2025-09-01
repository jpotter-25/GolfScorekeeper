import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  
  // Game progression fields
  level: integer("level").default(1),
  experience: integer("experience").default(0),
  currency: integer("currency").default(100), // Start with 100 coins
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Game statistics table
export const gameStats = pgTable("game_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Game completion stats
  gamesPlayed: integer("games_played").default(0),
  gamesWon: integer("games_won").default(0),
  gamesLost: integer("games_lost").default(0),
  
  // Score statistics
  totalScore: integer("total_score").default(0),
  bestScore: integer("best_score"),
  averageScore: integer("average_score"),
  
  // Streak tracking
  currentWinStreak: integer("current_win_streak").default(0),
  longestWinStreak: integer("longest_win_streak").default(0),
  
  // Performance metrics
  perfectGames: integer("perfect_games").default(0), // Games with score 0
  comebackWins: integer("comeback_wins").default(0), // Wins from behind
  
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Individual game history
export const gameHistory = pgTable("game_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Game details
  gameMode: varchar("game_mode").notNull(), // 'solo', 'pass-play', 'online'
  playerCount: integer("player_count").notNull(),
  rounds: integer("rounds").notNull(),
  
  // Results
  finalScore: integer("final_score").notNull(),
  placement: integer("placement").notNull(), // 1st, 2nd, 3rd, 4th
  won: boolean("won").notNull(),
  
  // Rewards earned
  xpEarned: integer("xp_earned").notNull(),
  coinsEarned: integer("coins_earned").notNull(),
  
  // Game duration
  gameDuration: integer("game_duration"), // in seconds
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Achievements system
export const achievements = pgTable("achievements", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  description: text("description").notNull(),
  icon: varchar("icon").notNull(),
  xpReward: integer("xp_reward").default(0),
  coinReward: integer("coin_reward").default(0),
  requirement: jsonb("requirement").notNull(), // Flexible achievement criteria
});

// User achievements (unlocked achievements)
export const userAchievements = pgTable("user_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  achievementId: varchar("achievement_id").notNull().references(() => achievements.id),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
});

// Cosmetic items
export const cosmetics = pgTable("cosmetics", {
  id: varchar("id").primaryKey(),
  type: varchar("type").notNull(), // 'card_back', 'avatar', 'table_theme'
  name: varchar("name").notNull(),
  description: text("description"),
  rarity: varchar("rarity").notNull(), // 'common', 'rare', 'epic', 'legendary'
  cost: integer("cost").notNull(), // Coin cost
  unlockLevel: integer("unlock_level").default(1),
  imageUrl: varchar("image_url"),
});

// User cosmetics (owned items)
export const userCosmetics = pgTable("user_cosmetics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  cosmeticId: varchar("cosmetic_id").notNull().references(() => cosmetics.id),
  equipped: boolean("equipped").default(false),
  purchasedAt: timestamp("purchased_at").defaultNow(),
});

// User settings and preferences
export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  
  // Audio settings
  soundEnabled: boolean("sound_enabled").default(true),
  musicEnabled: boolean("music_enabled").default(true),
  soundVolume: integer("sound_volume").default(50), // 0-100
  musicVolume: integer("music_volume").default(30), // 0-100
  
  // Accessibility settings
  reducedMotion: boolean("reduced_motion").default(false),
  highContrast: boolean("high_contrast").default(false),
  largeText: boolean("large_text").default(false),
  
  // Haptic feedback
  vibrationEnabled: boolean("vibration_enabled").default(true),
  
  // Game preferences
  autoEndTurn: boolean("auto_end_turn").default(false),
  showHints: boolean("show_hints").default(true),
  
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const gameRooms = pgTable("game_rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  hostId: varchar("host_id").notNull(),
  players: jsonb("players").notNull(),
  gameState: jsonb("game_state"),
  settings: jsonb("settings").notNull(),
  stakeBracket: varchar("stake_bracket"), // 'free', 'low', 'medium', 'high', 'premium'
  createdAt: text("created_at").default(sql`NOW()`),
  isActive: boolean("is_active").default(true),
});

// Schema definitions for inserts
export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export const insertGameStatsSchema = createInsertSchema(gameStats).omit({
  id: true,
  updatedAt: true,
});

export const insertGameHistorySchema = createInsertSchema(gameHistory).omit({
  id: true,
  createdAt: true,
});

export const insertGameRoomSchema = createInsertSchema(gameRooms).pick({
  code: true,
  hostId: true,
  players: true,
  settings: true,
});

export const insertAchievementSchema = createInsertSchema(achievements);

export const insertUserAchievementSchema = createInsertSchema(userAchievements).omit({
  id: true,
  unlockedAt: true,
});

export const insertCosmeticSchema = createInsertSchema(cosmetics);

export const insertUserCosmeticSchema = createInsertSchema(userCosmetics).omit({
  id: true,
  purchasedAt: true,
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  updatedAt: true,
});

export const updateUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  userId: true,
  updatedAt: true,
}).partial();

// Type exports
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type GameStats = typeof gameStats.$inferSelect;
export type GameHistory = typeof gameHistory.$inferSelect;
export type GameRoom = typeof gameRooms.$inferSelect;
export type Achievement = typeof achievements.$inferSelect;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type Cosmetic = typeof cosmetics.$inferSelect;
export type UserCosmetic = typeof userCosmetics.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;

export type InsertGameStats = z.infer<typeof insertGameStatsSchema>;
export type InsertGameHistory = z.infer<typeof insertGameHistorySchema>;
export type InsertGameRoom = z.infer<typeof insertGameRoomSchema>;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;
export type InsertCosmetic = z.infer<typeof insertCosmeticSchema>;
export type InsertUserCosmetic = z.infer<typeof insertUserCosmeticSchema>;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UpdateUserSettings = z.infer<typeof updateUserSettingsSchema>;

// Stake bracket definitions
export const STAKE_BRACKETS = {
  free: { label: "Free", entryFee: 0, winMultiplier: 1 },
  low: { label: "Low", entryFee: 10, winMultiplier: 1.5 },
  medium: { label: "Medium", entryFee: 50, winMultiplier: 2 },
  high: { label: "High", entryFee: 100, winMultiplier: 3 },
  premium: { label: "Premium", entryFee: 500, winMultiplier: 5 },
} as const;

export type StakeBracket = keyof typeof STAKE_BRACKETS;
