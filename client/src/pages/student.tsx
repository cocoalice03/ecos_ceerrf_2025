
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Clock, CheckCircle, BookOpen, TrendingUp } from "lucide-react";
import PatientSimulator from "@/components/ecos/PatientSimulator";
import EvaluationReport from "@/components/ecos/EvaluationReport";
import StudentDiagnostic from "@/components/debug/StudentDiagnostic";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

interface StudentPageProps {
  email: string;
}

export default function StudentPage({ email }: StudentPageProps) {
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [viewingReport, setViewingReport] = useState<number | null>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  // Fetch available scenarios
  const { data: scenarios, isLoading: scenariosLoading } = useQuery({
    queryKey: ['available-scenarios', email],
    queryFn: async () => {
      console.log('Fetching available scenarios for email:', email);
      const response = await apiRequest('GET', `/api/ecos/available-scenarios?email=${encodeURIComponent(email)}`);
      console.log('Available scenarios response:', response);
      console.log('Number of scenarios received:', response.scenarios?.length || 0);
      return response.scenarios || [];
    },
    enabled: !!email,
  });

  // Fetch student sessions
  const { data: sessions, isLoading: sessionsLoading, refetch: refetchSessions } = useQuery({
    queryKey: ['student-sessions', email],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/ecos/sessions?email=${email}`);
      return response.sessions || [];
    }
  });

  // Start session mutation
  const startSessionMutation = useMutation({
    mutationFn: async (scenarioId: number) => {
      return apiRequest('POST', '/api/ecos/sessions', {
        email,
        scenarioId
      });
    },
    onSuccess: (data) => {
      setActiveSessionId(data.sessionId);
      refetchSessions();
    }
  });

  const handleStartSession = (scenarioId: number) => {
    startSessionMutation.mutate(scenarioId);
  };

  const handleSessionEnd = () => {
    setActiveSessionId(null);
    refetchSessions();
  };

  const handleViewReport = (sessionId: number) => {
    setViewingReport(sessionId);
  };

  // If viewing diagnostic
  if (showDiagnostic) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 mb-6">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">Diagnostic Étudiant</h1>
              <Button variant="outline" onClick={() => setShowDiagnostic(false)}>
                Retour au Dashboard
              </Button>
            </div>
          </div>
        </div>
        <StudentDiagnostic email={email} />
      </div>
    );
  }

  // If viewing report
  if (viewingReport) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 mb-6">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">Rapport d'Évaluation</h1>
              <Button variant="outline" onClick={() => setViewingReport(null)}>
                Retour au Dashboard
              </Button>
            </div>
          </div>
        </div>
        <EvaluationReport sessionId={viewingReport} email={email} />
      </div>
    );
  }

  // If in active session
  if (activeSessionId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PatientSimulator 
          sessionId={activeSessionId} 
          email={email} 
          onSessionEnd={handleSessionEnd}
        />
      </div>
    );
  }

  const stats = {
    completedSessions: sessions?.filter((s: any) => s.status === 'completed').length || 0,
    inProgressSessions: sessions?.filter((s: any) => s.status === 'in_progress').length || 0,
    availableScenarios: scenarios?.length || 0
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard Étudiant ECOS</h1>
              <p className="text-gray-600">Bienvenue, {email}</p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowDiagnostic(true)}
                className="text-orange-600 border-orange-200 hover:bg-orange-50"
              >
                🔧 Diagnostic
              </Button>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Mode Étudiant
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Scénarios Disponibles</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.availableScenarios}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Sessions en Cours</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.inProgressSessions}</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Sessions Terminées</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.completedSessions}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="scenarios" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scenarios">Nouveaux Examens</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
          </TabsList>

          <TabsContent value="scenarios" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Scénarios Disponibles</CardTitle>
              </CardHeader>
              <CardContent>
                {scenariosLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => (
                      <Card key={i} className="animate-pulse">
                        <CardContent className="p-6">
                          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-full mb-4"></div>
                          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : scenarios?.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">Aucun scénario disponible</p>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowDiagnostic(true)}
                      className="text-orange-600 border-orange-200 hover:bg-orange-50"
                    >
                      🔧 Lancer le Diagnostic
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {scenarios?.map((scenario: any) => (
                      <Card key={scenario.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                          <h3 className="font-semibold text-lg mb-2">{scenario.title}</h3>
                          <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                            {scenario.description}
                          </p>
                          <Button
                            onClick={() => handleStartSession(scenario.id)}
                            disabled={startSessionMutation.isPending}
                            className="w-full"
                          >
                            <Play className="w-4 h-4 mr-2" />
                            {startSessionMutation.isPending ? "Démarrage..." : "Commencer l'Examen"}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Historique des Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                {sessionsLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="border border-gray-200 rounded-lg p-4 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                      </div>
                    ))}
                  </div>
                ) : sessions?.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Aucune session trouvée</p>
                ) : (
                  <div className="space-y-4">
                    {sessions?.map((session: any) => (
                      <div key={session.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-medium">{session.scenarioTitle}</h4>
                            <p className="text-sm text-gray-500">
                              {session.status === 'completed' ? 'Terminée' : 'En cours'} • {' '}
                              {new Date(session.startTime).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge 
                              variant="outline" 
                              className={session.status === 'completed' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}
                            >
                              {session.status === 'completed' ? 'Terminée' : 'En cours'}
                            </Badge>
                            {session.status === 'completed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewReport(session.id)}
                              >
                                <TrendingUp className="w-4 h-4 mr-1" />
                                Voir Résultats
                              </Button>
                            )}
                            {session.status === 'in_progress' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setActiveSessionId(session.id)}
                              >
                                <Play className="w-4 h-4 mr-1" />
                                Reprendre
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
