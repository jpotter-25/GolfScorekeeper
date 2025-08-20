import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  level: integer("level").default(1),
  experience: integer("experience").default(0),
  currency: integer("currency").default(0),
});

export const gameRooms = pgTable("game_rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  hostId: varchar("host_id").notNull(),
  players: jsonb("players").notNull(),
  gameState: jsonb("game_state"),
  settings: jsonb("settings").notNull(),
  createdAt: text("created_at").default(sql`NOW()`),
  isActive: boolean("is_active").default(true),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertGameRoomSchema = createInsertSchema(gameRooms).pick({
  code: true,
  hostId: true,
  players: true,
  settings: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type GameRoom = typeof gameRooms.$inferSelect;
export type InsertGameRoom = z.infer<typeof insertGameRoomSchema>;
