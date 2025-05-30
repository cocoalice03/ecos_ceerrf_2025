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

  getIndexes: async (email: string) => {
    console.log('API: Fetching indexes for email:', email);
    const url = `/api/admin/indexes?email=${encodeURIComponent(email)}`;
    console.log('API: Request URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('API: Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API: Error response:', errorText);
      throw new Error(`Failed to fetch indexes: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('API: Indexes response data:', data);
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
        console.log('Fetching dashboard data for email:', email);

        const [scenariosResponse, sessionsResponse] = await Promise.all([
          fetch(`/api/ecos/scenarios?email=${encodeURIComponent(email)}`),
          fetch(`/api/ecos/sessions?email=${encodeURIComponent(email)}`)
        ]);

        if (!scenariosResponse.ok) {
          throw new Error(`Scenarios API error: ${scenariosResponse.status}`);
        }

        if (!sessionsResponse.ok) {
          throw new Error(`Sessions API error: ${sessionsResponse.status}`);
        }

        const scenariosData = await scenariosResponse.json();
        const sessionsData = await sessionsResponse.json();

        console.log('Dashboard scenarios:', scenariosData);
        console.log('Dashboard sessions:', sessionsData);

        const result = {
          scenarios: scenariosData.scenarios || [],
          sessions: sessionsData.sessions || [],
          timestamp: new Date().toISOString(),
          email,
          scenariosRaw: scenariosData,
          sessionsRaw: sessionsData
        };

        console.log('Dashboard data processed:', result);
        return result;
      } catch (error) {
        console.error('Dashboard data error:', error);

        // Return partial data instead of throwing an error
        return {
          scenarios: [],
          sessions: [],
          timestamp: new Date().toISOString(),
          email,
          error: error instanceof Error ? error.message : 'Unknown error',
          partial: true
        };
      }
    },
    enabled: !!email,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });
};