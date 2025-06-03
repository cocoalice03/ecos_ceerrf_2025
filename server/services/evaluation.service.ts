
import { openaiService } from './openai.service';
import { db } from '../db';
import { ecosSessions, ecosScenarios, ecosMessages, ecosEvaluations, ecosReports } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class EvaluationService {
  async evaluateSession(sessionId: number): Promise<any> {
    try {
      // Get session details and evaluation criteria
      const sessionData = await db
        .select({
          evaluationCriteria: ecosScenarios.evaluationCriteria,
          title: ecosScenarios.title,
          description: ecosScenarios.description,
        })
        .from(ecosSessions)
        .innerJoin(ecosScenarios, eq(ecosSessions.scenarioId, ecosScenarios.id))
        .where(eq(ecosSessions.id, sessionId))
        .limit(1);

      if (!sessionData.length) {
        throw new Error('Session not found');
      }

      const { evaluationCriteria, title, description } = sessionData[0];

      // Use default criteria if none defined
      const criteria = evaluationCriteria || {
        communication: { name: "Communication", maxScore: 4 },
        anamnese: { name: "Anamnèse", maxScore: 4 },
        examen: { name: "Examen clinique", maxScore: 4 },
        raisonnement: { name: "Raisonnement clinique", maxScore: 4 },
        prise_en_charge: { name: "Prise en charge", maxScore: 4 }
      };

      // Get complete session history
      const history = await this.getCompleteSessionHistory(sessionId);

      // Generate evaluation using OpenAI
      const evaluationPrompt = `Tu es un évaluateur expert pour les ECOS (Examens Cliniques Objectifs Structurés).

Scénario: ${title}
Description: ${description}

Critères d'évaluation:
${JSON.stringify(criteria, null, 2)}

Évalue la performance de l'étudiant basée sur cette interaction complète:

${this.formatHistoryForEvaluation(history)}

Fournir une évaluation détaillée incluant:
1. Score pour chaque critère (0-4 points)
2. Commentaires spécifiques pour chaque critère
3. Points forts observés
4. Points à améliorer
5. Recommandations pour l'apprentissage futur

Retourne le résultat en format JSON structuré avec les champs: scores, comments, strengths, weaknesses, recommendations.`;

      const response = await openaiService.createCompletion({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "Tu es un évaluateur médical expert. Évalue de manière constructive et pédagogique."
          },
          {
            role: "user",
            content: evaluationPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });

      const evaluationText = response.choices[0].message.content;
      const parsedEvaluation = this.parseEvaluation(evaluationText);

      // Save evaluation to database
      await this.saveEvaluation(sessionId, parsedEvaluation);

      // Generate and save report
      const report = await this.generateReport(sessionId, parsedEvaluation);

      return {
        evaluation: parsedEvaluation,
        report
      };
    } catch (error) {
      console.error('Error evaluating session:', error);
      throw new Error('Failed to evaluate session');
    }
  }

  private async getCompleteSessionHistory(sessionId: number) {
    return await db
      .select({
        role: ecosMessages.role,
        content: ecosMessages.content,
        timestamp: ecosMessages.timestamp,
      })
      .from(ecosMessages)
      .where(eq(ecosMessages.sessionId, sessionId))
      .orderBy(ecosMessages.timestamp);
  }

  private formatHistoryForEvaluation(history: any[]): string {
    return history.map((msg, index) => {
      const speaker = msg.role === 'user' ? 'ÉTUDIANT' : 'PATIENT';
      return `[${index + 1}] ${speaker}: ${msg.content}`;
    }).join('\n\n');
  }

  private parseEvaluation(evaluationText: string): any {
    try {
      // Try to parse as JSON first
      const jsonMatch = evaluationText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      // If JSON parsing fails, extract information using regex
    }

    // Fallback: create structured evaluation from text
    const lines = evaluationText.split('\n');
    
    return {
      scores: {
        communication: this.extractScore(evaluationText, 'communication'),
        anamnese: this.extractScore(evaluationText, 'anamnèse'),
        examen: this.extractScore(evaluationText, 'examen'),
        raisonnement: this.extractScore(evaluationText, 'raisonnement'),
        prise_en_charge: this.extractScore(evaluationText, 'prise en charge')
      },
      comments: {
        communication: this.extractComment(evaluationText, 'communication'),
        anamnese: this.extractComment(evaluationText, 'anamnèse'),
        examen: this.extractComment(evaluationText, 'examen'),
        raisonnement: this.extractComment(evaluationText, 'raisonnement'),
        prise_en_charge: this.extractComment(evaluationText, 'prise en charge')
      },
      strengths: this.extractListItems(evaluationText, 'points forts|strengths'),
      weaknesses: this.extractListItems(evaluationText, 'points à améliorer|weaknesses|faiblesses'),
      recommendations: this.extractListItems(evaluationText, 'recommandations|recommendations')
    };
  }

  private extractScore(text: string, criterion: string): number {
    const regex = new RegExp(`${criterion}[\\s\\S]*?(\\d+)[\\s\\/]*4`, 'i');
    const match = text.match(regex);
    return match ? parseInt(match[1]) : 2; // Default score of 2
  }

  private extractComment(text: string, criterion: string): string {
    const regex = new RegExp(`${criterion}[\\s\\S]*?:\\s*([^\\n]*(?:\\n[^\\n]*){0,2})`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : 'Aucun commentaire spécifique';
  }

  private extractListItems(text: string, sectionName: string): string[] {
    const regex = new RegExp(`${sectionName}[\\s\\S]*?([\\d\\-\\*].*?(?=\\n\\n|\\n[A-Z]|$))`, 'i');
    const match = text.match(regex);
    if (!match) return ['Aucun élément identifié'];

    const items = match[1]
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^[\d\-\*\s]+/, '').trim())
      .filter(line => line.length > 0);

    // Ensure we always return an array with at least one element
    return items.length > 0 ? items : ['Aucun élément identifié'];
  }

  private async saveEvaluation(sessionId: number, evaluation: any): Promise<void> {
    const scores = evaluation.scores || {};
    
    // Save each criterion evaluation
    for (const [criterionId, score] of Object.entries(scores)) {
      if (typeof score === 'number') {
        await db.insert(ecosEvaluations).values({
          sessionId,
          criterionId,
          score: score as number,
          feedback: evaluation.comments?.[criterionId] || '',
        });
      }
    }
  }

  private async generateReport(sessionId: number, evaluation: any): Promise<any> {
    // Ensure all fields are properly formatted as arrays
    const strengths = Array.isArray(evaluation.strengths) 
      ? evaluation.strengths 
      : (evaluation.strengths ? [evaluation.strengths] : ['Points forts à identifier']);
    
    const weaknesses = Array.isArray(evaluation.weaknesses) 
      ? evaluation.weaknesses 
      : (evaluation.weaknesses ? [evaluation.weaknesses] : ['Points à améliorer à identifier']);
    
    const recommendations = Array.isArray(evaluation.recommendations) 
      ? evaluation.recommendations 
      : (evaluation.recommendations ? [evaluation.recommendations] : ['Recommandations à définir']);

    const report = {
      summary: this.generateSummary(evaluation),
      strengths,
      weaknesses,
      recommendations
    };

    // Save report to database
    await db.insert(ecosReports).values({
      sessionId,
      summary: report.summary,
      strengths: report.strengths,
      weaknesses: report.weaknesses,
      recommendations: report.recommendations,
    });

    return report;
  }

  private generateSummary(evaluation: any): string {
    const scores = evaluation.scores || {};
    const totalScore = Object.values(scores).reduce((sum: number, score: any) => sum + (typeof score === 'number' ? score : 0), 0);
    const maxScore = Object.keys(scores).length * 4;
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    let performance = 'satisfaisante';
    if (percentage >= 80) performance = 'excellente';
    else if (percentage >= 70) performance = 'bonne';
    else if (percentage >= 60) performance = 'satisfaisante';
    else performance = 'à améliorer';

    return `Performance globale ${performance} avec un score de ${totalScore}/${maxScore} (${percentage}%). L'étudiant démontre des compétences cliniques en développement avec des points forts identifiés et des axes d'amélioration ciblés.`;
  }

  async getSessionReport(sessionId: number) {
    const report = await db
      .select()
      .from(ecosReports)
      .where(eq(ecosReports.sessionId, sessionId))
      .limit(1);

    return report[0] || null;
  }
}

export const evaluationService = new EvaluationService();
