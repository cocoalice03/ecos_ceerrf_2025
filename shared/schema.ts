import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

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
export type Exchange = typeof exchanges.$inferSelect;
export type InsertExchange = z.infer<typeof insertExchangeSchema>;

export type DailyCounter = typeof dailyCounters.$inferSelect;
export type InsertCounter = z.infer<typeof insertCounterSchema>;
