import { useRef, useEffect } from "react";
import { UserStatus, ChatExchange } from "@/lib/api";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";

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
    <div className="flex-grow flex flex-col bg-neutral-50 p-4 md:p-6">
      {/* Messages container */}
      <div 
        ref={messagesContainerRef}
        className="flex-grow overflow-y-auto custom-scrollbar mb-4 space-y-6"
      >
        {/* Welcome message */}
        {!isLoading && (
          <div className="chat-bubble bg-white rounded-xl p-4 shadow-card message-transition">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-primary flex-shrink-0 flex items-center justify-center">
                <span className="material-icons text-white text-sm">smart_toy</span>
              </div>
              <div>
                <p className="text-neutral-600">
                  Bonjour ! Je suis votre assistant de cours. Je peux répondre à vos questions sur le contenu de vos cours. N'hésitez pas à me demander de l'aide.
                </p>
                <p className="mt-2 text-neutral-400 text-sm">
                  Vous avez droit à 20 questions par jour.
                </p>
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
          <div className="chat-bubble bg-white rounded-xl p-4 shadow-card message-transition">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-primary flex-shrink-0 flex items-center justify-center">
                <span className="material-icons text-white text-sm">smart_toy</span>
              </div>
              <div className="pt-2">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Input area */}
      <ChatInput 
        onSendQuestion={onSendQuestion}
        isDisabled={isTyping || (userStatus?.limitReached ?? false)} 
      />
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
  }
  .typing-indicator span {
    height: 8px;
    width: 8px;
    background: #3f51b5;
    border-radius: 50%;
    display: inline-block;
    margin-right: 3px;
    animation: pulse 1.5s infinite ease-in-out;
  }
  .typing-indicator span:nth-child(2) {
    animation-delay: 0.2s;
  }
  .typing-indicator span:nth-child(3) {
    animation-delay: 0.4s;
    margin-right: 0;
  }
  @keyframes pulse {
    0%, 60%, 100% {
      transform: scale(1);
      opacity: 1;
    }
    30% {
      transform: scale(0.7);
      opacity: 0.5;
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
