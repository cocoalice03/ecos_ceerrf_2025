
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Users, BookOpen, TrendingUp, Clock } from "lucide-react";
import TeacherAssistant from "@/components/ecos/TeacherAssistant";
import { apiRequest } from "@/lib/queryClient";

interface TeacherPageProps {
  email: string;
}

export default function TeacherPage({ email }: TeacherPageProps) {
  // Fetch teacher dashboard data
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useQuery({
    queryKey: ['teacher-dashboard', email],
    queryFn: async () => {
      if (!email) {
        throw new Error('Email is required');
      }
      
      console.log('Fetching dashboard data for email:', email);
      
      try {
        const [scenarios, sessions] = await Promise.all([
          apiRequest('GET', `/api/ecos/scenarios?email=${email}`),
          apiRequest('GET', `/api/ecos/sessions?email=${email}`)
        ]);
        
        console.log('Dashboard scenarios:', scenarios);
        console.log('Dashboard sessions:', sessions);
        
        return {
          scenarios: scenarios.scenarios || [],
          sessions: sessions.sessions || []
        };
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        throw error;
      }
    },
    enabled: !!email, // Only run query when email is available
  });

  // Ensure we have data before calculating stats
  const scenarios = dashboardData?.scenarios || [];
  const sessions = dashboardData?.sessions || [];

  const stats = {
    totalScenarios: scenarios.length,
    activeSessions: sessions.filter((s: any) => s.status === 'in_progress').length,
    completedSessions: sessions.filter((s: any) => s.status === 'completed').length,
    totalStudents: new Set(sessions.map((s: any) => s.studentEmail)).size
  };

  if (dashboardLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard Enseignant</h1>
              <p className="text-gray-600">Bienvenue, {email}</p>
            </div>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              Mode Enseignant
            </Badge>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {dashboardError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">Erreur lors du chargement des données: {dashboardError.message}</p>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Scénarios Créés</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalScenarios}</p>
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
                  <p className="text-sm font-medium text-gray-600">Sessions Actives</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.activeSessions}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-green-600" />
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
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Étudiants Uniques</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalStudents}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="scenarios" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="scenarios">Gestion des Scénarios</TabsTrigger>
            <TabsTrigger value="sessions">Sessions en Cours</TabsTrigger>
            <TabsTrigger value="reports">Rapports</TabsTrigger>
          </TabsList>

          <TabsContent value="scenarios" className="mt-6">
            <TeacherAssistant email={email} />
          </TabsContent>

          <TabsContent value="sessions" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Sessions en Cours</CardTitle>
              </CardHeader>
              <CardContent>
                {sessions.filter((s: any) => s.status === 'in_progress').length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Aucune session active</p>
                ) : (
                  <div className="space-y-4">
                    {sessions
                      .filter((s: any) => s.status === 'in_progress')
                      .map((session: any) => (
                        <div key={session.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="font-medium">{session.scenarioTitle}</h4>
                              <p className="text-sm text-gray-600">Étudiant: {session.studentEmail}</p>
                              <p className="text-sm text-gray-500">
                                Démarrée: {new Date(session.startTime).toLocaleString()}
                              </p>
                            </div>
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              En cours
                            </Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Rapports d'Évaluation</CardTitle>
              </CardHeader>
              <CardContent>
                {sessions.filter((s: any) => s.status === 'completed').length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Aucune session terminée</p>
                ) : (
                  <div className="space-y-4">
                    {sessions
                      .filter((s: any) => s.status === 'completed')
                      .map((session: any) => (
                        <div key={session.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="font-medium">{session.scenarioTitle}</h4>
                              <p className="text-sm text-gray-600">Étudiant: {session.studentEmail}</p>
                              <p className="text-sm text-gray-500">
                                Terminée: {new Date(session.endTime).toLocaleString()}
                              </p>
                            </div>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">
                              Terminée
                            </Badge>
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
