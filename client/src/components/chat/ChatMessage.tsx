import { formatDistance } from "date-fns";
import { fr } from "date-fns/locale";

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

  return (
    <>
      {/* User message */}
      <div className="flex justify-end">
        <div className="chat-bubble bg-primary text-white rounded-xl p-4 shadow-card">
          <div className="flex items-start space-x-3">
            <div>
              <p>{question}</p>
              <p className="mt-1 text-primary-light text-xs text-right">{formattedTime}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Assistant response */}
      <div>
        <div className="chat-bubble bg-white rounded-xl p-4 shadow-card">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-full bg-primary flex-shrink-0 flex items-center justify-center">
              <span className="material-icons text-white text-sm">smart_toy</span>
            </div>
            <div>
              <p className="text-neutral-600 whitespace-pre-line">{response}</p>
              <p className="mt-1 text-neutral-400 text-xs">{formattedTime}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
