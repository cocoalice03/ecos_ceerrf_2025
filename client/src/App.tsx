import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Chat from "@/pages/chat";
import AdminPage from "@/pages/admin";
import TeacherPage from "@/pages/teacher";
import StudentPage from "@/pages/student";
import { apiRequest } from "@/lib/queryClient";
import { MessageCircle } from "lucide-react";

interface AppProps {
  initialEmail: string | null;
}

function Router({ email }: { email: string | null }) {
  // Gérer toutes les routes, avec priorité pour l'admin
  return (
    <Switch>
      <Route path="/admin">
        <AdminPage />
      </Route>
      <Route path="/teacher/:email">
        {(params) => <TeacherPage email={params.email} />}
      </Route>
      <Route path="/student/:email">
        {(params) => <StudentPage email={params.email} />}
      </Route>
      <Route path="/chat/:email">
        {(params) => <Chat email={params.email} />}
      </Route>
      <Route path="/*">
        {!email ? (
          <div className="flex items-center justify-center min-h-screen bg-neutral-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-card">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-primary bg-opacity-10 rounded-full flex items-center justify-center">
                  <MessageCircle className="text-primary text-3xl h-8 w-8" />
                </div>
              </div>
              <h3 className="text-center font-heading font-semibold text-xl mb-2">Assistant de Cours</h3>
              <p className="text-center text-neutral-600 mb-6">
                Ce chatbot est conçu pour vous accompagner dans votre apprentissage.
              </p>
              <div className="bg-blue-50 rounded-lg p-4 mb-6 text-sm">
                <h4 className="font-medium text-blue-700 mb-2">Instructions d'accès :</h4>
                <ol className="list-decimal pl-5 text-blue-700 space-y-2">
                  <li>Chat RAG : <code className="bg-blue-100 px-1 py-0.5 rounded">/chat/votre@email.com</code></li>
                  <li>Mode Enseignant ECOS : <code className="bg-blue-100 px-1 py-0.5 rounded">/teacher/votre@email.com</code></li>
                  <li>Mode Étudiant ECOS : <code className="bg-blue-100 px-1 py-0.5 rounded">/student/votre@email.com</code></li>
                  <li>Administration : <code className="bg-blue-100 px-1 py-0.5 rounded">/admin</code></li>
                </ol>
              </div>
            </div>
          </div>
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
  const [userEmail, setUserEmail] = useState<string>('cherubindavid@gmail.com');

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

  // Get user info from Repl Auth
  useEffect(() => {
    const getUserInfo = async () => {
      try {
        const response = await fetch('/__replauthuser');
        if (response.ok) {
          const userData = await response.json();
          // Check for email field first, then fallback to name
          const email = userData?.email || userData?.name || '';
          console.log("Detected user data:", userData);
          console.log("Detected email:", email);
          setUserEmail(email);
        } else {
          console.log("No user authenticated - response not ok");
          // For development, use a test email if no auth is available
          const testEmail = 'cherubindavid@gmail.com';
          console.log("Using test email for development:", testEmail);
          setUserEmail(testEmail);
        }
      } catch (error) {
        console.error("Auth error:", error);
        setUserEmail('');
      }
    };

    getUserInfo();
  }, []);

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