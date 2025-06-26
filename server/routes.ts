import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { openaiService } from "./services/openai.service";
import { pineconeService } from "./services/pinecone.service";
import { learnWorldsService } from "./services/learnworlds.service";
import { insertExchangeSchema } from "@shared/schema";
import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { db, createTrainingSessionsTables } from './db';
import multer from 'multer';
import { ecosService } from './services/ecos.service';
import { promptGenService } from './services/promptGen.service';
import { evaluationService } from './services/evaluation.service';
import { ecosScenarios, ecosSessions, trainingSessions, trainingSessionScenarios, trainingSessionStudents, users } from '@shared/schema';
import { eq, and, between, inArray, sql, lte, gte } from 'drizzle-orm';
import chatRouter from './routes/chat';
import adminRouter from './routes/admin';
import ecosRouter from './routes/ecos';
import learnWorldsRouter from './routes/learnworlds';

// Max questions per day per user
const MAX_DAILY_QUESTIONS = 20;

// Admin emails authorized to access admin features
const ADMIN_EMAILS: string[] = ['cherubindavid@gmail.com', 'colombemadoungou@gmail.com', 'romain.guillevic@gmail.com', 'romainguillevic@gmail.com'];

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Middleware to check admin authorization
function isAdminAuthorized(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  // Convert both the input email and admin emails to lowercase for comparison
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedAdminEmails = ADMIN_EMAILS.map(adminEmail => adminEmail.toLowerCase().trim());
  return normalizedAdminEmails.includes(normalizedEmail);
}

// Utility functions for document processing
function splitIntoChunks(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    chunks.push(chunk);
    start = end - overlap;

    if (start >= text.length) break;
  }

  return chunks;
}

// Get database schema for SQL conversion
async function getDatabaseSchema(): Promise<string> {
  try {
    const result = await db.execute(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);

    if (result.rows.length > 0) {
      const schema = result.rows.map(row => 
        `${row.table_name}.${row.column_name} (${row.data_type})`
      ).join('\n');
      return schema;
    } else {
      // Return detailed schema based on your actual tables
      return `
Tables disponibles:
- sessions: sid (varchar), sess (jsonb), expire (timestamp)
- exchanges: id (integer), utilisateur_email (text), question (text), reponse (text), timestamp (timestamp)
- daily_counters: utilisateur_email (text), date (timestamp), count (integer)
- ecos_scenarios: id (integer), title (varchar), description (text), patient_prompt (text), evaluation_criteria (jsonb), created_by (varchar), created_at (timestamp)
- ecos_sessions: id (integer), scenario_id (integer), student_email (varchar), status (varchar), start_time (timestamp), end_time (timestamp)
- ecos_messages: id (integer), session_id (integer), role (varchar), content (text), timestamp (timestamp)
- ecos_evaluations: id (integer), session_id (integer), criterion_id (varchar), score (integer), feedback (text)
- ecos_reports: id (integer), session_id (integer), summary (text), strengths (text[]), weaknesses (text[]), recommendations (text[])

IMPORTANT: Dans les tables exchanges et daily_counters, la colonne email s'appelle "utilisateur_email"

Exemples de requêtes:
- SELECT COUNT(DISTINCT utilisateur_email) FROM exchanges WHERE DATE(timestamp) = CURRENT_DATE
- SELECT utilisateur_email, COUNT(*) as total_questions FROM exchanges GROUP BY utilisateur_email
- SELECT * FROM daily_counters WHERE date = CURRENT_DATE
- SELECT COUNT(*) FROM ecos_sessions WHERE status = 'completed'
- SELECT COUNT(DISTINCT student_email) FROM ecos_sessions
      `.trim();
    }
  } catch (error) {
    console.error('Error getting schema:', error);
    return `
Tables disponibles:
- exchanges: id, utilisateur_email, question, reponse, timestamp
- daily_counters: utilisateur_email, date, count

IMPORTANT: La colonne email s'appelle "utilisateur_email"

Exemples de requêtes:
- SELECT * FROM exchanges WHERE utilisateur_email = 'example@email.com'
- SELECT COUNT(DISTINCT utilisateur_email) FROM exchanges WHERE DATE(timestamp) = CURRENT_DATE
    `.trim();
  }
}

// Helper function to create or update student account
async function createStudentAccount(email: string) {
  try {
    const decodedEmail = decodeURIComponent(email);
    
    // Check if user exists
    const existingUser = await db.select().from(users).where(eq(users.email, decodedEmail)).limit(1);
    
    let user;
    let isNewUser = false;
    
    if (existingUser.length === 0) {
      // Create new user
      const newUser = await db.insert(users).values({
        id: decodedEmail,
        email: decodedEmail,
        firstName: null,
        lastName: null,
        profileImageUrl: null
      }).returning();
      
      user = newUser[0];
      isNewUser = true;
      console.log(`✅ New student account created for: ${decodedEmail}`);
    } else {
      // User already exists
      user = existingUser[0];
      console.log(`✅ Existing student account accessed: ${decodedEmail}`);
    }

    // Auto-assign to active training session if not already assigned
    try {
      // Check if user is already assigned to any training session
      const existingAssignment = await db
        .select({ trainingSessionId: trainingSessionStudents.trainingSessionId })
        .from(trainingSessionStudents)
        .where(eq(trainingSessionStudents.studentEmail, decodedEmail))
        .limit(1);

      if (existingAssignment.length === 0) {
        // Find the most recent active training session
        const now = new Date();
        const activeSession = await db
          .select({
            id: trainingSessions.id,
            title: trainingSessions.title
          })
          .from(trainingSessions)
          .where(
            and(
              lte(trainingSessions.startDate, now),
              gte(trainingSessions.endDate, now)
            )
          )
          .orderBy(trainingSessions.createdAt)
          .limit(1);

        if (activeSession.length > 0) {
          // Auto-assign student to the active session
          await db.insert(trainingSessionStudents).values({
            trainingSessionId: activeSession[0].id,
            studentEmail: decodedEmail,
          });
          
          console.log(`🎓 Auto-assigned ${decodedEmail} to training session: ${activeSession[0].title}`);
        } else {
          console.log(`⚠️ No active training session found for auto-assignment of ${decodedEmail}`);
        }
      } else {
        console.log(`📚 ${decodedEmail} already assigned to training session ID: ${existingAssignment[0].trainingSessionId}`);
      }
    } catch (assignmentError) {
      console.error(`❌ Error auto-assigning ${decodedEmail} to training session:`, assignmentError);
      // Don't throw error - user creation should still succeed
    }
    
    return { 
      user, 
      isNewUser 
    };
  } catch (error) {
    console.error(`❌ Error creating/updating student account for ${email}:`, error);
    throw error;
  }
}

// Execute SQL query safely (read-only)
async function executeSQLQuery(sqlQuery: string) {
  try {
    console.log("🔍 Validating SQL query:", sqlQuery);

    // Only allow SELECT queries for safety
    const normalizedQuery = sqlQuery.trim().toLowerCase();
    if (!normalizedQuery.startsWith('select')) {
      console.log("❌ Invalid query type - not SELECT:", normalizedQuery.substring(0, 50));
      throw new Error('Seules les requêtes SELECT sont autorisées');
    }

    // Additional safety checks
    const dangerousKeywords = ['drop', 'delete', 'update', 'insert', 'alter', 'create', 'truncate'];
    const containsDangerous = dangerousKeywords.some(keyword => 
      normalizedQuery.includes(keyword.toLowerCase())
    );

    if (containsDangerous) {
      console.log("❌ Dangerous keywords detected in query");
      throw new Error('Requête contient des mots-clés non autorisés');
    }

    console.log("✅ SQL query validated, executing...");
    const result = await db.execute(sqlQuery);
    console.log("✅ Query executed successfully, rows:", result.rows.length);

    return result.rows;
  } catch (error) {
    console.error('❌ Error executing SQL:', error);

    if (error instanceof Error) {
      // More specific error handling
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        throw new Error('Colonne inexistante dans la base de données. Vérifiez le schéma.');
      } else if (error.message.includes('table') && error.message.includes('does not exist')) {
        throw new Error('Table inexistante dans la base de données. Vérifiez le schéma.');
      } else if (error.message.includes('syntax error')) {
        throw new Error('Erreur de syntaxe SQL. La requête générée est invalide.');
      } else if (error.message.includes('autorisées') || error.message.includes('mots-clés')) {
        throw error; // Re-throw our security errors as-is
      } else {
        throw new Error(`Erreur d'exécution SQL: ${error.message}`);
      }
    }

    throw new Error('Erreur lors de l\'exécution de la requête SQL');
  }
}

// Hash for webhook verification
function createWebhookSignature(payload: any, secret: string): string {
  const hmac = createHash('sha256')
    .update(JSON.stringify(payload))
    .update(secret)
    .digest('hex');
  return hmac;
}

// Verify webhook signature
function verifyWebhookSignature(
  payload: any, 
  signature: string, 
  secret: string
): boolean {
  const expectedSignature = createWebhookSignature(payload, secret);
  return expectedSignature === signature;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  app.use('/api', chatRouter);
  app.use('/api', learnWorldsRouter);
  app.use('/api', ecosRouter);
  app.use('/api', adminRouter);

  return httpServer;
}