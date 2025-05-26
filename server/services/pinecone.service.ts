import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from "openai";
import { RAGContent } from './openai.service';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || ""
});

export class PineconeService {
  private pinecone;
  private index;
  private indexName: string;
  private namespace: string;
  
  constructor() {
    try {
      // Get Pinecone credentials from environment variables
      const apiKey = process.env.PINECONE_API_KEY;
      this.indexName = process.env.PINECONE_INDEX_NAME || 'learnworlds-courses';
      this.namespace = process.env.PINECONE_NAMESPACE || 'default';
      
      if (!apiKey) {
        console.warn('Missing Pinecone API key - running in fallback mode');
        this.pinecone = null;
        this.index = null;
        return;
      }
      
      // Initialize Pinecone client
      this.pinecone = new Pinecone({
        apiKey,
      });
      
      // Get the index
      this.index = this.pinecone.index(this.indexName);
      console.log(`Connected to Pinecone index: ${this.indexName}`);
    } catch (error) {
      console.error('Error initializing Pinecone service:', error);
      console.warn('Running in fallback mode without Pinecone');
      this.pinecone = null;
      this.index = null;
    }
  }
  
  /**
   * Gets the vector embedding for a text string using OpenAI
   */
  private async getEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
        encoding_format: "float",
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error("Error getting embedding:", error);
      throw new Error("Failed to generate embedding for query");
    }
  }
  
  /**
   * Search for relevant content based on the question
   */
  async searchRelevantContent(question: string, topK: number = 3): Promise<RAGContent[]> {
    try {
      // Check if Pinecone is available
      if (!this.pinecone || !this.index) {
        console.warn('Pinecone not available - returning empty results');
        return [];
      }

      // Get embedding for the question
      const embedding = await this.getEmbedding(question);
      
      // Query Pinecone
      const queryResponse = await this.index.query({
        vector: embedding,
        topK,
        includeMetadata: true,
      });
      
      // Process and return the results
      const results: RAGContent[] = [];
      
      for (const match of queryResponse.matches) {
        if (match.metadata && typeof match.metadata.text === 'string') {
          results.push({
            content: match.metadata.text,
            metadata: {
              source: typeof match.metadata.source === 'string' ? match.metadata.source : undefined,
            }
          });
        }
      }
      
      return results;
    } catch (error) {
      console.error("Error searching Pinecone:", error);
      return [];
    }
  }
}

export const pineconeService = new PineconeService();
