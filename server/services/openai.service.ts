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

  /**
   * Convert natural language question to SQL query
   */
  async convertToSQL(question: string, databaseSchema: string): Promise<string> {
    try {
      const prompt = `Tu es un expert en SQL. Convertis cette question en langage naturel en requête SQL valide.

Schéma de la base de données :
${databaseSchema}

Question : ${question}

Instructions :
- Génère uniquement une requête SELECT (pas d'INSERT, UPDATE, DELETE)
- Utilise la syntaxe PostgreSQL
- Inclus les alias de tables si nécessaire
- Réponds uniquement avec la requête SQL, sans explication

Requête SQL :`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          { role: "system", content: "Tu es un expert en conversion de langage naturel vers SQL. Réponds uniquement avec la requête SQL demandée." },
          { role: "user", content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.1
      });

      let sqlQuery = response.choices[0].message.content?.trim() || '';
      
      // Extract SQL from response if it's wrapped in markdown or explanations
      const sqlMatch = sqlQuery.match(/```(?:sql)?\s*(SELECT[\s\S]*?)```/i);
      if (sqlMatch) {
        sqlQuery = sqlMatch[1].trim();
      } else {
        // Look for SELECT statement anywhere in the response
        const selectMatch = sqlQuery.match(/(SELECT[\s\S]*?)(?:\n\n|$)/i);
        if (selectMatch) {
          sqlQuery = selectMatch[1].trim();
        }
      }
      
      // Basic validation
      if (!sqlQuery.toLowerCase().includes('select')) {
        throw new Error('Aucune requête SELECT valide trouvée dans la réponse');
      }

      return sqlQuery;
    } catch (error) {
      console.error("Error converting to SQL:", error);
      throw new Error("Impossible de convertir la question en requête SQL");
    }
  }
}

export const openaiService = new OpenAIService();
