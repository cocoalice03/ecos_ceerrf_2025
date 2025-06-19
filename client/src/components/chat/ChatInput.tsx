
import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSendQuestion: (question: string) => void;
  isDisabled?: boolean;
}

export default function ChatInput({ onSendQuestion, isDisabled = false }: ChatInputProps) {
  const [question, setQuestion] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (question.trim() && !isDisabled) {
      onSendQuestion(question);
      setQuestion("");
    }
  };

  return (
    <form className="flex items-center space-x-3" onSubmit={handleSubmit}>
      <Input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Posez votre question sur le contenu du cours..."
        className="flex-grow"
        disabled={isDisabled}
      />
      <Button
        type="submit"
        disabled={!question.trim() || isDisabled}
        className="px-6"
      >
        <Send className="w-4 h-4 mr-2" />
        Envoyer
      </Button>
    </form>
  );
}
