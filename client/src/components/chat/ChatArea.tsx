import { useRef, useEffect } from "react";
import { UserStatus, ChatExchange } from "@/lib/api";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, Bot } from "lucide-react";

interface ChatAreaProps {
  messages: ChatExchange[];
  isTyping: boolean;
  onSendQuestion: (question: string) => void;
  userStatus?: UserStatus;
  isLoading: boolean;
}

export default function ChatArea({ 
  messages, 
  isTyping, 
  onSendQuestion,
  userStatus,
  isLoading 
}: ChatAreaProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  return (
    <div className="flex-grow flex flex-col p-6">
      {/* Messages container - Card style similaire au dashboard */}
      <Card className="flex-grow flex flex-col mb-6">
        <CardContent className="flex-grow flex flex-col p-0">
          <div 
            ref={messagesContainerRef}
            className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-6"
          >
            {/* Welcome message */}
            {!isLoading && (
              <div className="feature-card">
                <div className="feature-content">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                      <Bot className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="feature-title text-lg mb-2">Bonjour ! Je suis votre assistant de cours</h3>
                      <p className="text-gray-600 mb-3">
                        Je peux répondre à vos questions sur le contenu de vos cours. N'hésitez pas à me demander de l'aide pour clarifier des concepts, obtenir des explications détaillées ou approfondir votre compréhension.
                      </p>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-center space-x-2">
                          <MessageCircle className="w-4 h-4 text-blue-600" />
                          <span className="text-blue-700 text-sm font-medium">
                            Vous avez droit à 20 questions par jour
                          </span>
                        </div>
                        {userStatus && (
                          <p className="text-blue-600 text-sm mt-1">
                            Questions restantes : {userStatus.questionsRemaining || 0}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loading indicator for initial load */}
            {isLoading && (
              <div className="flex justify-center items-center h-32">
                <div className="w-8 h-8 border-t-4 border-primary border-solid rounded-full animate-spin"></div>
              </div>
            )}

            {/* Message history */}
            {!isLoading && messages.map((message) => (
              <ChatMessage
                key={message.id}
                question={message.question}
                response={message.response}
                timestamp={new Date(message.timestamp)}
              />
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="feature-card animate-fade-in">
                <div className="feature-content">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                      <Bot className="w-6 h-6 text-white" />
                    </div>
                    <div className="pt-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500 mr-2">L'assistant rédige sa réponse</span>
                        <div className="typing-indicator">
                          <span className="typing-dot"></span>
                          <span className="typing-dot"></span>
                          <span className="typing-dot"></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Input area - Card style */}
      <Card>
        <CardContent className="p-4">
          <ChatInput 
            onSendQuestion={onSendQuestion}
            isDisabled={isTyping || (userStatus?.limitReached ?? false)} 
          />
        </CardContent>
      </Card>
    </div>
  );
}

// CSS utility classes for chat area
const styles = `
  .chat-bubble {
    max-width: 75%;
  }
  .typing-indicator {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }
  .typing-dot {
    height: 6px;
    width: 6px;
    background: #6b7280;
    border-radius: 50%;
    display: inline-block;
    animation: typing-bounce 1.4s infinite ease-in-out;
  }
  .typing-dot:nth-child(1) {
    animation-delay: 0s;
  }
  .typing-dot:nth-child(2) {
    animation-delay: 0.2s;
  }
  .typing-dot:nth-child(3) {
    animation-delay: 0.4s;
  }
  @keyframes typing-bounce {
    0%, 60%, 100% {
      transform: translateY(0);
      opacity: 0.4;
    }
    30% {
      transform: translateY(-8px);
      opacity: 1;
    }
  }
  .animate-fade-in {
    animation: fade-in 0.3s ease-in;
  }
  @keyframes fade-in {
    0% {
      opacity: 0;
      transform: translateY(10px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .message-transition {
    transition: all 0.3s ease;
  }
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f1f1;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #a1a1a1;
  }
`;