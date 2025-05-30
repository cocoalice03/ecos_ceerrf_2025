
import { openaiService } from './openai.service';
import { pineconeService } from './pinecone.service';
import { db } from '../db';
import { ecosSessions, ecosScenarios, ecosMessages, ecosEvaluations, ecosReports } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export class EcosService {
  async simulatePatient(sessionId: number, studentQuery: string): Promise<string> {
    try {
      // Get session and scenario info
      const sessionResult = await db
        .select({
          patientPrompt: ecosScenarios.patientPrompt,
          title: ecosScenarios.title,
        })
        .from(ecosSessions)
        .innerJoin(ecosScenarios, eq(ecosSessions.scenarioId, ecosScenarios.id))
        .where(eq(ecosSessions.id, sessionId))
        .limit(1);

      if (!sessionResult.length) {
        throw new Error('Session not found');
      }

      const { patientPrompt, title } = sessionResult[0];

      // Get conversation history
      const history = await this.getSessionHistory(sessionId);

      // Build conversation context
      const messages = [
        {
          role: "system" as const,
          content: `${patientPrompt}\n\nInstructions importantes:
- Tu es ce patient dans le scénario: ${title}
- Réponds toujours en restant dans le rôle
- Sois réaliste et cohérent avec les symptômes décrits
- Ne révèle pas d'informations que le patient ne connaîtrait pas
- Adapte ton niveau de langage à celui d'un patient
- Si l'étudiant pose des questions techniques complexes, réponds comme un patient ordinaire le ferait`
        },
        ...history.map(msg => ({
          role: msg.role as "user" | "assistant",
          content: msg.content
        })),
        {
          role: "user" as const,
          content: studentQuery
        }
      ];

      // Generate patient response
      const response = await openaiService.createCompletion({
        model: "gpt-4",
        messages,
        temperature: 0.7,
        max_tokens: 500
      });

      const patientResponse = response.choices[0].message.content;

      // Save the interaction
      await this.saveInteraction(sessionId, studentQuery, patientResponse);

      return patientResponse;
    } catch (error) {
      console.error('Error in patient simulation:', error);
      throw new Error('Failed to simulate patient response');
    }
  }

  async getSessionHistory(sessionId: number): Promise<Array<{role: string; content: string}>> {
    const messages = await db
      .select({
        role: ecosMessages.role,
        content: ecosMessages.content,
      })
      .from(ecosMessages)
      .where(eq(ecosMessages.sessionId, sessionId))
      .orderBy(ecosMessages.timestamp);

    return messages;
  }

  async saveInteraction(sessionId: number, studentQuery: string, patientResponse: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Save student message
      await tx.insert(ecosMessages).values({
        sessionId,
        role: 'user',
        content: studentQuery,
      });

      // Save patient response
      await tx.insert(ecosMessages).values({
        sessionId,
        role: 'assistant',
        content: patientResponse,
      });
    });
  }

  async startSession(scenarioId: number, studentEmail: string): Promise<number> {
    const result = await db.insert(ecosSessions).values({
      scenarioId,
      studentEmail,
      status: 'in_progress',
    }).returning({ id: ecosSessions.id });

    return result[0].id;
  }

  async endSession(sessionId: number): Promise<void> {
    await db.update(ecosSessions)
      .set({ 
        status: 'completed',
        endTime: new Date()
      })
      .where(eq(ecosSessions.id, sessionId));
  }

  async getSession(sessionId: number) {
    const result = await db
      .select({
        id: ecosSessions.id,
        status: ecosSessions.status,
        startTime: ecosSessions.startTime,
        endTime: ecosSessions.endTime,
        studentEmail: ecosSessions.studentEmail,
        scenario: {
          id: ecosScenarios.id,
          title: ecosScenarios.title,
          description: ecosScenarios.description,
        }
      })
      .from(ecosSessions)
      .innerJoin(ecosScenarios, eq(ecosSessions.scenarioId, ecosScenarios.id))
      .where(eq(ecosSessions.id, sessionId))
      .limit(1);

    return result[0] || null;
  }

  async getStudentSessions(studentEmail: string) {
    return await db
      .select({
        id: ecosSessions.id,
        status: ecosSessions.status,
        startTime: ecosSessions.startTime,
        endTime: ecosSessions.endTime,
        scenarioTitle: ecosScenarios.title,
        scenarioId: ecosScenarios.id,
      })
      .from(ecosSessions)
      .innerJoin(ecosScenarios, eq(ecosSessions.scenarioId, ecosScenarios.id))
      .where(eq(ecosSessions.studentEmail, studentEmail))
      .orderBy(ecosSessions.startTime);
  }
}

export const ecosService = new EcosService();
