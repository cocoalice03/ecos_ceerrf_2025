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

// ECOS Scenarios table
export const ecosScenarios = pgTable("ecos_scenarios", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  patientPrompt: text("patient_prompt").notNull(),
  evaluationCriteria: jsonb("evaluation_criteria").notNull(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ECOS Sessions table
export const ecosSessions = pgTable("ecos_sessions", {
  id: serial("id").primaryKey(),
  scenarioId: integer("scenario_id").references(() => ecosScenarios.id),
  studentEmail: varchar("student_email", { length: 255 }).notNull(),
  startTime: timestamp("start_time").defaultNow(),
  endTime: timestamp("end_time"),
  status: varchar("status", { length: 50 }).default("in_progress"),
});

// ECOS Evaluations table
export const ecosEvaluations = pgTable("ecos_evaluations", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => ecosSessions.id),
  criterionId: varchar("criterion_id", { length: 50 }).notNull(),
  score: integer("score").notNull(),
  feedback: text("feedback"),
});

// ECOS Reports table
export const ecosReports = pgTable("ecos_reports", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => ecosSessions.id),
  summary: text("summary").notNull(),
  strengths: text("strengths").array(),
  weaknesses: text("weaknesses").array(),
  recommendations: text("recommendations").array(),
});

// ECOS Session Messages table (for chat history)
export const ecosMessages = pgTable("ecos_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => ecosSessions.id),
  role: varchar("role", { length: 20 }).notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Create insert schemas for ECOS tables
export const insertEcosScenarioSchema = createInsertSchema(ecosScenarios).pick({
  title: true,
  description: true,
  patientPrompt: true,
  evaluationCriteria: true,
  createdBy: true,
});

export const insertEcosSessionSchema = createInsertSchema(ecosSessions).pick({
  scenarioId: true,
  studentEmail: true,
  status: true,
});

export const insertEcosEvaluationSchema = createInsertSchema(ecosEvaluations).pick({
  sessionId: true,
  criterionId: true,
  score: true,
  feedback: true,
});

export const insertEcosMessageSchema = createInsertSchema(ecosMessages).pick({
  sessionId: true,
  role: true,
  content: true,
});

// Types for TypeScript
export type Exchange = typeof exchanges.$inferSelect;
export type InsertExchange = z.infer<typeof insertExchangeSchema>;

export type DailyCounter = typeof dailyCounters.$inferSelect;
export type InsertCounter = z.infer<typeof insertCounterSchema>;

// ECOS Types
export type EcosScenario = typeof ecosScenarios.$inferSelect;
export type InsertEcosScenario = z.infer<typeof insertEcosScenarioSchema>;

export type EcosSession = typeof ecosSessions.$inferSelect;
export type InsertEcosSession = z.infer<typeof insertEcosSessionSchema>;

export type EcosEvaluation = typeof ecosEvaluations.$inferSelect;
export type InsertEcosEvaluation = z.infer<typeof insertEcosEvaluationSchema>;

export type EcosReport = typeof ecosReports.$inferSelect;

export type EcosMessage = typeof ecosMessages.$inferSelect;
export type InsertEcosMessage = z.infer<typeof insertEcosMessageSchema>;
