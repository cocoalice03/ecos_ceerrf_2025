import { apiRequest } from "./queryClient";

export interface UserStatus {
  email: string;
  questionsUsed: number;
  questionsRemaining: number;
  maxDailyQuestions: number;
  limitReached: boolean;
}

export interface AskResponse {
  id: number;
  question: string;
  response: string;
  timestamp: string;
  questionsUsed: number;
  questionsRemaining: number;
  limitReached: boolean;
}

export interface ChatExchange {
  id: number;
  email: string;
  question: string;
  response: string;
  timestamp: string;
}

export interface ChatHistory {
  exchanges: ChatExchange[];
}

// API functions
export const api = {
  // Get user status (questions remaining)
  async getUserStatus(email: string): Promise<UserStatus> {
    const res = await apiRequest(
      "GET", 
      `/api/status?email=${encodeURIComponent(email)}`
    );
    return await res.json();
  },

  // Ask a question
  async askQuestion(email: string, question: string): Promise<AskResponse> {
    const res = await apiRequest(
      "POST", 
      "/api/ask", 
      { email, question }
    );
    return await res.json();
  },

  // Get chat history
  async getChatHistory(email: string): Promise<ChatHistory> {
    const res = await apiRequest(
      "GET", 
      `/api/history?email=${encodeURIComponent(email)}`
    );
    return await res.json();
  }
};

import { useQuery } from '@tanstack/react-query';

export const teacherApi = {
  getDashboard: async (email: string) => {
    const response = await fetch(`/api/teacher/dashboard?email=${encodeURIComponent(email)}`);
    if (!response.ok) {
      throw new Error('Échec de récupération des données du dashboard');
    }
    const data = await response.json();
    console.log('API response data:', data);
    return data;
  },
};

// Hook for dashboard data
export const useDashboardData = (email: string) => {
  return useQuery({
    queryKey: ['dashboard', email],
    queryFn: async () => {
      if (!email) {
        throw new Error('Email is required');
      }
      
      try {
        const [scenarios, sessions] = await Promise.all([
          apiRequest('GET', `/api/ecos/scenarios?email=${email}`),
          apiRequest('GET', `/api/ecos/sessions?email=${email}`)
        ]);
        
        const result = {
          scenarios: scenarios.scenarios || [],
          sessions: sessions.sessions || [],
          timestamp: new Date().toISOString(),
          email
        };
        
        console.log('Dashboard data fetched:', result);
        return result;
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        throw error;
      }
    },
    enabled: !!email,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });
};