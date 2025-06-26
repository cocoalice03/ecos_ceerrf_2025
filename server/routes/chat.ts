
import { Router, Request, Response } from 'express';
import { createHash } from 'crypto';
import { openaiService } from '../services/openai.service';
import { storage } from "../storage";
import { pineconeService } from '../services/pinecone.service';
import { db } from '../db';
import { z } from 'zod';
import { users, trainingSessions, trainingSessionStudents } from '@shared/schema';
import { eq, and, lte, gte } from 'drizzle-orm';

const router = Router();

const MAX_DAILY_QUESTIONS = 20;

function createWebhookSignature(payload: any, secret: string): string {
  return createHash('sha256').update(JSON.stringify(payload)).update(secret).digest('hex');
}

function verifyWebhookSignature(payload: any, signature: string, secret: string): boolean {
  return createWebhookSignature(payload, secret) === signature;
}

async function createStudentAccount(email: string) {
  const decodedEmail = decodeURIComponent(email);
  const existing = await db.select().from(users).where(eq(users.email, decodedEmail)).limit(1);
  let user = existing[0];
  let isNewUser = false;
  if (!user) {
    const [newUser] = await db.insert(users).values({
      id: decodedEmail,
      email: decodedEmail,
      firstName: null,
      lastName: null,
      profileImageUrl: null
    }).returning();
    user = newUser;
    isNewUser = true;
  }

  const existingAssignment = await db
    .select({ trainingSessionId: trainingSessionStudents.trainingSessionId })
    .from(trainingSessionStudents)
    .where(eq(trainingSessionStudents.studentEmail, decodedEmail))
    .limit(1);

  if (existingAssignment.length === 0) {
    const now = new Date();
    const activeSession = await db
      .select({ id: trainingSessions.id, title: trainingSessions.title })
      .from(trainingSessions)
      .where(and(lte(trainingSessions.startDate, now), gte(trainingSessions.endDate, now)))
      .orderBy(trainingSessions.createdAt)
      .limit(1);
    if (activeSession.length > 0) {
      await db.insert(trainingSessionStudents).values({
        trainingSessionId: activeSession[0].id,
        studentEmail: decodedEmail
      });
    }
  }

  return { user, isNewUser };
}

router.get('/test/db', async (_req: Request, res: Response) => {
  try {
    const result = await db.execute('SELECT NOW() as current_time, 1 as test_value');
    return res.status(200).json({ status: 'success', result: result.rows[0], timestamp: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ status: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const signature = req.headers['x-webhook-signature'] as string;
    const secret = process.env.WEBHOOK_SECRET || '';
    if (signature && secret) {
      if (!verifyWebhookSignature(req.body, signature, secret)) {
        return res.status(401).json({ message: 'Invalid webhook signature' });
      }
    }

    await createStudentAccount(email);
    return res.status(200).json({ message: 'Session created successfully', session: { email } });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to process webhook' });
  }
});

router.post('/student/auto-register', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') return res.status(400).json({ message: 'Email requis' });

    const decodedEmail = decodeURIComponent(email);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(decodedEmail)) return res.status(400).json({ message: "Format d'email invalide" });

    const result = await createStudentAccount(decodedEmail);
    return res.status(200).json({ message: 'Compte étudiant créé/mis à jour avec succès', user: result.user, isNewUser: result.isNewUser });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la création du compte' });
  }
});

router.get('/status', async (req: Request, res: Response) => {
  try {
    const { email } = req.query;
    if (!email || typeof email !== 'string') return res.status(400).json({ message: 'Valid email is required' });

    const now = new Date();
    now.setHours(now.getHours() + 2);
    const counter = await storage.getDailyCounter(email, now);
    const used = counter?.count || 0;
    return res.status(200).json({
      email,
      questionsUsed: used,
      questionsRemaining: MAX_DAILY_QUESTIONS - used,
      maxDailyQuestions: MAX_DAILY_QUESTIONS,
      limitReached: used >= MAX_DAILY_QUESTIONS
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to get user status' });
  }
});

router.post('/ask', async (req: Request, res: Response) => {
  try {
    let email = req.body.email || '';
    const question = req.body.question || '';
    if (typeof email === 'string') {
      email = email.replace(/^.*email=/, '').replace(/%40/g, '@').replace(/%2E/g, '.');
      if (email.includes('%')) email = decodeURIComponent(email);
    }
    if (!email || !email.includes('@') || question.length === 0) {
      return res.status(400).json({ message: 'Email et question requis', errors: [{ field: 'email', message: 'Email valide requis' }] });
    }

    const now = new Date();
    now.setHours(now.getHours() + 2);
    const counter = await storage.getDailyCounter(email, now);
    const used = counter?.count || 0;
    if (used >= MAX_DAILY_QUESTIONS) return res.status(429).json({ message: 'Daily question limit reached. Try again tomorrow.', limitReached: true });

    const relevant = await pineconeService.searchRelevantContent(question);
    const response = await openaiService.generateResponse(question, relevant);
    const exchange = await storage.saveExchange({ email, question, response });
    const updated = await storage.incrementDailyCounter(email, now);

    return res.status(200).json({
      id: exchange.id,
      question,
      response,
      timestamp: exchange.timestamp,
      questionsUsed: updated.count,
      questionsRemaining: MAX_DAILY_QUESTIONS - updated.count,
      limitReached: updated.count >= MAX_DAILY_QUESTIONS
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
    }
    return res.status(500).json({ message: 'Failed to process your question. Please try again later.' });
  }
});

router.get('/history', async (req: Request, res: Response) => {
  try {
    const { email } = req.query;
    if (!email || typeof email !== 'string') return res.status(400).json({ message: 'Valid email is required' });
    const exchanges = await storage.getExchangesByEmail(email, 50);
    return res.status(200).json({ exchanges });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch chat history' });
  }
});

export default router;
