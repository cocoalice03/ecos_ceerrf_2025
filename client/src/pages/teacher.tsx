import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, BookOpen, TrendingUp, Clock, Play, Pause, RotateCcw, Wand2, Calendar, UserPlus, CheckCircle } from "lucide-react";
import { useDashboardData, useAvailableIndexes, useTeacherStudents } from '@/lib/api';
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import TeacherAssistant from "@/components/ecos/TeacherAssistant";
import EcosDebugger from "@/components/debug/EcosDebugger";
import { AdminButton } from "@/components/layout/AdminButton";
import { apiRequest } from "@/lib/queryClient";
import TrainingSessionsTab from "@/components/ecos/TrainingSessionsTab";

interface ScenarioCreationFormProps {
  email: string;
  onSuccess: () => void;
  editingScenario?: any;
  onCancelEdit?: () => void;
}

function ScenarioCreationForm({ email, onSuccess, editingScenario, onCancelEdit }: ScenarioCreationFormProps) {
  const { data: availableIndexes } = useAvailableIndexes(email);
  const [formData, setFormData] = useState({
    title: editingScenario?.title || "",
    description: editingScenario?.description || "",
    patientPrompt: editingScenario?.patientPrompt || "",
    evaluationCriteria: editingScenario?.evaluationCriteria ? JSON.stringify(editingScenario.evaluationCriteria, null, 2) : "",
    pineconeIndex: editingScenario?.pineconeIndex || "",
    criteriaText: editingScenario?.criteriaText || ""
  });

  // Update form data when editing scenario changes
  useEffect(() => {
    if (editingScenario) {
      setFormData({
        title: editingScenario.title || "",
        description: editingScenario.description || "",
        patientPrompt: editingScenario.patientPrompt || "",
        evaluationCriteria: editingScenario.evaluationCriteria ? JSON.stringify(editingScenario.evaluationCriteria, null, 2) : "",
        pineconeIndex: editingScenario.pineconeIndex || "",
        criteriaText: editingScenario?.criteriaText || ""
      });
    }
  }, [editingScenario]);

  const queryClient = useQueryClient();

  // Create/Update scenario mutation
  const createScenarioMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingScenario) {
        console.log("Updating scenario:", { email, id: editingScenario.id, ...data });
        return apiRequest('PUT', `/api/ecos/scenarios/${editingScenario.id}`, {
          email,
          ...data
        });
      } else {
        console.log("Creating scenario:", { email, ...data });
        return apiRequest('POST', '/api/ecos/scenarios', {
          email,
          ...data
        });
      }
    },
    onSuccess: (response) => {
      console.log(`Scenario ${editingScenario ? 'updated' : 'created'} successfully:`, response);
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      setFormData({ title: "", description: "", patientPrompt: "", evaluationCriteria: "", pineconeIndex: "", criteriaText: "" });
      if (onCancelEdit) onCancelEdit();
      onSuccess();
      alert(`Scénario ${editingScenario ? 'modifié' : 'créé'} avec succès !`);
    },
    onError: (error) => {
      console.error(`Error ${editingScenario ? 'updating' : 'creating'} scenario:`, error);
      alert(`Erreur lors de la ${editingScenario ? 'modification' : 'création'} du scénario. Veuillez réessayer.`);
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

  const generateCriteriaMutation = useMutation({
    mutationFn: async () => {
      if (!formData.criteriaText) {
        throw new Error('Veuillez décrire les critères d\'évaluation');
      }

      return apiRequest('POST', '/api/ecos/generate-criteria', {
        email,
        description: formData.criteriaText,
      });
    },
    onSuccess: (data) => {
      setFormData(prev => ({
        ...prev,
        evaluationCriteria: JSON.stringify(data.criteria, null, 2)
      }));
    },
    onError: (error) => {
      console.error('Error generating criteria:', error);
      alert('Erreur lors de la génération des critères: ' + error.message);
    }
  });

  const handleGenerateCriteria = () => {
    generateCriteriaMutation.mutate();
  };

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
      evaluationCriteria: criteria,
      pineconeIndex: formData.pineconeIndex || undefined
    });
  };

  const handleCancel = () => {
    setFormData({ title: "", description: "", patientPrompt: "", evaluationCriteria: "", pineconeIndex: "", criteriaText: "" });
    if (onCancelEdit) onCancelEdit();
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
        <Label htmlFor="pineconeIndex">Index de Connaissances (Optionnel)</Label>
        <Select value={formData.pineconeIndex} onValueChange={(value) => setFormData(prev => ({ ...prev, pineconeIndex: value }))}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Sélectionner un index Pinecone" />
          </SelectTrigger>
          <SelectContent>
            {availableIndexes?.map((index: any) => (
              <SelectItem key={index.name} value={index.name}>
                {index.name} ({index.status})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">
          Choisissez l'index Pinecone contenant les connaissances spécifiques pour ce scénario.
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
        <Label htmlFor="criteriaText">Décrivez les Critères d'Évaluation</Label>
        <Textarea
          id="criteriaText"
          value={formData.criteriaText || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, criteriaText: e.target.value }))}
          placeholder="Décrivez les critères que vous souhaitez évaluer. Par exemple: L'étudiant doit être capable de mener une anamnèse complète, réaliser un examen physique systématique, poser des questions pertinentes sur les antécédents, établir un diagnostic différentiel..."
          rows={3}
          className="mt-1"
        />

        <Button
          onClick={handleGenerateCriteria}
          disabled={!formData.criteriaText || generateCriteriaMutation.isPending}
          variant="outline"
          className="mt-2"
        >
          {generateCriteriaMutation.isPending ? "Génération..." : "Générer les Critères JSON"}
        </Button>

        <div className="mt-4">
          <Label htmlFor="evaluationCriteria">Critères d'Évaluation (JSON généré)</Label>
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
            readOnly={generateCriteriaMutation.isPending}
          />
          <p className="text-xs text-gray-500 mt-1">
            Critères générés automatiquement ou modifiés manuellement
          </p>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          onClick={handleCreateScenario}
          disabled={!formData.title || !formData.description || createScenarioMutation.isPending}
          className="flex-1"
        >
          {createScenarioMutation.isPending 
            ? (editingScenario ? "Modification en cours..." : "Création en cours...") 
            : (editingScenario ? "Modifier le Scénario" : "Créer le Scénario")
          }
        </Button>

        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={createScenarioMutation.isPending}
        >
          {editingScenario ? "Annuler" : "Réinitialiser"}
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
  const [editingScenario, setEditingScenario] = useState<any>(null);
  const [deletingScenario, setDeletingScenario] = useState<any>(null);
  const [viewingSessionDetails, setViewingSessionDetails] = useState<any>(null);

  // Add debugging for authentication issues - MUST be before any conditional returns
  React.useEffect(() => {
    if (!email) {
      console.warn('No email detected for teacher dashboard');
    }
  }, [email]);

  console.log('TeacherPage rendering with email:', email);

  const { data: dashboardData, error: dashboardError, isLoading: isDashboardLoading } = useDashboardData(email || '');
  const { data: assignedStudents, isLoading: isStudentsLoading } = useTeacherStudents(email || '');

  // Fallback: try to get scenarios from student endpoint if dashboard fails
  const { data: studentScenarios } = useQuery({
    queryKey: ['student-scenarios-fallback', email],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/student/available-scenarios?email=${encodeURIComponent(email || '')}`);
        return response.scenarios || [];
      } catch (error) {
        console.error('Fallback scenarios fetch failed:', error);
        return [];
      }
    },
    enabled: !!email && (!!dashboardError || !dashboardData?.scenarios?.length),
  });

  // Check if we have actual errors vs just partial data
  const hasRealError = dashboardError || (dashboardData?.partial && dashboardData?.scenarios?.length === 0);

  console.log('Dashboard data:', dashboardData);
  console.log('Dashboard loading:', isDashboardLoading);
  console.log('Dashboard error:', dashboardError);

  // Provide fallback data structure
  const scenarios = dashboardData?.scenarios || studentScenarios || [];
  const sessions = dashboardData?.sessions || [];

  console.log('Scenarios:', scenarios);
  console.log('Sessions:', sessions);
  console.log('Dashboard stats from API:', dashboardData?.stats);

  // Use stats from API if available, otherwise calculate fallback
  const stats = dashboardData?.stats || {
    totalScenarios: scenarios.length,
    activeSessions: sessions.filter((s: any) => s.status === 'in_progress').length,
    completedSessions: sessions.filter((s: any) => s.status === 'completed').length,
    totalStudents: new Set(sessions.map((s: any) => s.student_id || s.studentEmail)).size
  };

  console.log('Final stats for display:', stats);

  const queryClient = useQueryClient();

  // Delete scenario mutation
  const deleteScenarioMutation = useMutation({
    mutationFn: async (scenarioId: number) => {
      return apiRequest('DELETE', `/api/ecos/scenarios/${scenarioId}?email=${encodeURIComponent(email || '')}`, { email });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      setDeletingScenario(null);
      alert("Scénario supprimé avec succès !");
    },
    onError: (error) => {
      console.error("Error deleting scenario:", error);
      alert("Erreur lors de la suppression du scénario.");
    }
  });

  const handleDeleteScenario = (scenario: any) => {
    setDeletingScenario(scenario);
  };

  const confirmDelete = () => {
    if (deletingScenario) {
      deleteScenarioMutation.mutate(deletingScenario.id);
    }
  };

  const handleEditScenario = (scenario: any) => {
    setEditingScenario(scenario);
    setActiveTab('create');
  };

  const handleViewSessionDetails = (session: any) => {
    setViewingSessionDetails(session);
  };

  if (isDashboardLoading) {
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
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Tableau de bord Enseignant</h1>
              <p className="text-gray-600 mt-2">Gérez vos scénarios ECOS et suivez les progrès de vos étudiants</p>
              {email && <p className="text-sm text-blue-600 mt-1">Connecté en tant que: {email}</p>}
          {hasRealError && (
            <div className="mt-2 p-2 bg-yellow-100 border border-yellow-400 rounded text-yellow-800 text-sm">
              ⚠️ Données partiellement disponibles (mode dégradé)
            </div>
          )}
            </div>
            <div className="flex gap-3">
              <AdminButton email={email || ''} />
            </div>
          </div>
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
          <TabsList className="grid grid-cols-6 w-fit">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="scenarios">Scénarios</TabsTrigger>
            <TabsTrigger value="create">Créer</TabsTrigger>
            <TabsTrigger value="training-sessions">Sessions Formation</TabsTrigger>
            <TabsTrigger value="sessions">Sessions ECOS</TabsTrigger>
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
                            <p className="text-sm text-gray-600">Étudiant: {session.studentEmail || session.student_id || 'Non défini'}</p>
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
                          {scenario.pineconeIndex && (
                            <Badge variant="outline" className="w-fit mt-2">
                              Index: {scenario.pineconeIndex}
                            </Badge>
                          )}
                        </CardHeader>
                        <CardContent>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => window.open(`/student/${encodeURIComponent(email || '')}?scenario=${scenario.id}`, '_blank')}
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Lancer
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleEditScenario(scenario)}
                            >
                              Modifier
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => handleDeleteScenario(scenario)}
                            >
                              Supprimer
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
                  <CardTitle>
                    {editingScenario ? "Modifier le Scénario ECOS" : "Créer un Nouveau Scénario ECOS"}
                  </CardTitle>
                  <CardDescription>
                    {editingScenario 
                      ? "Modifiez les détails de votre scénario d'examen clinique structuré"
                      : "Définissez un nouveau scénario d'examen clinique structuré"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ScenarioCreationForm 
                    email={email || ''} 
                    onSuccess={() => {
                      setEditingScenario(null);
                      setActiveTab('scenarios');
                    }}
                    editingScenario={editingScenario}
                    onCancelEdit={() => {
                      setEditingScenario(null);
                      setActiveTab('scenarios');
                    }}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="training-sessions">
            <TrainingSessionsTab email={email || ''} />
          </TabsContent>

          <TabsContent value="sessions">
            <Card>
              <CardHeader>
                <CardTitle>Sessions ECOS des Étudiants</CardTitle>
                <CardDescription>Suivez les sessions d'examen en cours et terminées</CardDescription>
              </CardHeader>
              <CardContent>
                {isStudentsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Chargement des étudiants...</p>
                  </div>
                ) : assignedStudents && assignedStudents.length > 0 ? (
                  <div className="space-y-4">
                    {/* Group students by email */}
                    {Object.entries(
                      assignedStudents.reduce((acc: any, student: any) => {
                        if (!acc[student.studentEmail]) {
                          acc[student.studentEmail] = [];
                        }
                        acc[student.studentEmail].push(student);
                        return acc;
                      }, {})
                    ).map(([studentEmail, studentSessions]: [string, any]) => (
                      <div key={studentEmail} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-medium text-lg">{studentEmail}</h4>
                            <p className="text-sm text-gray-600">
                              Session de formation: {studentSessions[0].trainingSessionTitle}
                            </p>
                          </div>
                          <Badge variant="outline">
                            <UserPlus className="w-3 h-3 mr-1" />
                            Assigné
                          </Badge>
                        </div>
                        
                        {/* Show ECOS sessions for this student */}
                        <div className="space-y-2">
                          {studentSessions.filter((s: any) => s.ecosSessionId).length > 0 ? (
                            studentSessions
                              .filter((s: any) => s.ecosSessionId)
                              .map((session: any) => (
                                <div key={session.ecosSessionId} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                  <div>
                                    <p className="font-medium">Session ECOS #{session.ecosSessionId}</p>
                                    <p className="text-sm text-gray-600">
                                      Scénario: {session.ecosScenarioTitle}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      Démarrée: {new Date(session.ecosSessionStartTime).toLocaleString('fr-FR')}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant={session.ecosSessionStatus === 'completed' ? 'default' : 'secondary'}>
                                      {session.ecosSessionStatus === 'completed' ? 'Terminée' : 'En cours'}
                                    </Badge>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => handleViewSessionDetails(session)}
                                    >
                                      Détails
                                    </Button>
                                  </div>
                                </div>
                              ))
                          ) : (
                            <div className="p-3 bg-blue-50 rounded text-center">
                              <p className="text-sm text-blue-700">Aucune session ECOS démarrée</p>
                              <p className="text-xs text-blue-600">L'étudiant peut commencer un examen depuis son interface</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun étudiant assigné</h3>
                    <p className="text-gray-600">Les étudiants assignés aux sessions de formation apparaîtront ici</p>
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

        {/* Delete Confirmation Dialog */}
        {deletingScenario && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Confirmer la suppression</h3>
              <p className="text-gray-600 mb-6">
                Êtes-vous sûr de vouloir supprimer le scénario "{deletingScenario.title}" ? 
                Cette action est irréversible et supprimera également toutes les sessions associées.
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setDeletingScenario(null)}
                  disabled={deleteScenarioMutation.isPending}
                >
                  Annuler
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDelete}
                  disabled={deleteScenarioMutation.isPending}
                >
                  {deleteScenarioMutation.isPending ? "Suppression..." : "Supprimer"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Session Details Modal */}
        {viewingSessionDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Détails de la Session #{viewingSessionDetails.id}</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingSessionDetails(null)}
                >
                  Fermer
                </Button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Statut</label>
                    <div className="mt-1">
                      <Badge variant={viewingSessionDetails.status === 'completed' ? 'default' : 'secondary'}>
                        {viewingSessionDetails.status === 'completed' ? 'Terminée' : 'En cours'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Scénario</label>
                    <p className="mt-1 text-sm">{viewingSessionDetails.scenarioTitle || `Scénario #${viewingSessionDetails.scenarioId}`}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Étudiant</label>
                    <p className="mt-1 text-sm">{viewingSessionDetails.student_id}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Durée</label>
                    <p className="mt-1 text-sm">
                      {viewingSessionDetails.endTime 
                        ? `${Math.round((new Date(viewingSessionDetails.endTime).getTime() - new Date(viewingSessionDetails.startTime).getTime()) / 1000 / 60)} minutes`
                        : 'En cours'
                      }
                    </p>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Heure de début</label>
                  <p className="mt-1 text-sm">{new Date(viewingSessionDetails.startTime).toLocaleString('fr-FR')}</p>
                </div>
                
                {viewingSessionDetails.endTime && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Heure de fin</label>
                    <p className="mt-1 text-sm">{new Date(viewingSessionDetails.endTime).toLocaleString('fr-FR')}</p>
                  </div>
                )}
                
                {viewingSessionDetails.status === 'completed' && (
                  <div className="pt-4 border-t">
                    <Button
                      onClick={() => window.open(`/student/${encodeURIComponent(email || '')}?report=${viewingSessionDetails.id}`, '_blank')}
                      className="w-full"
                    >
                      Voir le Rapport d'Évaluation
                    </Button>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Si la session était vide, le rapport indiquera que l'évaluation n'est pas disponible
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TeacherPage;