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
import { ecosService } from './services/ecos.service';
import { promptGenService } from './services/promptGen.service';
import { evaluationService } from './services/evaluation.service';
import { ecosScenarios, ecosSessions } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Max questions per day per user
const MAX_DAILY_QUESTIONS = 20;

// Admin emails authorized to access admin features
const ADMIN_EMAILS = ['cherubindavid@gmail.com', 'colombemadoungou@gmail.com', 'testteacher@gmail.com'];

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


// Generate evaluation criteria from text description
app.post('/api/ecos/generate-criteria', async (req, res) => {
  try {
    const { description, email } = req.body;
    
    if (!description || !email) {
      return res.status(400).json({ message: 'Description et email requis' });
    }

    // Check authorization
    if (!isAdminAuthorized(email)) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    const criteria = await promptGenService.generateEvaluationCriteria(description);
    
    res.json({ criteria });
  } catch (error) {
    console.error('Error generating criteria:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la génération des critères',
      error: error.message 
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

  // Admin: List all Pinecone indexes
  app.get("/api/admin/indexes", async (req: Request, res: Response) => {
    console.log('🚀 Admin indexes endpoint called');
    console.log('Request query:', req.query);
    console.log('Request headers:', req.headers);

    try {
      const { email } = req.query;
      console.log('📧 Email from query:', email);

      if (!email || typeof email !== "string") {
        console.log('❌ Email validation failed - missing or invalid email');
        return res.status(400).json({ message: "Email requis" });
      }

      console.log('🔐 Checking admin authorization for:', email);
      const isAuthorized = isAdminAuthorized(email);
      console.log('✅ Authorization result:', isAuthorized);

      if (!isAuthorized) {
        console.log('❌ Access denied for email:', email);
        return res.status(403).json({ message: "Accès non autorisé" });
      }

      console.log('🔍 Fetching Pinecone indexes for admin:', email);

      // Check if pineconeService is available
      if (!pineconeService) {
        console.error('❌ pineconeService is not available');
        return res.status(503).json({ 
          message: "Service Pinecone non disponible",
          details: "Le service Pinecone n'est pas initialisé"
        });
      }

      const indexes = await pineconeService.listIndexes();
      console.log('✅ Successfully retrieved indexes:', indexes);

      return res.status(200).json({ 
        indexes,
        timestamp: new Date().toISOString(),
        email 
      });
    } catch (error) {
      console.error("❌ Critical error in admin indexes endpoint:", error);
      console.error("Error type:", typeof error);
      console.error("Error instanceof Error:", error instanceof Error);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorDetails = {
        message: errorMessage,
        type: error instanceof Error ? error.constructor.name : typeof error,
        timestamp: new Date().toISOString()
      };

      return res.status(500).json({ 
        message: "Erreur lors de la récupération des index",
        details: errorMessage,
        debug: errorDetails
      });
    }
  });

  // Admin: Create a new Pinecone index
  app.post("/api/admin/indexes", async (req: Request, res: Response) => {
    try {
      const indexSchema = z.object({
        email: z.string().email(),
        name: z.string().min(1).max(45).regex(/^[a-z0-9._-]+$/, "Le nom doit contenir uniquement des lettres minuscules, chiffres, tirets, points et underscores"),
        dimension: z.number().optional().default(1536),
      });

      const { email, name, dimension } = indexSchema.parse(req.body);

      if (!isAdminAuthorized(email)) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }

      await pineconeService.createIndex(name, dimension);
      return res.status(201).json({ message: `Index ${name} créé avec succès` });
    } catch (error: any) {
      console.error("Error creating Pinecone index:", error);

      // Handle Zod validation errors specifically
      if (error.name === 'ZodError') {
        const validationErrors = error.errors.map((err: any) => err.message).join(', ');
        return res.status(400).json({ 
          message: `Erreur de validation: ${validationErrors}`,
          details: "Assurez-vous que le nom contient uniquement des lettres minuscules, chiffres et tirets (ex: cours-test, documents-2024)"
        });
      }

      // Handle Pinecone quota limits
      if (error.message && error.message.includes('max serverless indexes allowed')) {
        return res.status(400).json({
          message: "Limite d'index atteinte",
          details: "Vous avez atteint la limite maximale d'index Pinecone (5). Supprimez un index inutilisé ou mettez à niveau votre plan Pinecone.",
          type: "quota_exceeded"
        });
      }

      const errorMessage = error?.message || "Erreur lors de la création de l'index";
      return res.status(500).json({ 
        message: errorMessage,
        details: error?.response?.data || error?.toString()
      });
    }
  });

  // Admin: Switch to a different Pinecone index
  app.post("/api/admin/indexes/switch", async (req: Request, res: Response) => {
    try {
      const switchSchema = z.object({
        email: z.string().email(),
        indexName: z.string().min(1),
      });

      const { email, indexName } = switchSchema.parse(req.body);

      if (!isAdminAuthorized(email)) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }

      await pineconeService.switchIndex(indexName);
      return res.status(200).json({ message: `Changement vers l'index ${indexName} réussi` });
    } catch (error) {
      console.error("Error switching Pinecone index:", error);
      return res.status(500).json({ message: "Erreur lors du changement d'index" });
    }
  });

  // Admin: Upload and process PDF documents
  app.post("/api/admin/upload-pdf", upload.single('pdf'), async (req: Request, res: Response) => {
    try {
      const { email, title, category } = req.body;

      if (!email || !isAdminAuthorized(email)) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Aucun fichier PDF fourni" });
      }

      if (!title || !category) {
        return res.status(400).json({ message: "Titre et catégorie sont requis" });
      }

      // Extract text from PDF using pdf-parse
      const pdfParse = await import('pdf-parse');
      const pdfData = await pdfParse.default(req.file.buffer);
      const extractedText = pdfData.text;

      if (!extractedText || extractedText.trim().length === 0) {
        return res.status(400).json({ message: "Le PDF ne contient pas de texte extractible" });
      }

      // Process and store in Pinecone
      await pineconeService.processPDFContent(extractedText, title, category);

      return res.status(201).json({ 
        message: `Document ${title} traité et ajouté avec succès`,
        pages: pdfData.numpages,
        textLength: extractedText.length,
        preview: extractedText.substring(0, 200) + '...'
      });
    } catch (error) {
      console.error("Error processing PDF:", error);
      return res.status(500).json({ message: "Erreur lors du traitement du PDF" });
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

  // ==================== ECOS ROUTES ====================

  // Teacher Routes - Scenario Management
  app.post("/api/ecos/scenarios", async (req: Request, res: Response) => {
    try {
      const createSchema = z.object({
        email: z.string().email(),
        title: z.string().min(1),
        description: z.string().min(1),
        patientPrompt: z.string().optional(),
        evaluationCriteria: z.any().optional(),
        pineconeIndex: z.string().optional(),
      });

      const { email, title, description, patientPrompt, evaluationCriteria, pineconeIndex } = createSchema.parse(req.body);

      if (!isAdminAuthorized(email)) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }

      // Generate patient prompt if not provided
      let finalPatientPrompt = patientPrompt;
      if (!finalPatientPrompt) {
        try {
          finalPatientPrompt = await promptGenService.generatePatientPrompt(description);
        } catch (error) {
          console.log('Auto-generation failed, using default prompt');
          finalPatientPrompt = `Tu es un patient présentant les symptômes suivants: ${description}. Réponds aux questions de l'étudiant en médecine de manière réaliste et cohérente avec ton état.`;
        }
      }

      // Generate evaluation criteria if not provided
      let finalCriteria = evaluationCriteria;
      if (!finalCriteria) {
        try {
          finalCriteria = await promptGenService.generateEvaluationCriteria(description);
        } catch (error) {
          console.log('Auto-generation failed, using default criteria');
          finalCriteria = {
            "communication": 20,
            "anamnese": 25,
            "examen_physique": 25,
            "raisonnement_clinique": 30
          };
        }
      }

      const result = await db.insert(ecosScenarios).values({
        title,
        description,
        patientPrompt: finalPatientPrompt,
        evaluationCriteria: finalCriteria,
        createdBy: email,
      }).returning();

      return res.status(201).json({ 
        message: "Scénario créé avec succès",
        scenario: result[0]
      });
    } catch (error) {
      console.error("Error creating ECOS scenario:", error);
      return res.status(500).json({ message: "Erreur lors de la création du scénario" });
    }
  });

  // Get scenarios for a teacher (admin only)
  app.get("/api/ecos/scenarios", async (req: Request, res: Response) => {
    try {
      const { email } = req.query;

      console.log('ECOS Scenarios - Full query:', req.query);
      console.log('ECOS Scenarios - Email received:', email);
      console.log('ECOS Scenarios - Email type:', typeof email);

      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "Email requis" });
      }

      // Decode the email if it's URL encoded
      const decodedEmail = decodeURIComponent(email);
      console.log('ECOS Scenarios - Decoded email:', decodedEmail);
      console.log('ECOS Scenarios - Is admin authorized:', isAdminAuthorized(decodedEmail));

      if (!isAdminAuthorized(decodedEmail)) {
        console.log('ECOS Scenarios - Authorization failed for:', decodedEmail);
        return res.status(403).json({ 
          message: "Accès non autorisé",
          debug: {
            originalEmail: email,
            decodedEmail,
            isAdmin: isAdminAuthorized(decodedEmail),
            adminEmails: ADMIN_EMAILS
          }
        });
      }

      const scenarios = await db.select().from(ecosScenarios).orderBy(ecosScenarios.createdAt);

      return res.status(200).json({ scenarios });
    } catch (error) {
      console.error("Error fetching scenarios:", error);
      return res.status(500).json({ message: "Erreur lors de la récupération des scénarios" });
    }
  });

  app.get("/api/ecos/scenarios/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { email } = req.query;

      if (!email || typeof email !== "string" || !isAdminAuthorized(email)) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }

      const scenario = await db.select().from(ecosScenarios).where(eq(ecosScenarios.id, parseInt(id))).limit(1);

      if (!scenario.length) {
        return res.status(404).json({ message: "Scénario non trouvé" });
      }

      return res.status(200).json({ scenario: scenario[0] });
    } catch (error) {
      console.error("Error fetching scenario:", error);
      return res.status(500).json({ message: "Erreur lors de la récupération du scénario" });
    }
  });

  app.put("/api/ecos/scenarios/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        email: z.string().email(),
        title: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        patientPrompt: z.string().optional(),
        evaluationCriteria: z.any().optional(),
      });

      const { email, ...updateData } = updateSchema.parse(req.body);

      if (!isAdminAuthorized(email)) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }

      const result = await db.update(ecosScenarios)
        .set(updateData)
        .where(eq(ecosScenarios.id, parseInt(id)))
        .returning();

      if (!result.length) {
        return res.status(404).json({ message: "Scénario non trouvé" });
      }

      return res.status(200).json({ 
        message: "Scénario mis à jour avec succès",
        scenario: result[0]
      });
    } catch (error) {
      console.error("Error updating scenario:", error);
      return res.status(500).json({ message: "Erreur lors de la mise à jour du scénario" });
    }
  });

  app.delete("/api/ecos/scenarios/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      // Try to get email from both query and body for flexibility
      const email = (req.query.email || req.body.email) as string;

      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "Email requis" });
      }

      if (!isAdminAuthorized(email)) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }

      const result = await db.delete(ecosScenarios).where(eq(ecosScenarios.id, parseInt(id))).returning();

      if (!result.length) {
        return res.status(404).json({ message: "Scénario non trouvé" });
      }

      return res.status(200).json({ message: "Scénario supprimé avec succès" });
    } catch (error) {
      console.error("Error deleting scenario:", error);
      return res.status(500).json({ message: "Erreur lors de la suppression du scénario" });
    }
  });

  // Student Routes - Session Management
  app.get("/api/ecos/sessions", async (req: Request, res: Response) => {
    try {
      const { email } = req.query;

      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "Email requis" });
      }

      const sessions = await ecosService.getStudentSessions(email);

      return res.status(200).json({ sessions });
    } catch (error) {
      console.error("Error fetching sessions:", error);
      return res.status(500).json({ message: "Erreur lors de la récupération des sessions" });
    }
  });

  app.post("/api/ecos/sessions", async (req: Request, res: Response) => {
    try {
      const sessionSchema = z.object({
        email: z.string().email(),
        scenarioId: z.number(),
      });

      const { email, scenarioId } = sessionSchema.parse(req.body);

      const sessionId = await ecosService.startSession(scenarioId, email);

      return res.status(201).json({ 
        message: "Session créée avec succès",
        sessionId 
      });
    } catch (error) {
      console.error("Error starting session:", error);
      return res.status(500).json({ message: "Erreur lors de la création de la session" });
    }
  });

  app.get("/api/ecos/sessions/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { email } = req.query;

      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "Email requis" });
      }

      const session = await ecosService.getSession(parseInt(id));

      if (!session) {
        return res.status(404).json({ message: "Session non trouvée" });
      }

      // Verify student access or admin access
      if (session.studentEmail !== email && !isAdminAuthorized(email)) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }

      return res.status(200).json({ session });
    } catch (error) {
      console.error("Error fetching session:", error);
      return res.status(500).json({ message: "Erreur lors de la récupération de la session" });
    }
  });

  app.put("/api/ecos/sessions/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        email: z.string().email(),
        status: z.string().optional(),
      });

      const { email, status } = updateSchema.parse(req.body);

      const session = await ecosService.getSession(parseInt(id));

      if (!session) {
        return res.status(404).json({ message: "Session non trouvée" });
      }

      // Verify student access or admin access
      if (session.studentEmail !== email && !isAdminAuthorized(email)) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }

      if (status === 'completed') {
        await ecosService.endSession(parseInt(id));

        // Auto-generate evaluation when session is completed
        try {
          await evaluationService.evaluateSession(parseInt(id));
        } catch (evalError) {
          console.error("Error auto-evaluating session:", evalError);
          // Continue even if evaluation fails
        }
      }

      return res.status(200).json({ message: "Session mise à jour avec succès" });
    } catch (error) {
      console.error("Error updating session:", error);
      return res.status(500).json({ message: "Erreur lors de la mise à jour de la session" });
    }
  });

  app.get("/api/ecos/sessions/:id/report", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { email } = req.query;

      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "Email requis" });
      }

      const session = await ecosService.getSession(parseInt(id));

      if (!session) {
        return res.status(404).json({ message: "Session non trouvée" });
      }

      // Verify student access or admin access
      if (session.studentEmail !== email && !isAdminAuthorized(email)) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }

      let report = await evaluationService.getSessionReport(parseInt(id));

      // Generate report if it doesn't exist and session is completed
      if (!report && session.status === 'completed') {
        const evaluation = await evaluationService.evaluateSession(parseInt(id));
        report = evaluation.report;
      }

      if (!report) {
        return res.status(404).json({ message: "Rapport non disponible - session non terminée" });
      }

      return res.status(200).json({ report });
    } catch (error) {
      console.error("Error fetching session report:", error);
      return res.status(500).json({ message: "Erreur lors de la récupération du rapport" });
    }
  });

  // Chatbot Routes
  app.post("/api/ecos/prompt-assistant", async (req: Request, res: Response) => {
    try {
      const promptSchema = z.object({
        email: z.string().email(),
        input: z.string().min(1),
        contextDocs: z.array(z.string()).optional().default([]),
      });

      const { email, input, contextDocs } = promptSchema.parse(req.body);

      if (!isAdminAuthorized(email)) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }

      const prompt = await promptGenService.generatePatientPrompt(input, contextDocs);

      return res.status(200).json({ prompt });
    } catch (error) {
      console.error("Error generating prompt:", error);
      return res.status(500).json({ message: "Erreur lors de la génération du prompt" });
    }
  });

  app.post("/api/ecos/patient-simulator", async (req: Request, res: Response) => {
    try {
      const simulatorSchema = z.object({
        email: z.string().email().optional(),
        sessionId: z.number(),
        query: z.string().min(1),
      });

      const { email, sessionId, query } = simulatorSchema.parse(req.body);

      // Verify session access if email provided
      if (email) {
        const session = await ecosService.getSession(sessionId);
        if (!session) {
          return res.status(404).json({ message: "Session non trouvée" });
        }

        if (session.studentEmail !== email && !isAdminAuthorized(email)) {
          return res.status(403).json({ message: "Accès non autorisé" });
        }
      }

      const response = await ecosService.simulatePatient(sessionId, query);

      return res.status(200).json({ response });
    } catch (error) {
      console.error("Error simulating patient:", error);
      return res.status(500).json({ message: "Erreur lors de la simulation du patient" });
    }
  });

  app.post("/api/ecos/evaluate", async (req: Request, res: Response) => {
    try {
      const evaluationSchema = z.object({
        email: z.string().email(),
        sessionId: z.number(),
      });

      const { email, sessionId } = evaluationSchema.parse(req.body);

      const session = await ecosService.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ message: "Session non trouvée" });
      }

      // Verify access (student can evaluate their own session, admin can evaluate any)
      if (session.studentEmail !== email && !isAdminAuthorized(email)) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }

      const evaluation = await evaluationService.evaluateSession(sessionId);

      return res.status(200).json(evaluation);
    } catch (error) {
      console.error("Error evaluating session:", error);
      return res.status(500).json({ message: "Erreur lors de l'évaluation" });
    }
  });

  // Get available scenarios for students
  app.get("/api/ecos/available-scenarios", async (req: Request, res: Response) => {
    try {
      const { email } = req.query;

      console.log('Available Scenarios - Full query:', req.query);
      console.log('Available Scenarios - Email received:', email);

      if (!email || typeof email !== "string") {
        console.log('Available Scenarios - Email validation failed:', email);
        return res.status(400).json({ message: "Email requis" });
      }

      // Get only basic scenario info for students (not the patient prompt)
      const scenarios = await db
        .select({
          id: ecosScenarios.id,
          title: ecosScenarios.title,
          description: ecosScenarios.description,
          createdAt: ecosScenarios.createdAt,
        })
        .from(ecosScenarios)
        .orderBy(ecosScenarios.createdAt);

      console.log('Available Scenarios - Query result:', scenarios);
      console.log('Available Scenarios - Number of scenarios found:', scenarios.length);

      return res.status(200).json({ scenarios });
    } catch (error) {
      console.error("Error fetching available scenarios:", error);
      return res.status(500).json({ message: "Erreur lors de la récupération des scénarios" });
    }
  });

  // Get dashboard data for teacher
  app.get("/api/teacher/dashboard", async (req: Request, res: Response) => {
    try {
      const { email } = req.query;

      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "Email requis" });
      }

      // Decode the email if it's URL encoded
      const decodedEmail = decodeURIComponent(email);

      if (!isAdminAuthorized(decodedEmail)) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }

      // Implement your dashboard data retrieval logic here
      // For example:
      const totalScenarios = await db.select().from(ecosScenarios).count();
      const totalSessions = await db.select().from(ecosSessions).count();

      return res.status(200).json({
        totalScenarios: totalScenarios[0].count,
        totalSessions: totalSessions[0].count,
        // ... other dashboard data
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      return res.status(500).json({ message: "Erreur lors de la récupération des données du tableau de bord" });
    }
  });

  // Admin health check endpoint
  app.get("/api/admin/health", async (req: Request, res: Response) => {
    try {
      const { email } = req.query;

      const healthCheck = {
        timestamp: new Date().toISOString(),
        server: {
          status: 'running',
          uptime: process.uptime(),
          memory: process.memoryUsage()
        },
        pinecone: {
          serviceAvailable: !!pineconeService,
          initialized: pineconeService ? 'yes' : 'no'
        },
        authorization: {
          emailProvided: !!email,
          emailType: typeof email,
          isAuthorized: email ? isAdminAuthorized(email as string) : false,
          adminEmails: ADMIN_EMAILS
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          hasPineconeKey: !!process.env.PINECONE_API_KEY,
          hasOpenAIKey: !!process.env.OPENAI_API_KEY
        }
      };

      return res.status(200).json(healthCheck);
    } catch (error) {
      console.error("Health check error:", error);
      return res.status(500).json({ 
        error: "Health check failed", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  return httpServer;
}