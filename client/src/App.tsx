import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Chat from "@/pages/chat";
import { apiRequest } from "@/lib/queryClient";

interface AppProps {
  initialEmail: string | null;
}

function Router({ email }: { email: string | null }) {
  if (!email) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50 p-4">
        <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-card">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-primary bg-opacity-10 rounded-full flex items-center justify-center">
              <span className="material-icons text-primary text-3xl">error_outline</span>
            </div>
          </div>
          <h3 className="text-center font-heading font-semibold text-xl mb-2">Authentification requise</h3>
          <p className="text-center text-neutral-600 mb-6">
            Veuillez accéder à cette page depuis votre plateforme LearnWorlds.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/" component={() => <Chat email={email} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App({ initialEmail }: AppProps) {
  const [email, setEmail] = useState<string | null>(initialEmail);
  const [authenticating, setAuthenticating] = useState<boolean>(!!initialEmail);

  useEffect(() => {
    async function authenticateUser() {
      if (initialEmail) {
        try {
          setAuthenticating(true);
          // Create or update session via webhook endpoint
          await apiRequest("POST", "/api/webhook", { email: initialEmail });
          setEmail(initialEmail);
        } catch (error) {
          console.error("Authentication error:", error);
          setEmail(null);
        } finally {
          setAuthenticating(false);
        }
      }
    }

    authenticateUser();
  }, [initialEmail]);

  if (authenticating) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-t-4 border-primary border-solid rounded-full animate-spin"></div>
          <p className="mt-4 text-neutral-600">Authentification en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router email={email} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
