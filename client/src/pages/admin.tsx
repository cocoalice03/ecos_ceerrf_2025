import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Upload, Database, FileText, Search } from "lucide-react";

interface DocumentData {
  title: string;
  content: string;
  category: string;
}

interface SQLQueryResult {
  question: string;
  sql_query: string;
  results: any[];
  executed_at: string;
}

export default function AdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Document upload state
  const [documentData, setDocumentData] = useState<DocumentData>({
    title: "",
    content: "",
    category: "general"
  });

  // SQL query state
  const [nlQuestion, setNlQuestion] = useState("");
  const [sqlResult, setSqlResult] = useState<SQLQueryResult | null>(null);

  // Get all documents/sources
  const { data: sources, isLoading: sourcesLoading } = useQuery({
    queryKey: ['/api/admin/documents'],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/documents");
      return await res.json();
    }
  });

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: DocumentData) => {
      const res = await apiRequest("POST", "/api/admin/documents", data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Document ajouté",
        description: `${data.chunks_created} morceaux créés pour "${data.document_title}"`,
      });
      setDocumentData({ title: "", content: "", category: "general" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/documents'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le document",
        variant: "destructive",
      });
    }
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/documents/${encodeURIComponent(documentId)}`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Document supprimé",
        description: "Le document a été retiré de la base de connaissances",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/documents'] });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le document",
        variant: "destructive",
      });
    }
  });

  // Natural Language to SQL mutation
  const sqlMutation = useMutation({
    mutationFn: async (question: string) => {
      const res = await apiRequest("POST", "/api/admin/nl-to-sql", { question });
      return await res.json();
    },
    onSuccess: (data) => {
      setSqlResult(data);
      toast({
        title: "Requête SQL générée",
        description: "Question convertie en SQL avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de convertir la question en SQL",
        variant: "destructive",
      });
    }
  });

  const handleUploadDocument = () => {
    if (!documentData.title || !documentData.content) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir le titre et le contenu",
        variant: "destructive",
      });
      return;
    }
    uploadMutation.mutate(documentData);
  };

  const handleSQLQuery = () => {
    if (!nlQuestion.trim()) {
      toast({
        title: "Question requise",
        description: "Veuillez saisir une question",
        variant: "destructive",
      });
      return;
    }
    sqlMutation.mutate(nlQuestion);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Administration</h1>
        <p className="text-muted-foreground">
          Gérez vos documents et interrogez la base de données en langage naturel
        </p>
      </div>

      <Tabs defaultValue="documents" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Gestion des Documents
          </TabsTrigger>
          <TabsTrigger value="sql" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Requêtes SQL
          </TabsTrigger>
        </TabsList>

        {/* Documents Management Tab */}
        <TabsContent value="documents" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Upload Document Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Ajouter un Document
                </CardTitle>
                <CardDescription>
                  Enrichissez la base de connaissances avec de nouveaux documents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Titre du document</Label>
                  <Input
                    id="title"
                    value={documentData.title}
                    onChange={(e) => setDocumentData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Ex: Guide d'utilisation..."
                  />
                </div>
                
                <div>
                  <Label htmlFor="category">Catégorie</Label>
                  <Select 
                    value={documentData.category} 
                    onValueChange={(value) => setDocumentData(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">Général</SelectItem>
                      <SelectItem value="tutorial">Tutoriel</SelectItem>
                      <SelectItem value="faq">FAQ</SelectItem>
                      <SelectItem value="documentation">Documentation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="content">Contenu</Label>
                  <Textarea
                    id="content"
                    value={documentData.content}
                    onChange={(e) => setDocumentData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Collez ici le contenu de votre document..."
                    className="min-h-32"
                  />
                </div>

                <Button 
                  onClick={handleUploadDocument}
                  disabled={uploadMutation.isPending}
                  className="w-full"
                >
                  {uploadMutation.isPending ? "Traitement..." : "Ajouter à la base de connaissances"}
                </Button>
              </CardContent>
            </Card>

            {/* Documents List Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Documents Existants
                </CardTitle>
                <CardDescription>
                  {sources?.sources?.length || 0} document(s) dans la base de connaissances
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sourcesLoading ? (
                  <div className="text-center py-4">Chargement...</div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {sources?.sources?.length > 0 ? (
                      sources.sources.map((source: string, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <span className="text-sm font-medium">{source}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteMutation.mutate(source)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        Aucun document trouvé. Ajoutez votre premier document !
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* SQL Queries Tab */}
        <TabsContent value="sql" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Requête en Langage Naturel
              </CardTitle>
              <CardDescription>
                Posez vos questions sur la base de données en français, elles seront automatiquement converties en SQL
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="nlQuestion">Votre question</Label>
                <Textarea
                  id="nlQuestion"
                  value={nlQuestion}
                  onChange={(e) => setNlQuestion(e.target.value)}
                  placeholder="Ex: Combien d'utilisateurs ont posé des questions aujourd'hui ?"
                  className="min-h-20"
                />
              </div>
              
              <Button 
                onClick={handleSQLQuery}
                disabled={sqlMutation.isPending}
              >
                {sqlMutation.isPending ? "Conversion..." : "Convertir en SQL et Exécuter"}
              </Button>

              {/* SQL Results */}
              {sqlResult && (
                <div className="space-y-4 mt-6">
                  <div>
                    <Label>Question posée:</Label>
                    <div className="p-3 bg-muted rounded-lg">
                      {sqlResult.question}
                    </div>
                  </div>
                  
                  <div>
                    <Label>Requête SQL générée:</Label>
                    <div className="p-3 bg-muted rounded-lg font-mono text-sm">
                      {sqlResult.sql_query}
                    </div>
                  </div>
                  
                  <div>
                    <Label>Résultats ({sqlResult.results.length} ligne(s)):</Label>
                    <div className="p-3 bg-muted rounded-lg max-h-64 overflow-auto">
                      {sqlResult.results.length > 0 ? (
                        <pre className="text-sm">
                          {JSON.stringify(sqlResult.results, null, 2)}
                        </pre>
                      ) : (
                        <div className="text-muted-foreground">Aucun résultat</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}