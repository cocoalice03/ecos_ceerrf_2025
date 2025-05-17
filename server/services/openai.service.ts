import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || ""
});

export interface RAGContent {
  content: string;
  metadata?: {
    source?: string;
    [key: string]: any;
  };
}

export class OpenAIService {
  private systemPrompt = `You are an educational assistant for a LearnWorlds learning management system.
Answer questions about the course content based on the context provided.
Be helpful, precise, and concise. If you don't know the answer based on the provided context, say so clearly.
Do not make up information. Cite sources from the context when relevant.`;

  /**
   * Generates a response for the given question based on relevant content
   */
  async generateResponse(question: string, relevantContent: RAGContent[]): Promise<string> {
    try {
      // Format the context for better prompt understanding
      let contextText = '';
      if (relevantContent && relevantContent.length > 0) {
        contextText = relevantContent.map((item, index) => {
          const source = item.metadata?.source ? ` (Source: ${item.metadata.source})` : '';
          return `Context ${index + 1}${source}:\n${item.content}\n`;
        }).join('\n');
      }
      
      const userPrompt = `Question: ${question}\n\nRelevant Content:\n${contextText}`;
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: this.systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.5,
        max_tokens: 1000,
      });
      
      return response.choices[0].message.content || "Je n'ai pas pu générer une réponse. Veuillez réessayer.";
    } catch (error) {
      console.error("Error generating OpenAI response:", error);
      throw new Error("Impossible de générer une réponse. Service indisponible.");
    }
  }
}

export const openaiService = new OpenAIService();
