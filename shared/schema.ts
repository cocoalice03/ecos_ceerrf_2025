import { pgTable, text, serial, integer, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User sessions for authentication
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  lastAccess: timestamp("last_access").notNull().defaultNow(),
});

export const insertSessionSchema = createInsertSchema(sessions).pick({
  email: true,
});

// Chat exchanges (question-answer pairs)
export const exchanges = pgTable("exchanges", {
  id: serial("id_exchange").primaryKey(),
  email: text("utilisateur_email").notNull(),
  question: text("question").notNull(),
  response: text("reponse").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertExchangeSchema = createInsertSchema(exchanges).pick({
  email: true,
  question: true,
  response: true,
});

// Daily question counters
export const dailyCounters = pgTable("daily_counters", {
  email: text("utilisateur_email").notNull(),
  date: timestamp("date").notNull(),
  count: integer("count").notNull().default(0),
});

export const insertCounterSchema = createInsertSchema(dailyCounters).pick({
  email: true,
  date: true,
  count: true,
});

// Types for TypeScript
export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;

export type Exchange = typeof exchanges.$inferSelect;
export type InsertExchange = z.infer<typeof insertExchangeSchema>;

export type DailyCounter = typeof dailyCounters.$inferSelect;
export type InsertCounter = z.infer<typeof insertCounterSchema>;

// For backwards compatibility (keeping the original User schema)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
