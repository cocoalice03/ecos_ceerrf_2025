
import { formatDistance } from "date-fns";
import { fr } from "date-fns/locale";
import { User, Bot } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ChatMessageProps {
  question: string;
  response: string;
  timestamp: Date;
}

export default function ChatMessage({ question, response, timestamp }: ChatMessageProps) {
  // Format timestamp to something like "14:23" or "il y a 5 minutes"
  const formatTime = (date: Date) => {
    const now = new Date();
    // If it's today, show time
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    // Otherwise, show relative time
    return formatDistance(date, now, {
      addSuffix: true,
      locale: fr,
    });
  };

  const formattedTime = formatTime(timestamp);

  // Function to render markdown links
  const renderMarkdownLinks = (text: string): string => {
    // Basic markdown link regex
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    return text.replace(linkRegex, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">$1</a>');
  };

  return (
    <div className="space-y-4">
      {/* User message */}
      <div className="flex justify-end">
        <Card className="max-w-[75%] bg-primary border-primary">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-1">
                <p className="text-white">{question}</p>
                <p className="mt-1 text-primary-foreground/70 text-xs text-right">{formattedTime}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bot response */}
      <div className="flex justify-start">
        <Card className="max-w-[85%] border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <div 
                  className="text-gray-800 whitespace-pre-wrap leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderMarkdownLinks(response) }}
                />
                <p className="mt-2 text-gray-400 text-xs">{formattedTime}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
