import { collection, getDocs, query, where, doc, getDoc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

// Interface pour les données du tableau de bord - adaptée pour correspondre à l'existant
export interface DashboardData {
  scenarios?: any[];
  sessions?: any[];
  stats?: {
    totalScenarios?: number;
    totalSessions?: number;
    totalUsers?: number;
    completionRate?: number;
    // Propriétés supplémentaires requises par l'interface existante
    activeSessions?: number;
    completedSessions?: number;
    totalStudents?: number;
    partial?: boolean;
  };
}

/**
 * Service pour interagir avec Firestore
 * Cette classe fournit des méthodes pour récupérer et manipuler des données dans Firestore
 */
export class FirestoreService {
  
  /**
   * Récupère les données du tableau de bord pour un utilisateur spécifique
   * @param email Email de l'utilisateur
   * @returns Données du tableau de bord (scénarios, sessions, statistiques)
   */
  static async getDashboardData(email: string): Promise<DashboardData> {
    try {
      // Données temporaires pour simuler le tableau de bord pendant la migration
      // Cette implémentation doit être adaptée à votre modèle Firestore réel
      const mockData: DashboardData = {
        scenarios: [
          { id: '1', title: 'ECOS Scénario 1', type: 'clinical', status: 'active', createdAt: new Date().toISOString(), exchanges: 5 },
          { id: '2', title: 'ECOS Scénario 2', type: 'emergency', status: 'active', createdAt: new Date().toISOString(), exchanges: 8 }
        ],
        sessions: [
          { id: '101', scenarioId: '1', studentEmail: 'student@example.com', completedAt: new Date().toISOString(), score: 85, status: 'completed' },
          { id: '102', scenarioId: '2', studentEmail: 'student@example.com', completedAt: new Date().toISOString(), score: 92, status: 'completed' },
          { id: '103', scenarioId: '2', studentEmail: 'another@example.com', status: 'active' }
        ],
        stats: {
          totalScenarios: 2,
          totalSessions: 3,
          totalUsers: 2,
          completionRate: 66,
          // Propriétés supplémentaires nécessaires pour l'interface existante
          activeSessions: 1,
          completedSessions: 2,
          totalStudents: 2,
          partial: false
        }
      };

      // Simuler un délai réseau comme en production
      await new Promise(resolve => setTimeout(resolve, 300));
      
      console.log('📊 Dashboard data from Firestore (mock):', mockData);
      return mockData;
      
      // TODO: Implémenter la récupération réelle depuis Firestore
      // Voici comment ce serait avec une structure Firestore :
      /*
      // Récupérer les scénarios
      const scenariosRef = collection(db, 'scenarios');
      const scenariosQuery = query(scenariosRef, where("createdBy", "==", email));
      const scenariosSnapshot = await getDocs(scenariosQuery);
      const scenarios = scenariosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Récupérer les sessions liées à ces scénarios
      const sessionsRef = collection(db, 'sessions');
      const sessionsQuery = query(sessionsRef, where("teacherEmail", "==", email));
      const sessionsSnapshot = await getDocs(sessionsQuery);
      const sessions = sessionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Calculer des statistiques
      const stats = {
        totalScenarios: scenarios.length,
        totalSessions: sessions.length,
        totalUsers: new Set(sessions.map(s => s.studentEmail)).size,
        completionRate: sessions.filter(s => s.completedAt).length / sessions.length * 100
      };
      
      return { scenarios, sessions, stats };
      */
    } catch (error) {
      console.error('Erreur lors de la récupération des données du dashboard:', error);
      throw error;
    }
  }

  /**
   * Récupère les scénarios disponibles pour un utilisateur
   * @param email Email de l'utilisateur
   * @returns Liste des scénarios
   */
  static async getScenarios(email: string): Promise<any[]> {
    try {
      // Données temporaires pour simuler les scénarios pendant la migration
      const mockScenarios = [
        { id: '1', title: 'ECOS Scénario 1', type: 'clinical', status: 'active', createdAt: new Date().toISOString() },
        { id: '2', title: 'ECOS Scénario 2', type: 'emergency', status: 'active', createdAt: new Date().toISOString() }
      ];

      // Simuler un délai réseau comme en production
      await new Promise(resolve => setTimeout(resolve, 300));
      
      console.log('📋 Scenarios from Firestore (mock):', mockScenarios);
      return mockScenarios;
      
      // TODO: Implémenter la récupération réelle depuis Firestore
      /*
      const scenariosRef = collection(db, 'scenarios');
      let scenariosQuery;
      
      // Différents accès selon le rôle (à adapter selon votre logique métier)
      if (email.includes('admin')) {
        // Les admins voient tous les scénarios
        scenariosQuery = query(scenariosRef);
      } else if (email.includes('teacher')) {
        // Les enseignants voient leurs scénarios
        scenariosQuery = query(scenariosRef, where("createdBy", "==", email));
      } else {
        // Les étudiants voient les scénarios publiés
        scenariosQuery = query(scenariosRef, where("status", "==", "published"));
      }
      
      const snapshot = await getDocs(scenariosQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      */
    } catch (error) {
      console.error('Erreur lors de la récupération des scénarios:', error);
      throw error;
    }
  }
}

export default FirestoreService;
