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
  
  // Friend system - unique 6-character friend code
  friendCode: varchar("friend_code", { length: 6 }).unique(),
  
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

// Multiplayer game rooms (updated for spec compliance)
export const gameRooms = pgTable("game_rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(), // 6-character room code
  name: varchar("name").notNull().default('Room'), // Room name
  hostId: varchar("host_id").notNull().references(() => users.id),
  
  // Room visibility and access
  visibility: varchar("visibility").notNull().default('public'), // 'public' | 'private'
  passwordHash: varchar("password_hash"), // For private rooms
  
  // Room configuration
  maxPlayers: integer("max_players").notNull().default(4), // 2-4 players
  rounds: integer("rounds").notNull().default(9), // 5 or 9 rounds
  betAmount: integer("bet_amount").notNull().default(0), // 0-100 coins per spec
  
  // Room state management
  state: varchar("state").notNull().default('waiting'), // 'waiting' | 'active' | 'finished'
  playerCount: integer("player_count").notNull().default(0), // Current number of players
  
  // Crown system (kept for compatibility)
  crownHolderId: varchar("crown_holder_id").references(() => users.id),
  
  // Game state
  gameState: jsonb("game_state"),
  settings: jsonb("settings").notNull().default('{}'),
  players: jsonb("players").notNull().default('[]'), // array of player objects
  
  // Activity tracking
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  
  // Prize pool and payouts
  prizePool: integer("prize_pool").notNull().default(0),
  payouts: jsonb("payouts"), // stores final payouts for each player
  
  // Legacy fields (kept for compatibility)
  isPublished: boolean("is_published").default(false),
  isPrivate: boolean("is_private").default(false),
  settingsLocked: boolean("settings_locked").default(false),
  idleWarningAt: timestamp("idle_warning_at"),
  isActive: boolean("is_active"),
  status: varchar("status"),
});

// Game participants - tracks who's in each game (enhanced for spec)
export const gameParticipants = pgTable("game_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameRoomId: varchar("game_room_id").notNull().references(() => gameRooms.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Player order and status
  joinOrder: integer("join_order").notNull(), // 1, 2, 3, 4 (determines host succession)
  playerIndex: integer("player_index").notNull(), // 0, 1, 2, 3 (seat position)
  isHost: boolean("is_host").notNull().default(false),
  isReady: boolean("is_ready").default(false),
  isSpectator: boolean("is_spectator").default(false),
  
  // Connection status
  connected: boolean("connected").notNull().default(true),
  connectionId: varchar("connection_id"), // WebSocket connection ID
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  
  // Game data
  betPaid: integer("bet_paid").notNull().default(0),
  scoreByRound: jsonb("score_by_round").default('[]'), // Array of scores per round
  totalScore: integer("total_score").default(0),
  finalPlacement: integer("final_placement"), // 1st, 2nd, 3rd, 4th
  payout: integer("payout").default(0),
  
  // AI takeover system (5-minute rejoin window)
  isAiReplacement: boolean("is_ai_replacement").default(false),
  leftDuringGame: boolean("left_during_game").default(false),
  disconnectedAt: timestamp("disconnected_at"),
  canRejoinUntil: timestamp("can_rejoin_until"), // 5 minutes after disconnect
  penaltyApplied: integer("penalty_applied").default(0),
  
  // Timestamps
  joinedAt: timestamp("joined_at").defaultNow(),
  leftAt: timestamp("left_at"),
}, (table) => [
  index("idx_room_user").on(table.gameRoomId, table.userId),
]);

// Friend relationships
export const friendships = pgTable("friendships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").notNull().references(() => users.id),
  addresseeId: varchar("addressee_id").notNull().references(() => users.id),
  status: varchar("status").notNull().default("pending"), // pending, accepted, declined, blocked
  createdAt: timestamp("created_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
});

// Chat messages
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  gameRoomId: varchar("game_room_id").references(() => gameRooms.id), // null for global chat
  content: text("content").notNull(),
  type: varchar("type").notNull().default("message"), // message, system, emote
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tournaments
export const tournaments = pgTable("tournaments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  organizerId: varchar("organizer_id").notNull().references(() => users.id),
  maxParticipants: integer("max_participants").notNull(),
  entryFee: integer("entry_fee").default(0), // in coins
  prizePool: integer("prize_pool").default(0),
  status: varchar("status").notNull().default("registration"), // registration, active, finished, cancelled
  registrationStart: timestamp("registration_start").defaultNow(),
  registrationEnd: timestamp("registration_end").notNull(),
  tournamentStart: timestamp("tournament_start").notNull(),
  tournamentEnd: timestamp("tournament_end"),
  rules: jsonb("rules").notNull(),
  brackets: jsonb("brackets"), // Tournament bracket structure
  createdAt: timestamp("created_at").defaultNow(),
});

// Tournament participants
export const tournamentParticipants = pgTable("tournament_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tournamentId: varchar("tournament_id").notNull().references(() => tournaments.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  seed: integer("seed"), // Tournament seeding
  currentRound: integer("current_round").default(1),
  isEliminated: boolean("is_eliminated").default(false),
  finalPlacement: integer("final_placement"),
  registeredAt: timestamp("registered_at").defaultNow(),
});

// Tournament matches
export const tournamentMatches = pgTable("tournament_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tournamentId: varchar("tournament_id").notNull().references(() => tournaments.id),
  gameRoomId: varchar("game_room_id").references(() => gameRooms.id),
  round: integer("round").notNull(),
  matchNumber: integer("match_number").notNull(),
  participant1Id: varchar("participant1_id").references(() => tournamentParticipants.id),
  participant2Id: varchar("participant2_id").references(() => tournamentParticipants.id),
  winnerId: varchar("winner_id").references(() => tournamentParticipants.id),
  status: varchar("status").notNull().default("pending"), // pending, playing, finished
  scheduledAt: timestamp("scheduled_at"),
  playedAt: timestamp("played_at"),
});

// Spectators for games
export const gameSpectators = pgTable("game_spectators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameRoomId: varchar("game_room_id").notNull().references(() => gameRooms.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow(),
  leftAt: timestamp("left_at"),
});

// Room audit log for tracking events
export const roomAuditLog = pgTable("room_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id").notNull(),
  actorId: varchar("actor_id"), // User who triggered the event
  type: varchar("type").notNull(), // 'payout', 'bet_change', 'host_transfer', 'settings_change', etc.
  payload: jsonb("payload"), // Event-specific data
  createdAt: timestamp("created_at").defaultNow(),
});

// Social sharing posts
export const socialPosts = pgTable("social_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type").notNull(), // achievement, game_result, milestone
  content: text("content").notNull(),
  metadata: jsonb("metadata"), // Extra data for the post
  likes: integer("likes").default(0),
  isPublic: boolean("is_public").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Likes on social posts
export const socialPostLikes = pgTable("social_post_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => socialPosts.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Schema definitions for inserts
export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  friendCode: true,
});

export const insertGameStatsSchema = createInsertSchema(gameStats).omit({
  id: true,
  updatedAt: true,
});

export const insertGameHistorySchema = createInsertSchema(gameHistory).omit({
  id: true,
  createdAt: true,
});

export const insertGameRoomSchema = createInsertSchema(gameRooms).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
});

export const insertGameParticipantSchema = createInsertSchema(gameParticipants).omit({
  id: true,
  joinedAt: true,
  leftAt: true,
});

export const insertFriendshipSchema = createInsertSchema(friendships).omit({
  id: true,
  createdAt: true,
  respondedAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export const insertTournamentSchema = createInsertSchema(tournaments).omit({
  id: true,
  createdAt: true,
  tournamentEnd: true,
});

export const insertTournamentParticipantSchema = createInsertSchema(tournamentParticipants).omit({
  id: true,
  registeredAt: true,
});

export const insertTournamentMatchSchema = createInsertSchema(tournamentMatches).omit({
  id: true,
  playedAt: true,
});

export const insertGameSpectatorSchema = createInsertSchema(gameSpectators).omit({
  id: true,
  joinedAt: true,
  leftAt: true,
});

export const insertRoomAuditLogSchema = createInsertSchema(roomAuditLog).omit({
  id: true,
  createdAt: true,
});

export const insertSocialPostSchema = createInsertSchema(socialPosts).omit({
  id: true,
  createdAt: true,
});

export const insertSocialPostLikeSchema = createInsertSchema(socialPostLikes).omit({
  id: true,
  createdAt: true,
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
export type GameParticipant = typeof gameParticipants.$inferSelect;
export type Friendship = typeof friendships.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type Tournament = typeof tournaments.$inferSelect;
export type TournamentParticipant = typeof tournamentParticipants.$inferSelect;
export type TournamentMatch = typeof tournamentMatches.$inferSelect;
export type GameSpectator = typeof gameSpectators.$inferSelect;
export type RoomAuditLog = typeof roomAuditLog.$inferSelect;
export type SocialPost = typeof socialPosts.$inferSelect;
export type SocialPostLike = typeof socialPostLikes.$inferSelect;
export type Achievement = typeof achievements.$inferSelect;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type Cosmetic = typeof cosmetics.$inferSelect;
export type UserCosmetic = typeof userCosmetics.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;

export type InsertGameStats = z.infer<typeof insertGameStatsSchema>;
export type InsertGameHistory = z.infer<typeof insertGameHistorySchema>;
export type InsertGameRoom = z.infer<typeof insertGameRoomSchema>;
export type InsertGameParticipant = z.infer<typeof insertGameParticipantSchema>;
export type InsertFriendship = z.infer<typeof insertFriendshipSchema>;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type InsertTournamentParticipant = z.infer<typeof insertTournamentParticipantSchema>;
export type InsertTournamentMatch = z.infer<typeof insertTournamentMatchSchema>;
export type InsertGameSpectator = z.infer<typeof insertGameSpectatorSchema>;
export type InsertRoomAuditLog = z.infer<typeof insertRoomAuditLogSchema>;
export type InsertSocialPost = z.infer<typeof insertSocialPostSchema>;
export type InsertSocialPostLike = z.infer<typeof insertSocialPostLikeSchema>;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;
export type InsertCosmetic = z.infer<typeof insertCosmeticSchema>;
export type InsertUserCosmetic = z.infer<typeof insertUserCosmeticSchema>;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UpdateUserSettings = z.infer<typeof updateUserSettingsSchema>;
