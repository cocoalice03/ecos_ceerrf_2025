
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, UserStatus, ChatExchange } from "@/lib/api";
import ChatArea from "@/components/chat/ChatArea";
import Sidebar from "@/components/layout/Sidebar";
import MobileMenu from "@/components/layout/MobileMenu";
import { queryClient } from "@/lib/queryClient";
import LimitReachedModal from "@/components/modals/LimitReachedModal";
import ErrorModal from "@/components/modals/ErrorModal";
import { MessageCircle, BookOpen, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ChatPageProps {
  email?: string;
}

export default function Chat({ email: propEmail }: ChatPageProps) {
  // Get email from URL params or props
  const urlParams = new URLSearchParams(window.location.search);
  const emailFromUrl = urlParams.get('email');
  const email = propEmail || emailFromUrl || '';
  
  console.log('Detected email:', email);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLimitReachedModalOpen, setIsLimitReachedModalOpen] = useState(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [messages, setMessages] = useState<ChatExchange[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // Get user status (questions remaining)
  const { 
    data: userStatus,
    isLoading: isStatusLoading,
    isError: isStatusError,
    refetch: refetchStatus
  } = useQuery({
    queryKey: ['/api/status', email],
    queryFn: () => api.getUserStatus(email),
  });

  // Get chat history
  const { 
    data: chatHistory,
    isLoading: isHistoryLoading,
    isError: isHistoryError
  } = useQuery({
    queryKey: ['/api/history', email],
    queryFn: () => api.getChatHistory(email),
    onSuccess: (data) => {
      if (data?.exchanges) {
        // Sort chronologically (oldest first)
        const sortedExchanges = [...data.exchanges].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        setMessages(sortedExchanges);
      }
    }
  });

  // Mutation for asking questions
  const askMutation = useMutation({
    mutationFn: (question: string) => api.askQuestion(email, question),
    onMutate: () => {
      setIsTyping(true);
    },
    onSuccess: (data) => {
      // Add the new exchange to messages
      setMessages(prevMessages => [
        ...prevMessages,
        {
          id: data.id,
          email,
          question: data.question,
          response: data.response,
          timestamp: data.timestamp
        }
      ]);
      
      // Check if limit reached
      if (data.limitReached) {
        setIsLimitReachedModalOpen(true);
      }
      
      // Refresh user status
      queryClient.invalidateQueries({ queryKey: ['/api/status', email] });
    },
    onError: () => {
      setIsErrorModalOpen(true);
    },
    onSettled: () => {
      setIsTyping(false);
    }
  });

  // Send a question
  const handleSendQuestion = (question: string) => {
    if (!question.trim()) return;
    
    // Check if daily limit reached
    if (userStatus?.limitReached) {
      setIsLimitReachedModalOpen(true);
      return;
    }
    
    askMutation.mutate(question);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden">
                <img 
                  src="/images/cahier.png"
                  alt="Assistant de cours"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Assistant de Cours</h1>
                <p className="text-gray-600">Bienvenue, {email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                <MessageCircle className="w-4 h-4 mr-1" />
                Mode Chat
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section - Style similaire au dashboard étudiant */}
      <section className="hero mb-8">
        <div className="px-6 py-8">
          <div className="hero-content">
            <div className="flex-1">
              <div className="hero-text">
                <h2>Assistant Intelligent pour Votre Apprentissage</h2>
                <p>
                  Posez vos questions sur le contenu de vos cours et obtenez des réponses personnalisées grâce à notre IA avancée
                </p>
              </div>
            </div>
            <div className="flex-1">
              <img 
                src="/images/happy_student.jpg"
                alt="Étudiant avec assistant IA"
                className="w-full h-64 object-cover rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col md:flex-row bg-gray-50">
        {/* Sidebar (desktop) */}
        <Sidebar 
          email={email} 
          userStatus={userStatus} 
          isLoading={isStatusLoading}
          className="hidden md:flex" 
        />
        
        {/* Main content */}
        <div className="flex-grow flex flex-col">
          {/* Mobile header */}
          <div className="md:hidden flex items-center justify-between p-4 border-b border-neutral-100 bg-white">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary flex items-center justify-center rounded-lg">
                <span className="material-icons text-white text-sm">school</span>
              </div>
              <h1 className="font-heading font-semibold text-lg text-neutral-800">Assistant de Cours</h1>
            </div>
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 rounded-full hover:bg-neutral-100"
            >
              <span className="material-icons text-neutral-600">menu</span>
            </button>
          </div>
          
          {/* Chat area */}
          <ChatArea 
            messages={messages}
            isTyping={isTyping}
            onSendQuestion={handleSendQuestion}
            userStatus={userStatus}
            isLoading={isHistoryLoading || isStatusLoading}
          />
        </div>
        
        {/* Mobile menu */}
        <MobileMenu 
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          email={email}
          userStatus={userStatus}
          isLoading={isStatusLoading}
        />
        
        {/* Modals */}
        <LimitReachedModal 
          isOpen={isLimitReachedModalOpen}
          onClose={() => setIsLimitReachedModalOpen(false)}
        />
        
        <ErrorModal 
          isOpen={isErrorModalOpen}
          onClose={() => setIsErrorModalOpen(false)}
        />
      </div>
    </div>
  );
}
