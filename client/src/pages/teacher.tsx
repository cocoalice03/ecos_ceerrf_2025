import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, BookOpen, TrendingUp, Clock, Play, Pause, RotateCcw, Wand2 } from "lucide-react";
import { useDashboardData } from '@/lib/api';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import TeacherAssistant from "@/components/ecos/TeacherAssistant";
import EcosDebugger from "@/components/debug/EcosDebugger";
import { apiRequest } from "@/lib/queryClient";

interface ScenarioCreationFormProps {
  email: string;
  onSuccess: () => void;
}

function ScenarioCreationForm({ email, onSuccess }: ScenarioCreationFormProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    patientPrompt: "",
    evaluationCriteria: ""
  });

  const queryClient = useQueryClient();

  // Create scenario mutation
  const createScenarioMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Creating scenario:", { email, ...data });
      return apiRequest('POST', '/api/ecos/scenarios', {
        email,
        ...data
      });
    },
    onSuccess: (response) => {
      console.log("Scenario created successfully:", response);
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      setFormData({ title: "", description: "", patientPrompt: "", evaluationCriteria: "" });
      onSuccess();
      alert("Scénario créé avec succès !");
    },
    onError: (error) => {
      console.error("Error creating scenario:", error);
      alert("Erreur lors de la création du scénario. Veuillez réessayer.");
    }
  });

  // Generate prompt mutation
  const generatePromptMutation = useMutation({
    mutationFn: async (input: string) => {
      return apiRequest('POST', '/api/ecos/prompt-assistant', {
        email,
        input,
        contextDocs: []
      });
    },
    onSuccess: (data) => {
      setFormData(prev => ({ ...prev, patientPrompt: data.prompt }));
    }
  });

  const handleCreateScenario = () => {
    if (!formData.title || !formData.description) {
      alert("Veuillez remplir au moins le titre et la description du scénario.");
      return;
    }

    let criteria = undefined;

    if (formData.evaluationCriteria && formData.evaluationCriteria.trim()) {
      try {
        criteria = JSON.parse(formData.evaluationCriteria);
      } catch (error) {
        alert("Erreur : Les critères d'évaluation doivent être au format JSON valide. Exemple : {\"anamnese\": 20, \"examen_physique\": 30}");
        return;
      }
    }

    createScenarioMutation.mutate({
      title: formData.title,
      description: formData.description,
      patientPrompt: formData.patientPrompt || undefined,
      evaluationCriteria: criteria
    });
  };

  const handleGeneratePrompt = () => {
    if (formData.description) {
      generatePromptMutation.mutate(formData.description);
    } else {
      alert("Veuillez d'abord saisir une description du scénario.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="title">Titre du Scénario *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Ex: Consultation cardiologique - Douleur thoracique"
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="description">Description du Scénario *</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Décrivez le contexte clinique : patient, symptômes, antécédents, situation d'urgence, etc."
          rows={4}
          className="mt-1"
        />
        <p className="text-xs text-gray-500 mt-1">
          Décrivez précisément la situation clinique que l'étudiant devra gérer.
        </p>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <Label htmlFor="patientPrompt">Prompt du Patient Virtuel</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGeneratePrompt}
            disabled={!formData.description || generatePromptMutation.isPending}
          >
            <Wand2 className="w-4 h-4 mr-1" />
            {generatePromptMutation.isPending ? "Génération..." : "Générer avec IA"}
          </Button>
        </div>
        <Textarea
          id="patientPrompt"
          value={formData.patientPrompt}
          onChange={(e) => setFormData(prev => ({ ...prev, patientPrompt: e.target.value }))}
          placeholder="Instructions détaillées pour l'IA qui jouera le rôle du patient. Incluez la personnalité, les réponses aux questions, l'état émotionnel, etc."
          rows={8}
          className="mt-1"
        />
        <p className="text-xs text-gray-500 mt-1">
          Si laissé vide, un prompt sera généré automatiquement basé sur la description.
        </p>
      </div>

      <div>
        <Label htmlFor="evaluationCriteria">Critères d'Évaluation (Format JSON)</Label>
        <Textarea
          id="evaluationCriteria"
          value={formData.evaluationCriteria}
          onChange={(e) => setFormData(prev => ({ ...prev, evaluationCriteria: e.target.value }))}
          placeholder={`{
  "communication": 20,
  "anamnese": 25,
  "examen_physique": 25,
  "raisonnement_clinique": 30
}`}
          rows={6}
          className="mt-1 font-mono text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Format JSON requis. Chaque critère avec sa pondération (total libre). Si laissé vide, des critères par défaut seront appliqués.
        </p>
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          onClick={handleCreateScenario}
          disabled={!formData.title || !formData.description || createScenarioMutation.isPending}
          className="flex-1"
        >
          {createScenarioMutation.isPending ? "Création en cours..." : "Créer le Scénario"}
        </Button>

        <Button
          variant="outline"
          onClick={() => setFormData({ title: "", description: "", patientPrompt: "", evaluationCriteria: "" })}
          disabled={createScenarioMutation.isPending}
        >
          Réinitialiser
        </Button>
      </div>
    </div>
  );
}

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
          <TabsList className="grid grid-cols-5 w-fit">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="scenarios">Scénarios</TabsTrigger>
            <TabsTrigger value="create">Créer</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="debug">Debug</TabsTrigger>
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
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Gestion des Scénarios</CardTitle>
                  <CardDescription>Créez et gérez vos scénarios ECOS</CardDescription>
                </div>
                <Button onClick={() => setActiveTab('create')}>
                  <BookOpen className="h-4 w-4 mr-2" />
                  Nouveau Scénario
                </Button>
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
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => window.open(`/student?scenario=${scenario.id}`, '_blank')}
                            >
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
                    <Button onClick={() => setActiveTab('create')}>
                      <BookOpen className="h-4 w-4 mr-2" />
                      Créer un scénario
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="create">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Créer un Nouveau Scénario ECOS</CardTitle>
                  <CardDescription>Définissez un nouveau scénario d'examen clinique structuré</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ScenarioCreationForm email={email || ''} onSuccess={() => setActiveTab('scenarios')} />
                </CardContent>
              </Card>
            </div>
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

          <TabsContent value="debug">
            <Card>
              <CardHeader>
                <CardTitle>Debug ECOS</CardTitle>
                <CardDescription>Diagnostiquer les problèmes d'autorisation</CardDescription>
              </CardHeader>
              <CardContent>
                <EcosDebugger email={email || ''} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default TeacherPage;