
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, UserPlus, CheckCircle, Edit, Trash2, Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface TrainingSessionsTabProps {
  email: string;
}

interface TrainingSession {
  id: number;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  scenarios: Array<{
    id: number;
    title: string;
    description: string;
  }>;
  studentCount: number;
}

interface CreateTrainingSessionFormProps {
  email: string;
  scenarios: any[];
  onSuccess: () => void;
  editingSession?: TrainingSession | null;
  onCancelEdit?: () => void;
}

function CreateTrainingSessionForm({ email, scenarios, onSuccess, editingSession, onCancelEdit }: CreateTrainingSessionFormProps) {
  const [formData, setFormData] = useState({
    title: editingSession?.title || "",
    description: editingSession?.description || "",
    startDate: editingSession?.startDate ? new Date(editingSession.startDate).toISOString().slice(0, 16) : "",
    endDate: editingSession?.endDate ? new Date(editingSession.endDate).toISOString().slice(0, 16) : "",
    selectedScenarios: editingSession?.scenarios?.map(s => s.id) || [],
    studentEmails: [],
  });

  const [studentEmailsText, setStudentEmailsText] = useState("");

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingSession) {
        return apiRequest('PUT', `/api/training-sessions/${editingSession.id}`, {
          email,
          ...data
        });
      } else {
        return apiRequest('POST', '/api/training-sessions', {
          email,
          ...data
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
      setFormData({
        title: "",
        description: "",
        startDate: "",
        endDate: "",
        selectedScenarios: [],
        studentEmails: [],
      });
      setStudentEmailsText("");
      if (onCancelEdit) onCancelEdit();
      onSuccess();
      alert(`Session de formation ${editingSession ? 'modifiée' : 'créée'} avec succès !`);
    },
    onError: (error: any) => {
      alert(`Erreur lors de la ${editingSession ? 'modification' : 'création'} de la session : ${error.message}`);
    }
  });

  const handleSubmit = () => {
    if (!formData.title || !formData.startDate || !formData.endDate) {
      alert("Veuillez remplir tous les champs obligatoires");
      return;
    }

    if (new Date(formData.startDate) >= new Date(formData.endDate)) {
      alert("La date de fin doit être postérieure à la date de début");
      return;
    }

    // Parse student emails
    const emails = studentEmailsText
      .split(/[,\n]/)
      .map(email => email.trim())
      .filter(email => email.length > 0);

    createMutation.mutate({
      ...formData,
      scenarioIds: formData.selectedScenarios,
      studentEmails: emails,
    });
  };

  const toggleScenario = (scenarioId: number) => {
    setFormData(prev => ({
      ...prev,
      selectedScenarios: prev.selectedScenarios.includes(scenarioId)
        ? prev.selectedScenarios.filter(id => id !== scenarioId)
        : [...prev.selectedScenarios, scenarioId]
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {editingSession ? "Modifier la Session de Formation" : "Créer une Nouvelle Session de Formation"}
        </CardTitle>
        <CardDescription>
          Une session de formation regroupe plusieurs scénarios ECOS disponibles pour un groupe d'étudiants pendant une période définie
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="title">Titre de la Session *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Formation Cardiologie - Semaine 1"
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Description de la session de formation..."
              rows={2}
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startDate">Date et Heure de Début *</Label>
            <Input
              id="startDate"
              type="datetime-local"
              value={formData.startDate}
              onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="endDate">Date et Heure de Fin *</Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={formData.endDate}
              onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label>Scénarios ECOS à Inclure</Label>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
            {scenarios.map((scenario) => (
              <div key={scenario.id} className="flex items-start space-x-2 p-3 border rounded">
                <Checkbox
                  id={`scenario-${scenario.id}`}
                  checked={formData.selectedScenarios.includes(scenario.id)}
                  onCheckedChange={() => toggleScenario(scenario.id)}
                />
                <div className="flex-1">
                  <label htmlFor={`scenario-${scenario.id}`} className="text-sm font-medium cursor-pointer">
                    {scenario.title}
                  </label>
                  <p className="text-xs text-gray-600 mt-1">{scenario.description}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {formData.selectedScenarios.length} scénario(s) sélectionné(s)
          </p>
        </div>

        <div>
          <Label htmlFor="studentEmails">Emails des Étudiants (optionnel)</Label>
          <Textarea
            id="studentEmails"
            value={studentEmailsText}
            onChange={(e) => setStudentEmailsText(e.target.value)}
            placeholder="etudiant1@email.com, etudiant2@email.com&#10;ou un email par ligne..."
            rows={4}
            className="mt-1"
          />
          <p className="text-xs text-gray-500 mt-1">
            Séparez les emails par des virgules ou des retours à la ligne. Les étudiants pourront accéder aux scénarios pendant la période définie.
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="flex-1"
          >
            {createMutation.isPending 
              ? (editingSession ? "Modification en cours..." : "Création en cours...") 
              : (editingSession ? "Modifier la Session" : "Créer la Session")
            }
          </Button>

          {editingSession && (
            <Button
              variant="outline"
              onClick={onCancelEdit}
              disabled={createMutation.isPending}
            >
              Annuler
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function TrainingSessionsTab({ email }: TrainingSessionsTabProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
  const [deletingSession, setDeletingSession] = useState<TrainingSession | null>(null);

  // Fetch training sessions
  const { data: trainingSessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['training-sessions', email],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/training-sessions?email=${encodeURIComponent(email)}`);
      return response.trainingSessions || [];
    },
    enabled: !!email,
  });

  // Fetch scenarios for the form
  const { data: scenarios } = useQuery({
    queryKey: ['ecos-scenarios', email],
    queryFn: async () => {
      try {
        // Try admin endpoint first
        const response = await apiRequest('GET', `/api/ecos/scenarios?email=${encodeURIComponent(email)}`);
        return response.scenarios || [];
      } catch (error) {
        // Fallback to student endpoint
        try {
          const fallbackResponse = await apiRequest('GET', `/api/student/available-scenarios?email=${encodeURIComponent(email)}`);
          return fallbackResponse.scenarios || [];
        } catch (fallbackError) {
          console.error('Both scenario endpoints failed:', error, fallbackError);
          return [];
        }
      }
    },
    enabled: !!email,
  });

  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      return apiRequest('DELETE', `/api/training-sessions/${sessionId}?email=${encodeURIComponent(email)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
      setDeletingSession(null);
      alert("Session de formation supprimée avec succès !");
    },
    onError: (error: any) => {
      alert("Erreur lors de la suppression : " + error.message);
    }
  });

  const isSessionActive = (session: TrainingSession) => {
    const now = new Date();
    const start = new Date(session.startDate);
    const end = new Date(session.endDate);
    return now >= start && now <= end;
  };

  const getSessionStatus = (session: TrainingSession) => {
    const now = new Date();
    const start = new Date(session.startDate);
    const end = new Date(session.endDate);
    
    if (now < start) return 'planned';
    if (now > end) return 'completed';
    return 'active';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'planned':
        return <Badge variant="secondary">Planifiée</Badge>;
      case 'active':
        return <Badge variant="default" className="bg-green-600">Active</Badge>;
      case 'completed':
        return <Badge variant="outline">Terminée</Badge>;
      default:
        return <Badge variant="secondary">Inconnue</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Sessions de Formation</h2>
          <p className="text-gray-600">Gérez les sessions de formation regroupant plusieurs scénarios ECOS</p>
        </div>
        <Button 
          onClick={() => setShowCreateForm(true)}
          disabled={!scenarios?.length}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle Session
        </Button>
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingSession) && (
        <CreateTrainingSessionForm
          email={email}
          scenarios={scenarios || []}
          onSuccess={() => {
            setShowCreateForm(false);
            setEditingSession(null);
          }}
          editingSession={editingSession}
          onCancelEdit={() => {
            setShowCreateForm(false);
            setEditingSession(null);
          }}
        />
      )}

      {/* Training Sessions List */}
      <Card>
        <CardHeader>
          <CardTitle>Sessions de Formation</CardTitle>
          <CardDescription>
            {trainingSessions?.length || 0} session(s) de formation créée(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <p className="text-center py-8">Chargement des sessions...</p>
          ) : trainingSessions?.length > 0 ? (
            <div className="space-y-4">
              {trainingSessions.map((session: TrainingSession) => {
                const status = getSessionStatus(session);
                return (
                  <div key={session.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{session.title}</h3>
                          {getStatusBadge(status)}
                        </div>
                        {session.description && (
                          <p className="text-gray-600 text-sm mb-2">{session.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(session.startDate).toLocaleDateString('fr-FR')} - {new Date(session.endDate).toLocaleDateString('fr-FR')}
                          </span>
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-4 h-4" />
                            {session.scenarios.length} scénario(s)
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {session.studentCount} étudiant(s)
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingSession(session)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Modifier
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeletingSession(session)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Supprimer
                        </Button>
                      </div>
                    </div>
                    
                    {/* Scenarios list */}
                    {session.scenarios.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium mb-2">Scénarios inclus :</p>
                        <div className="flex flex-wrap gap-2">
                          {session.scenarios.map((scenario) => (
                            <Badge key={scenario.id} variant="outline" className="text-xs">
                              {scenario.title}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune session de formation</h3>
              <p className="text-gray-600 mb-4">Créez votre première session de formation pour regrouper des scénarios ECOS</p>
              {scenarios?.length > 0 ? (
                <Button onClick={() => setShowCreateForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Créer une session
                </Button>
              ) : (
                <p className="text-sm text-gray-500">Vous devez d'abord créer des scénarios ECOS</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      {deletingSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Confirmer la suppression</h3>
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer la session de formation "{deletingSession.title}" ? 
              Cette action est irréversible.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setDeletingSession(null)}
                disabled={deleteMutation.isPending}
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate(deletingSession.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
