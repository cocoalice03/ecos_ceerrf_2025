
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, BookOpen, TrendingUp, Clock, Play, Pause, RotateCcw } from "lucide-react";
import { useDashboardData } from '@/lib/api';
import DiagnosticPanel from '@/components/debug/DiagnosticPanel';

interface TeacherPageProps {
  email?: string;
}

function TeacherPage({ email }: TeacherPageProps) {
  const [activeTab, setActiveTab] = useState('overview');
  
  // Add debugging for authentication issues - MUST be before any conditional returns
  React.useEffect(() => {
    if (!email) {
      console.warn('No email detected for teacher dashboard');
    }
  }, [email]);

  console.log('TeacherPage rendering with email:', email);
  
  const { 
    data: dashboardData, 
    isLoading: dashboardLoading, 
    error: dashboardError 
  } = useDashboardData(email || '');

  console.log('Dashboard data:', dashboardData);
  console.log('Dashboard loading:', dashboardLoading);
  console.log('Dashboard error:', dashboardError);

  // Provide fallback data structure
  const scenarios = dashboardData?.scenarios || [];
  const sessions = dashboardData?.sessions || [];

  console.log('Scenarios:', scenarios);
  console.log('Sessions:', sessions);

  const stats = {
    totalScenarios: scenarios.length,
    activeSessions: sessions.filter((s: any) => s.status === 'in_progress').length,
    completedSessions: sessions.filter((s: any) => s.status === 'completed').length,
    totalStudents: new Set(sessions.map((s: any) => s.student_id)).size
  };

  console.log('Calculated stats:', stats);

  if (dashboardLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  // Show error state but still render dashboard with fallback data
  if (dashboardError && !dashboardData) {
    console.error('Dashboard error:', dashboardError);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Debug Panel */}
      <DiagnosticPanel 
        email={email}
        dashboardData={dashboardData}
        dashboardLoading={dashboardLoading}
        dashboardError={dashboardError}
        scenarios={scenarios}
        sessions={sessions}
        stats={stats}
      />
      
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Tableau de bord Enseignant</h1>
          <p className="text-gray-600 mt-2">Gérez vos scénarios ECOS et suivez les progrès de vos étudiants</p>
          {email && <p className="text-sm text-blue-600 mt-1">Connecté en tant que: {email}</p>}
          {dashboardError && (
            <div className="mt-2 p-2 bg-yellow-100 border border-yellow-400 rounded text-yellow-800 text-sm">
              ⚠️ Données partiellement disponibles (mode dégradé)
            </div>
          )}
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Scénarios Actifs</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalScenarios}</div>
              <p className="text-xs text-muted-foreground">scénarios disponibles</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sessions Actives</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeSessions}</div>
              <p className="text-xs text-muted-foreground">en cours</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sessions Complétées</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedSessions}</div>
              <p className="text-xs text-muted-foreground">terminées</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Étudiants Uniques</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalStudents}</div>
              <p className="text-xs text-muted-foreground">participants</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different sections */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="scenarios">Scénarios</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Activité Récente</CardTitle>
                  <CardDescription>Dernières sessions des étudiants</CardDescription>
                </CardHeader>
                <CardContent>
                  {sessions.length > 0 ? (
                    <div className="space-y-4">
                      {sessions.slice(0, 5).map((session: any) => (
                        <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium">Session #{session.id}</p>
                            <p className="text-sm text-gray-600">Étudiant: {session.student_id}</p>
                          </div>
                          <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                            {session.status === 'completed' ? 'Terminée' : 'En cours'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">Aucune session récente</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performances</CardTitle>
                  <CardDescription>Statistiques des évaluations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Taux de completion</span>
                      <span className="font-bold">
                        {sessions.length > 0 
                          ? Math.round((stats.completedSessions / sessions.length) * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Sessions actives</span>
                      <span className="font-bold">{stats.activeSessions}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Étudiants engagés</span>
                      <span className="font-bold">{stats.totalStudents}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="scenarios">
            <Card>
              <CardHeader>
                <CardTitle>Gestion des Scénarios</CardTitle>
                <CardDescription>Créez et gérez vos scénarios ECOS</CardDescription>
              </CardHeader>
              <CardContent>
                {scenarios.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {scenarios.map((scenario: any) => (
                      <Card key={scenario.id} className="hover:shadow-md transition-shadow">
                        <CardHeader>
                          <CardTitle className="text-lg">{scenario.title || `Scénario ${scenario.id}`}</CardTitle>
                          <CardDescription>{scenario.description || 'Description non disponible'}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <Play className="h-4 w-4 mr-1" />
                              Lancer
                            </Button>
                            <Button size="sm" variant="outline">
                              Modifier
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun scénario</h3>
                    <p className="text-gray-600 mb-4">Commencez par créer votre premier scénario ECOS</p>
                    <Button>
                      <BookOpen className="h-4 w-4 mr-2" />
                      Créer un scénario
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions">
            <Card>
              <CardHeader>
                <CardTitle>Sessions des Étudiants</CardTitle>
                <CardDescription>Suivez les sessions en cours et terminées</CardDescription>
              </CardHeader>
              <CardContent>
                {sessions.length > 0 ? (
                  <div className="space-y-4">
                    {sessions.map((session: any) => (
                      <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-medium">Session #{session.id}</p>
                            <p className="text-sm text-gray-600">
                              Étudiant: {session.student_id} | 
                              Scénario: {session.scenario_id}
                            </p>
                            <p className="text-xs text-gray-500">
                              Créée: {new Date(session.created_at).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                            {session.status === 'completed' ? 'Terminée' : 'En cours'}
                          </Badge>
                          <Button size="sm" variant="outline">
                            Voir détails
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune session</h3>
                    <p className="text-gray-600">Les sessions des étudiants apparaîtront ici</p>
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

export default TeacherPage;
