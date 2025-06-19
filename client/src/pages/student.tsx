import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Play, MessageSquare, Clock, Award, TrendingUp, User, Bot, Send, BookOpen, Stethoscope, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import QuickDiagnostic from '@/components/debug/QuickDiagnostic';

interface StudentPageProps {
  email: string;
}

export default function StudentPage({ email }: StudentPageProps) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentScenarioId, setCurrentScenarioId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickDiagnostic, setShowQuickDiagnostic] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch available scenarios for the student
  const { data: scenarios = [], isLoading: scenariosLoading } = useQuery<any[]>({
    queryKey: [`/api/student/available-scenarios?email=${encodeURIComponent(email)}`],
  });

  // Fetch student's session history
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<any[]>({
    queryKey: [`/api/ecos/sessions?email=${encodeURIComponent(email)}`],
  });

  // Fetch current session details if active
  const { data: currentSession = {} } = useQuery<any>({
    queryKey: [`/api/ecos/sessions/${activeSessionId}`],
    enabled: !!activeSessionId,
  });

  // Create a new training session
  const createSessionMutation = useMutation({
    mutationFn: (scenarioId: string) => 
      apiRequest('POST', '/api/ecos/sessions', {
        scenarioId,
        studentEmail: email,
      }),
    onSuccess: (data) => {
      setActiveSessionId(data.id);
      setCurrentScenarioId(data.scenarioId);
      setChatMessages([]);
      queryClient.invalidateQueries({ queryKey: ['/api/ecos/sessions'] });
      toast({
        title: "Session créée",
        description: "Votre session d'entraînement a commencé.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de créer la session.",
        variant: "destructive",
      });
    },
  });

  // Send message to patient simulator
  const sendMessageMutation = useMutation({
    mutationFn: (message: string) => 
      apiRequest('POST', '/api/ecos/patient-simulator', {
        sessionId: activeSessionId,
        message,
        studentEmail: email,
      }),
    onSuccess: (data) => {
      const newUserMessage = {
        id: Date.now(),
        role: 'user',
        content: currentMessage,
        timestamp: new Date().toISOString(),
      };
      const newBotMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
      };
      setChatMessages(prev => [...prev, newUserMessage, newBotMessage]);
      setCurrentMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/ecos/sessions', activeSessionId] });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le message.",
        variant: "destructive",
      });
    },
  });

  // Complete session and get evaluation
  const completeSessionMutation = useMutation({
    mutationFn: () => 
      apiRequest('POST', '/api/ecos/evaluate', {
        sessionId: activeSessionId,
        studentEmail: email,
      }),
    onSuccess: () => {
      setActiveSessionId(null);
      setCurrentScenarioId(null);
      setChatMessages([]);
      queryClient.invalidateQueries({ queryKey: ['/api/ecos/sessions'] });
      toast({
        title: "Session terminée",
        description: "Votre évaluation a été générée. Consultez vos résultats.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de terminer la session.",
        variant: "destructive",
      });
    },
  });

  const handleStartSession = (scenarioId: string) => {
    createSessionMutation.mutate(scenarioId);
  };

  const handleSendMessage = () => {
    if (!currentMessage.trim() || !activeSessionId) return;
    sendMessageMutation.mutate(currentMessage);
  };

  const handleCompleteSession = () => {
    if (!activeSessionId) return;
    completeSessionMutation.mutate();
  };

  const handleViewReport = (sessionId: string) => {
    // Navigate to report view (implement based on your routing)
    window.open(`/ecos/sessions/${sessionId}/report`, '_blank');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Load messages when session becomes active
  useEffect(() => {
    if ((currentSession as any)?.messages) {
      setChatMessages((currentSession as any).messages);
    }
  }, [currentSession]);

  if (activeSessionId && currentScenarioId) {
    const currentScenario = (scenarios as any[]).find((s: any) => s.id === currentScenarioId);
    
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Session ECOS Active</h1>
              <p className="text-gray-600">{currentScenario?.title}</p>
            </div>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setActiveSessionId(null);
                  setCurrentScenarioId(null);
                  setChatMessages([]);
                }}
              >
                Abandonner
              </Button>
              <Button 
                onClick={handleCompleteSession}
                disabled={completeSessionMutation.isPending}
              >
                Terminer Session
              </Button>
            </div>
          </div>
        </div>

        <Card className="h-[600px] flex flex-col">
          <CardHeader className="pb-4">
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-lg">Consultation Virtuelle</CardTitle>
              <Badge variant="outline" className="ml-auto">
                En cours
              </Badge>
            </div>
            <CardDescription>
              {currentScenario?.description}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col">
            <ScrollArea className="flex-1 pr-4 mb-4">
              <div className="space-y-4">
                {chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        {message.role === 'assistant' && (
                          <Bot className="w-4 h-4 mt-1 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm">{message.content}</p>
                          <p className={`text-xs mt-1 ${
                            message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {sendMessageMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg px-4 py-2">
                      <div className="flex items-center space-x-2">
                        <Bot className="w-4 h-4" />
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            
            <div className="flex space-x-2">
              <Textarea
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyDown={handleKeyDown as any}
                placeholder="Tapez votre question ou commentaire au patient..."
                className="flex-1 min-h-[60px] resize-none"
                disabled={sendMessageMutation.isPending}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!currentMessage.trim() || sendMessageMutation.isPending}
                size="lg"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Espace Étudiant</h1>
        <p className="text-gray-600">Bienvenue {email}</p>
      </div>

      <Tabs defaultValue="scenarios" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scenarios" className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4" />
            <span>Scénarios Disponibles</span>
          </TabsTrigger>
          <TabsTrigger value="progress" className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4" />
            <span>Progression</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span>Historique</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scenarios" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {scenariosLoading ? (
              [...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-20 bg-gray-200 rounded mb-4"></div>
                    <div className="h-9 bg-gray-200 rounded"></div>
                  </CardContent>
                </Card>
              ))
            ) : (scenarios as any[]).length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Stethoscope className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun scénario disponible</h3>
                <p className="text-gray-500">
                  Contactez votre enseignant pour obtenir l'accès aux scénarios d'entraînement.
                </p>
              </div>
            ) : (
              (scenarios as any[]).map((scenario: any) => (
                <Card key={scenario.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {scenario.difficulty || 'Standard'}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {scenario.duration || '30'} min
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{scenario.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {scenario.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm text-gray-600">
                        <strong>Objectifs:</strong>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          {scenario.learningObjectives?.slice(0, 2).map((objective: string, index: number) => (
                            <li key={index} className="text-xs">{objective}</li>
                          ))}
                        </ul>
                      </div>
                      <Button 
                        onClick={() => handleStartSession(scenario.id)}
                        disabled={createSessionMutation.isPending}
                        className="w-full"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Commencer
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="progress" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <span>Statistiques Générales</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Sessions Complétées</span>
                  <span className="text-2xl font-bold text-green-600">
                    {(sessions as any[]).filter((s: any) => s.status === 'completed').length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Sessions en Cours</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {(sessions as any[]).filter((s: any) => s.status === 'in_progress').length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Score Moyen</span>
                  <span className="text-2xl font-bold text-purple-600">
                    {(sessions as any[]).length > 0 ? 
                      Math.round((sessions as any[]).reduce((acc: number, s: any) => acc + (s.score || 0), 0) / (sessions as any[]).length) 
                      : 0}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Compétences Développées</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {['Anamnèse', 'Examen Clinique', 'Diagnostic', 'Communication'].map((skill) => (
                  <div key={skill} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{skill}</span>
                      <span>{Math.floor(Math.random() * 30) + 70}%</span>
                    </div>
                    <Progress value={Math.floor(Math.random() * 30) + 70} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
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
              ) : (sessions as any[]).length === 0 ? (
                <p className="text-gray-500 text-center py-8">Aucune session trouvée</p>
              ) : (
                <div className="space-y-4">
                  {(sessions as any[]).map((session: any) => (
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

      {/* Quick Diagnostic Modal */}
      {showQuickDiagnostic && (
        <QuickDiagnostic onClose={() => setShowQuickDiagnostic(false)} />
      )}
    </div>
  );
}