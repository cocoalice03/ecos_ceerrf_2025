import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Chat from "@/pages/chat";
import AdminPage from "@/pages/admin";
import LandingPage from "@/pages/landing";
import { apiRequest } from "@/lib/queryClient";
import { MessageCircle } from "lucide-react";

interface AppProps {
  initialEmail: string | null;
}

function Router({ email }: { email: string | null }) {
  return (
    <Switch>
      <Route path="/admin">
        <AdminPage />
      </Route>
      <Route path="/*">
        {!email ? (
          <LandingPage />
        ) : (
          <Chat email={email} />
        )}
      </Route>
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
