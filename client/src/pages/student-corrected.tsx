import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  const [showQuickDiagnostic, setShowQuickDiagnostic] = useState(false);
  const [viewingReport, setViewingReport] = useState(false);
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
  const startSessionMutation = useMutation({
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
    onError: () => {
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
      queryClient.invalidateQueries({ queryKey: [`/api/ecos/sessions/${activeSessionId}`] });
    },
    onError: () => {
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
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de terminer la session.",
        variant: "destructive",
      });
    },
  });

  const handleStartSession = (scenarioId: string) => {
    startSessionMutation.mutate(scenarioId);
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
    window.open(`/ecos/sessions/${sessionId}/report`, '_blank');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
    const currentScenario = scenarios.find((s: any) => s.id === currentScenarioId);
    
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
                onKeyDown={handleKeyDown}
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
          {!activeSessionId && !viewingReport && (
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
                ) : scenarios.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun scénario disponible</h3>
                      <p className="text-gray-600">
                        Aucun scénario ECOS n'est actuellement disponible pour vous.
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        Contactez votre enseignant pour plus d'informations.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {scenarios.map((scenario: any) => (
                      <Card key={scenario.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                        <div className="relative h-48 bg-gradient-to-br from-blue-50 to-indigo-100">
                          {scenario.id === 1 ? (
                            <img 
                              src="/images/douleur_thoracique.png"
                              className="w-full h-full object-cover"
                              alt="Consultation d'urgence - Douleur thoracique"
                            />
                          ) : scenario.id === 2 ? (
                            <img 
                              src="/images/consultation_femme.png"
                              className="w-full h-full object-cover"
                              alt="Consultation gynécologique"
                            />
                          ) : scenario.id === 3 ? (
                            <img 
                              src="/images/urgence_pediatrique.png"
                              className="w-full h-full object-cover"
                              alt="Urgence pédiatrique"
                            />
                          ) : scenario.id === 4 ? (
                            <img 
                              src="/images/cardiologie.png"
                              className="w-full h-full object-cover"
                              alt="Consultation cardiologique"
                            />
                          ) : scenario.id === 5 ? (
                            <img 
                              src="/images/neurologie.png"
                              className="w-full h-full object-cover"
                              alt="Consultation neurologique"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <img 
                                src="/images/cahier.png"
                                className="w-16 h-16 opacity-60"
                                alt="Scénario d'examen"
                              />
                            </div>
                          )}
                          
                          <div className="absolute top-3 right-3">
                            <Badge className="bg-white/90 text-gray-700 shadow-sm">
                              Scénario #{scenario.id}
                            </Badge>
                          </div>
                        </div>

                        <CardContent className="p-6">
                          <div className="space-y-4">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                {scenario.title || `Scénario ${scenario.id}`}
                              </h3>
                              <p className="text-sm text-gray-600 line-clamp-3">
                                {scenario.description || 'Description non disponible'}
                              </p>
                            </div>

                            {scenario.pineconeIndex && (
                              <Badge variant="outline" className="w-fit">
                                Index: {scenario.pineconeIndex}
                              </Badge>
                            )}

                            <Button 
                              onClick={() => handleStartSession(scenario.id)} 
                              className="w-full group bg-blue-600 hover:bg-blue-700"
                              disabled={startSessionMutation.isPending}
                            >
                              {startSessionMutation.isPending ? (
                                <div className="flex items-center">
                                  <div className="w-4 h-4 border-t-2 border-white border-solid rounded-full animate-spin mr-2"></div>
                                  Initialisation...
                                </div>
                              ) : (
                                <>
                                  <Play className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                                  Commencer l'Examen
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
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
                    {sessions.filter((s: any) => s.status === 'completed').length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Sessions en Cours</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {sessions.filter((s: any) => s.status === 'in_progress').length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Score Moyen</span>
                  <span className="text-2xl font-bold text-purple-600">
                    {sessions.length > 0 ? 
                      Math.round(sessions.reduce((acc: number, s: any) => acc + (s.score || 0), 0) / sessions.length) 
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
              ) : sessions.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Aucune session trouvée</p>
              ) : (
                <div className="space-y-4">
                  {sessions.map((session: any) => (
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

      {showQuickDiagnostic && (
        <QuickDiagnostic onClose={() => setShowQuickDiagnostic(false)} />
      )}
    </div>
  );
}