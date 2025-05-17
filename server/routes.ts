import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { openaiService } from "./services/openai.service";
import { pineconeService } from "./services/pinecone.service";
import { insertExchangeSchema, insertSessionSchema } from "@shared/schema";
import { createHash, randomBytes } from "crypto";
import { z } from "zod";

// Max questions per day per user
const MAX_DAILY_QUESTIONS = 20;

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
      
      // Parse and validate the session data
      const sessionData = insertSessionSchema.parse({ email });
      
      // Create or update user session
      const session = await storage.createSession(sessionData);
      
      // Return the session
      return res.status(200).json({ 
        message: "Session created successfully",
        session: { email: session.email }
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
      // Validate request
      const askSchema = z.object({
        email: z.string().email(),
        question: z.string().min(1).max(500),
      });
      
      const { email, question } = askSchema.parse(req.body);
      
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

  return httpServer;
}
