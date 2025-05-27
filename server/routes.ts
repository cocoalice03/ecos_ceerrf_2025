import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { openaiService } from "./services/openai.service";
import { pineconeService } from "./services/pinecone.service";
import { learnWorldsService } from "./services/learnworlds.service";
import { insertExchangeSchema } from "@shared/schema";
import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { db } from "./db";
import multer from 'multer';
import pdfParse from 'pdf-parse';

// Max questions per day per user
const MAX_DAILY_QUESTIONS = 20;

// Admin emails authorized to access admin features
const ADMIN_EMAILS = ['cherubindavid@gmail.com', 'colombemadoungou@gmail.com'];

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
  return ADMIN_EMAILS.includes(email.toLowerCase());
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
- sessions: id (integer), email (text), created_at (timestamp), expires_at (timestamp)
- exchanges: id (integer), email (text), question (text), response (text), timestamp (timestamp), session_id (integer)
- daily_counters: id (integer), email (text), date (date), count (integer), created_at (timestamp), updated_at (timestamp)

Exemples de requêtes:
- SELECT * FROM exchanges WHERE email = 'example@email.com'
- SELECT COUNT(*) FROM exchanges WHERE DATE(timestamp) = CURRENT_DATE
- SELECT email, COUNT(*) as total_questions FROM exchanges GROUP BY email
- SELECT * FROM daily_counters WHERE date = CURRENT_DATE
      `.trim();
    }
  } catch (error) {
    console.error('Error getting schema:', error);
    return `
Tables disponibles:
- sessions: id, email, created_at, expires_at
- exchanges: id, email, question, response, timestamp, session_id
- daily_counters: id, email, date, count, created_at, updated_at

Exemples de requêtes:
- SELECT * FROM exchanges WHERE email = 'example@email.com'
- SELECT COUNT(*) FROM exchanges WHERE DATE(timestamp) = CURRENT_DATE
    `.trim();
  }
}

// Execute SQL query safely (read-only)
async function executeSQLQuery(sqlQuery: string) {
  try {
    // Only allow SELECT queries for safety
    const normalizedQuery = sqlQuery.trim().toLowerCase();
    if (!normalizedQuery.startsWith('select')) {
      throw new Error('Seules les requêtes SELECT sont autorisées');
    }
    
    const result = await db.execute(sqlQuery);
    return result.rows;
  } catch (error) {
    console.error('Error executing SQL:', error);
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
  // Create HTTP server
  const httpServer = createServer(app);

  // Webhook endpoint for LearnWorlds/Zapier integration
  app.post("/api/webhook", async (req: Request, res: Response) => {
    try {
      // Check for required fields
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      // Optional: Verify webhook signature if Zapier provides it
      const signature = req.headers["x-webhook-signature"] as string;
      const webhookSecret = process.env.WEBHOOK_SECRET || "";
      
      if (signature && webhookSecret) {
        if (!verifyWebhookSignature(req.body, signature, webhookSecret)) {
          return res.status(401).json({ message: "Invalid webhook signature" });
        }
      }
      
      // Simple email validation - no session storage needed
      
      // Return the session
      return res.status(200).json({ 
        message: "Session created successfully",
        session: { email }
      });
    } catch (error) {
      console.error("Error processing webhook:", error);
      return res.status(500).json({ message: "Failed to process webhook" });
    }
  });

  // Get user status (questions remaining)
  app.get("/api/status", async (req: Request, res: Response) => {
    try {
      // Get user email from query params
      const { email } = req.query;
      
      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "Valid email is required" });
      }
      
      // Get today's date (UTC+2 timezone)
      const now = new Date();
      // Adjust to UTC+2 (2 hours ahead of UTC)
      now.setHours(now.getHours() + 2);
      
      // Get user's daily counter
      const counter = await storage.getDailyCounter(email, now);
      
      // Calculate questions used/remaining
      const questionsUsed = counter?.count || 0;
      const questionsRemaining = MAX_DAILY_QUESTIONS - questionsUsed;
      
      return res.status(200).json({
        email,
        questionsUsed,
        questionsRemaining,
        maxDailyQuestions: MAX_DAILY_QUESTIONS,
        limitReached: questionsUsed >= MAX_DAILY_QUESTIONS,
      });
    } catch (error) {
      console.error("Error getting user status:", error);
      return res.status(500).json({ message: "Failed to get user status" });
    }
  });

  // Ask a question (main RAG endpoint)
  app.post("/api/ask", async (req: Request, res: Response) => {
    try {
      // Simple validation with email cleaning
      let email = req.body.email || '';
      const question = req.body.question || '';

      // Clean up the email if it's URL encoded or malformed
      if (typeof email === 'string') {
        email = email.replace(/^.*email=/, '').replace(/%40/g, '@').replace(/%2E/g, '.');
        if (email.includes('%')) {
          email = decodeURIComponent(email);
        }
      }

      // Basic validation
      if (!email || !email.includes('@') || question.length === 0) {
        return res.status(400).json({ 
          message: "Email et question requis",
          errors: [{ field: "email", message: "Email valide requis" }]
        });
      }
      
      // Get today's date (UTC+2 timezone)
      const now = new Date();
      // Adjust to UTC+2 (2 hours ahead of UTC)
      now.setHours(now.getHours() + 2);
      
      // Check if user has reached daily limit
      const counter = await storage.getDailyCounter(email, now);
      const questionsUsed = counter?.count || 0;
      
      if (questionsUsed >= MAX_DAILY_QUESTIONS) {
        return res.status(429).json({ 
          message: "Daily question limit reached. Try again tomorrow.",
          limitReached: true
        });
      }
      
      // 1. Use Pinecone to find relevant content
      const relevantContent = await pineconeService.searchRelevantContent(question);
      
      // 2. Generate response using OpenAI and the relevant content
      const response = await openaiService.generateResponse(question, relevantContent);
      
      // 3. Save the exchange
      const exchange = await storage.saveExchange({
        email,
        question,
        response
      });
      
      // 4. Increment user's daily counter
      const updatedCounter = await storage.incrementDailyCounter(email, now);
      
      // 5. Return the answer and updated status
      return res.status(200).json({
        id: exchange.id,
        question,
        response,
        timestamp: exchange.timestamp,
        questionsUsed: updatedCounter.count,
        questionsRemaining: MAX_DAILY_QUESTIONS - updatedCounter.count,
        limitReached: updatedCounter.count >= MAX_DAILY_QUESTIONS
      });
    } catch (error) {
      console.error("Error processing question:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: error.errors 
        });
      }
      
      return res.status(500).json({ 
        message: "Failed to process your question. Please try again later." 
      });
    }
  });

  // Get user chat history
  app.get("/api/history", async (req: Request, res: Response) => {
    try {
      // Get user email from query params
      const { email } = req.query;
      
      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "Valid email is required" });
      }
      
      // Get the chat history
      const exchanges = await storage.getExchangesByEmail(email, 50);
      
      return res.status(200).json({ exchanges });
    } catch (error) {
      console.error("Error fetching chat history:", error);
      return res.status(500).json({ message: "Failed to fetch chat history" });
    }
  });

  // Admin: Upload and process documents for Pinecone
  app.post("/api/admin/documents", async (req: Request, res: Response) => {
    try {
      const adminSchema = z.object({
        email: z.string().email(),
        title: z.string().min(1),
        content: z.string().min(1),
        category: z.string().optional().default("general"),
      });
      
      const { email, title, content, category } = adminSchema.parse(req.body);
      
      if (!isAdminAuthorized(email)) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }
      
      // Split content into chunks for better retrieval
      const chunks = splitIntoChunks(content, 1000, 200);
      
      // Process each chunk and add to Pinecone
      const results = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunkId = `${title.toLowerCase().replace(/\s+/g, '-')}-chunk-${i}`;
        const embedding = await pineconeService.getEmbedding(chunks[i]);
        
        // Store in Pinecone with metadata
        const vectorData = {
          id: chunkId,
          values: embedding,
          metadata: {
            text: chunks[i],
            source: title,
            category: category,
            chunk_index: i,
            timestamp: new Date().toISOString()
          }
        };
        
        results.push(vectorData);
      }
      
      // Bulk upsert to Pinecone
      await pineconeService.upsertVectors(results);
      
      return res.status(200).json({ 
        message: "Document traité avec succès",
        chunks_created: chunks.length,
        document_title: title
      });
    } catch (error) {
      console.error("Error processing document:", error);
      return res.status(500).json({ message: "Erreur lors du traitement du document" });
    }
  });

  // Admin: Get all documents/sources from Pinecone
  app.get("/api/admin/documents", async (req: Request, res: Response) => {
    try {
      const { email } = req.query;
      
      if (!email || typeof email !== "string" || !isAdminAuthorized(email)) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }
      
      const sources = await pineconeService.getAllSources();
      return res.status(200).json({ sources });
    } catch (error) {
      console.error("Error fetching documents:", error);
      return res.status(500).json({ message: "Erreur lors de la récupération des documents" });
    }
  });

  // Admin: Delete document from Pinecone
  app.delete("/api/admin/documents/:documentId", async (req: Request, res: Response) => {
    try {
      const { documentId } = req.params;
      const { email } = req.query;
      
      if (!email || typeof email !== "string" || !isAdminAuthorized(email)) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }
      
      await pineconeService.deleteDocument(documentId);
      return res.status(200).json({ message: "Document supprimé avec succès" });
    } catch (error) {
      console.error("Error deleting document:", error);
      return res.status(500).json({ message: "Erreur lors de la suppression du document" });
    }
  });

  // Natural Language to SQL Query
  app.post("/api/admin/nl-to-sql", async (req: Request, res: Response) => {
    try {
      const nlSchema = z.object({
        email: z.string().email(),
        question: z.string().min(1),
        database_schema: z.string().optional(),
      });
      
      const { email, question, database_schema } = nlSchema.parse(req.body);
      
      if (!isAdminAuthorized(email)) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }
      
      // Get database schema if not provided
      const schema = database_schema || await getDatabaseSchema();
      
      // Convert natural language to SQL using OpenAI
      const sqlQuery = await openaiService.convertToSQL(question, schema);
      
      // Execute the query safely (read-only)
      const results = await executeSQLQuery(sqlQuery);
      
      return res.status(200).json({ 
        question,
        sql_query: sqlQuery,
        results,
        executed_at: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error processing NL to SQL:", error);
      return res.status(500).json({ message: "Erreur lors de la conversion en SQL" });
    }
  });

  // Special endpoint for LearnWorlds integration
  app.post("/api/learnworlds/chat", async (req: Request, res: Response) => {
    try {
      // Validate request
      const chatSchema = z.object({
        email: z.string().email(),
        query: z.string().min(1).max(500),
      });
      
      // Set CORS headers for LearnWorlds
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type");
      
      // Handle preflight requests
      if (req.method === "OPTIONS") {
        return res.status(200).send();
      }
      
      const { email, query } = chatSchema.parse(req.body);
      
      // Process the query through the LearnWorlds service
      const result = await learnWorldsService.processQuery(email, query);
      
      return res.status(200).json(result);
    } catch (error) {
      console.error("Error processing LearnWorlds chat:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          status: 'error',
          message: "Format de requête invalide", 
          errors: error.errors 
        });
      }
      
      return res.status(500).json({ 
        status: 'error',
        message: "Une erreur est survenue lors du traitement de votre question. Veuillez réessayer plus tard."
      });
    }
  });

  return httpServer;
}
