
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
import RoleSwitcher from "@/components/debug/RoleSwitcher";
import { apiRequest } from "@/lib/queryClient";
import { MessageCircle } from "lucide-react";

interface User {
  email: string;
  role?: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentRole, setCurrentRole] = useState<string>('student');

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await apiRequest('GET', '/api/status');
        console.log('Detected email:', response.email);
        
        if (response.email) {
          // Determine role based on email or other logic
          let role = 'student'; // default role
          
          // Example role determination logic
          if (response.email.includes('admin') || response.email.includes('prof')) {
            role = 'teacher';
          }
          
          setUser({ 
            email: response.email,
            role: role
          });
        } else {
          console.log('No user authenticated - response not ok');
          // For development, use test email
          const testEmail = 'cherubindavid@gmail.com';
          console.log('Using test email for development:', testEmail);
          setUser({ 
            email: testEmail,
            role: 'student' // You can change this to 'teacher' for testing
          });
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        // Fallback for development
        const testEmail = 'cherubindavid@gmail.com';
        setUser({ 
          email: testEmail,
          role: 'student'
        });
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  // Role switching handler
  const handleRoleChange = (newRole: string) => {
    setCurrentRole(newRole);
    setUser(prev => prev ? { ...prev, role: newRole } : null);
  };

  // Role-based routing
  const renderMainContent = () => {
    if (!user?.email) {
      return <Chat />;
    }
    
    switch (currentRole) {
      case 'teacher':
      case 'admin':
        return <TeacherPage email={user.email} />;
      case 'student':
      default:
        return <StudentPage email={user.email} />;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background text-foreground">
          <Switch>
            {/* Admin route */}
            <Route path="/admin">
              <AdminPage />
            </Route>
            
            {/* Chat route */}
            <Route path="/chat">
              <Chat />
            </Route>
            
            {/* Teacher route */}
            <Route path="/teacher">
              {user?.email ? <TeacherPage email={user.email} /> : <Chat />}
            </Route>
            
            {/* Student route */}
            <Route path="/student">
              {user?.email ? <StudentPage email={user.email} /> : <Chat />}
            </Route>
            
            {/* Default route - role-based routing */}
            <Route path="/">
              {renderMainContent()}
            </Route>
            
            {/* 404 route */}
            <Route>
              <NotFound />
            </Route>
          </Switch>

          {/* Role switcher for development */}
          {user?.email && (
            <RoleSwitcher 
              currentRole={currentRole}
              onRoleChange={handleRoleChange}
              email={user.email}
            />
          )}

          {/* Floating action button to access chat when in ECOS mode */}
          {user?.email && window.location.pathname !== '/chat' && (
            <div className="fixed bottom-6 right-6 z-50">
              <button
                onClick={() => window.location.href = '/chat'}
                className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors"
                title="Accéder au Chat"
              >
                <MessageCircle className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
