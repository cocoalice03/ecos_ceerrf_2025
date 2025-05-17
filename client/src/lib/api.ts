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
