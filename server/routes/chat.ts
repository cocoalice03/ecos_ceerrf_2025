
import { Router } from 'express';
import type { Request, Response } from 'express';
import { storage } from '../storage';
import { openaiService } from '../services/openai.service';
import { pineconeService } from '../services/pinecone.service';
import { insertExchangeSchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

// Max questions per day per user
const MAX_DAILY_QUESTIONS = 20;

// Get user status (questions remaining)
router.get('/status', async (req: Request, res: Response) => {
  try {
    const email = req.query.email as string;
    
    if (!email) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Email parameter is required' 
      });
    }

    const decodedEmail = decodeURIComponent(email);
    const today = new Date().toISOString().split('T')[0];
    
    const dailyCount = await storage.getDailyQuestionCount(decodedEmail, today);
    const questionsRemaining = Math.max(0, MAX_DAILY_QUESTIONS - dailyCount);
    const limitReached = dailyCount >= MAX_DAILY_QUESTIONS;

    res.json({
      status: 'success',
      questionsRemaining,
      totalQuestions: MAX_DAILY_QUESTIONS,
      limitReached,
      dailyCount
    });
  } catch (error) {
    console.error('Error getting user status:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Internal server error' 
    });
  }
});

// Get chat history
router.get('/history', async (req: Request, res: Response) => {
  try {
    const email = req.query.email as string;
    
    if (!email) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Email parameter is required' 
      });
    }

    const decodedEmail = decodeURIComponent(email);
    const exchanges = await storage.getChatHistory(decodedEmail);

    res.json({
      status: 'success',
      exchanges
    });
  } catch (error) {
    console.error('Error getting chat history:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Internal server error' 
    });
  }
});

// Ask a question
router.post('/ask', async (req: Request, res: Response) => {
  try {
    const { email, question } = req.body;

    if (!email || !question) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and question are required'
      });
    }

    const decodedEmail = decodeURIComponent(email);
    const today = new Date().toISOString().split('T')[0];
    
    // Check daily limit
    const dailyCount = await storage.getDailyQuestionCount(decodedEmail, today);
    if (dailyCount >= MAX_DAILY_QUESTIONS) {
      return res.status(429).json({
        status: 'error',
        message: 'Daily question limit reached',
        limitReached: true
      });
    }

    // Get relevant context from Pinecone
    const relevantDocs = await pineconeService.searchSimilarDocuments(question);
    
    // Generate response using OpenAI
    const response = await openaiService.generateResponse(question, relevantDocs);
    
    // Store the exchange
    const exchange = await storage.storeExchange({
      utilisateur_email: decodedEmail,
      question,
      reponse: response,
      timestamp: new Date()
    });

    // Update daily counter
    await storage.incrementDailyQuestionCount(decodedEmail, today);

    // Check if limit reached after this question
    const newDailyCount = dailyCount + 1;
    const limitReached = newDailyCount >= MAX_DAILY_QUESTIONS;

    res.json({
      status: 'success',
      id: exchange.id,
      question,
      response,
      timestamp: exchange.timestamp,
      limitReached
    });

  } catch (error) {
    console.error('Error processing question:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

export default router;
