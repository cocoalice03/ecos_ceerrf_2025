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
import { Badge } from "@/components/ui/badge";
import { Trash2, Upload, Database, FileText, Search, Plus, Server, RefreshCw } from "lucide-react";

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

interface IndexData {
  name: string;
  dimension: number;
}

interface PDFUploadData {
  title: string;
  category: string;
  file: File | null;
}

export default function AdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get admin email from URL parameters
  const params = new URLSearchParams(window.location.search);
  const adminEmail = params.get('email') || '';
  
  // Admin authorization check
  const ADMIN_EMAILS = ['cherubindavid@gmail.com', 'colombemadoungou@gmail.com'];
  const isAuthorized = ADMIN_EMAILS.includes(adminEmail.toLowerCase());
  
  // Document upload state
  const [documentData, setDocumentData] = useState<DocumentData>({
    title: "",
    content: "",
    category: "general"
  });

  // SQL query state
  const [nlQuestion, setNlQuestion] = useState("");
  const [sqlResult, setSqlResult] = useState<SQLQueryResult | null>(null);

  // Index management state
  const [indexData, setIndexData] = useState<IndexData>({
    name: "",
    dimension: 1536
  });

  // PDF upload state
  const [pdfUploadData, setPdfUploadData] = useState<PDFUploadData>({
    title: "",
    category: "general",
    file: null
  });

  // Current selected index
  const [selectedIndex, setSelectedIndex] = useState<string>("");

  // Get all documents/sources
  const { data: sources, isLoading: sourcesLoading } = useQuery({
    queryKey: ['/api/admin/documents', adminEmail],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/documents?email=${encodeURIComponent(adminEmail)}`);
      return await res.json();
    },
    enabled: isAuthorized
  });

  // Get all Pinecone indexes
  const { data: indexes, isLoading: indexesLoading, refetch: refetchIndexes } = useQuery({
    queryKey: ['/api/admin/indexes', adminEmail],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/indexes?email=${encodeURIComponent(adminEmail)}`);
      return await res.json();
    },
    enabled: isAuthorized
  });

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: DocumentData) => {
      const res = await apiRequest("POST", "/api/admin/documents", { ...data, email: adminEmail });
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
      const res = await apiRequest("DELETE", `/api/admin/documents/${encodeURIComponent(documentId)}?email=${encodeURIComponent(adminEmail)}`);
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
      const res = await apiRequest("POST", "/api/admin/nl-to-sql", { question, email: adminEmail });
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

  // Create Pinecone index mutation
  const createIndexMutation = useMutation({
    mutationFn: async (data: IndexData) => {
      const res = await apiRequest("POST", "/api/admin/indexes", { ...data, email: adminEmail });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Index créé",
        description: data.message,
      });
      setIndexData({ name: "", dimension: 1536 });
      refetchIndexes();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: "Impossible de créer l'index",
        variant: "destructive",
      });
    }
  });

  // Switch Pinecone index mutation
  const switchIndexMutation = useMutation({
    mutationFn: async (indexName: string) => {
      const res = await apiRequest("POST", "/api/admin/indexes/switch", { indexName, email: adminEmail });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Index changé",
        description: data.message,
      });
      setSelectedIndex("");
      queryClient.invalidateQueries({ queryKey: ['/api/admin/documents'] });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de changer d'index",
        variant: "destructive",
      });
    }
  });

  // Upload PDF mutation
  const uploadPDFMutation = useMutation({
    mutationFn: async (data: PDFUploadData) => {
      const formData = new FormData();
      formData.append("email", adminEmail);
      formData.append("title", data.title);
      formData.append("category", data.category);
      if (data.file) {
        formData.append("pdf", data.file);
      }
      
      const res = await fetch("/api/admin/upload-pdf", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        throw new Error("Upload failed");
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "PDF traité",
        description: `${data.message} (${data.pages} pages, ${data.textLength} caractères)`,
      });
      setPdfUploadData({ title: "", category: "general", file: null });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/documents'] });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de traiter le PDF",
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

  const handleCreateIndex = () => {
    if (!indexData.name.trim()) {
      toast({
        title: "Nom requis",
        description: "Veuillez saisir un nom pour l'index",
        variant: "destructive",
      });
      return;
    }
    createIndexMutation.mutate(indexData);
  };

  const handleSwitchIndex = () => {
    if (!selectedIndex.trim()) {
      toast({
        title: "Index requis",
        description: "Veuillez sélectionner un index",
        variant: "destructive",
      });
      return;
    }
    switchIndexMutation.mutate(selectedIndex);
  };

  const handlePDFUpload = () => {
    if (!pdfUploadData.title.trim() || !pdfUploadData.file) {
      toast({
        title: "Champs requis",
        description: "Veuillez fournir un titre et sélectionner un fichier PDF",
        variant: "destructive",
      });
      return;
    }
    uploadPDFMutation.mutate(pdfUploadData);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfUploadData(prev => ({ ...prev, file }));
    } else {
      toast({
        title: "Type de fichier invalide",
        description: "Veuillez sélectionner un fichier PDF",
        variant: "destructive",
      });
    }
  };

  // Check authorization
  if (!isAuthorized) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h1 className="text-2xl font-bold text-red-700 mb-2">Accès Non Autorisé</h1>
          <p className="text-red-600 mb-4">
            Vous n'avez pas l'autorisation d'accéder à cette page d'administration.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Administration</h1>
            <p className="text-muted-foreground">
              Gérez vos documents et interrogez la base de données en langage naturel
            </p>
          </div>
          <Button 
            onClick={() => window.location.href = `/?email=${encodeURIComponent(adminEmail)}`}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Search className="h-4 w-4" />
            Accéder au Chatbot
          </Button>
        </div>
      </div>

      <Tabs defaultValue="documents" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="indexes" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Index Pinecone
          </TabsTrigger>
          <TabsTrigger value="pdf" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload PDF
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

        {/* Index Management Tab */}
        <TabsContent value="indexes" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Create Index Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Créer un Index Pinecone
                </CardTitle>
                <CardDescription>
                  Créez un nouvel index pour organiser vos documents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="indexName">Nom de l'index</Label>
                  <Input
                    id="indexName"
                    placeholder="ex: cours-mathematiques"
                    value={indexData.name}
                    onChange={(e) => setIndexData(prev => ({ ...prev, name: e.target.value }))}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Lettres minuscules, chiffres et tirets uniquement
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="dimension">Dimension (par défaut: 1536)</Label>
                  <Input
                    id="dimension"
                    type="number"
                    value={indexData.dimension}
                    onChange={(e) => setIndexData(prev => ({ ...prev, dimension: parseInt(e.target.value) || 1536 }))}
                  />
                </div>
                
                <Button 
                  onClick={handleCreateIndex}
                  disabled={createIndexMutation.isPending}
                  className="w-full"
                >
                  {createIndexMutation.isPending ? "Création..." : "Créer l'Index"}
                </Button>
              </CardContent>
            </Card>

            {/* Switch Index Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Changer d'Index
                </CardTitle>
                <CardDescription>
                  Basculez vers un index existant
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Index disponibles</Label>
                  {indexesLoading ? (
                    <div className="text-sm text-muted-foreground">Chargement...</div>
                  ) : (
                    <Select value={selectedIndex} onValueChange={setSelectedIndex}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un index" />
                      </SelectTrigger>
                      <SelectContent>
                        {indexes?.indexes?.map((index: string) => (
                          <SelectItem key={index} value={index}>
                            {index}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                
                <Button 
                  onClick={handleSwitchIndex}
                  disabled={switchIndexMutation.isPending || !selectedIndex}
                  className="w-full"
                >
                  {switchIndexMutation.isPending ? "Changement..." : "Changer d'Index"}
                </Button>

                {/* Current indexes list */}
                <div className="space-y-2">
                  <Label>Index disponibles :</Label>
                  <div className="flex flex-wrap gap-2">
                    {indexes?.indexes?.map((index: string) => (
                      <Badge key={index} variant="secondary">
                        {index}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* PDF Upload Tab */}
        <TabsContent value="pdf" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload et Traitement de PDF
              </CardTitle>
              <CardDescription>
                Uploadez un fichier PDF et ajoutez-le automatiquement à votre base de connaissances
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="pdfTitle">Titre du document</Label>
                  <Input
                    id="pdfTitle"
                    placeholder="ex: Cours de Mathématiques - Chapitre 1"
                    value={pdfUploadData.title}
                    onChange={(e) => setPdfUploadData(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="pdfCategory">Catégorie</Label>
                  <Select 
                    value={pdfUploadData.category} 
                    onValueChange={(value) => setPdfUploadData(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mathematiques">Mathématiques</SelectItem>
                      <SelectItem value="physique">Physique</SelectItem>
                      <SelectItem value="chimie">Chimie</SelectItem>
                      <SelectItem value="informatique">Informatique</SelectItem>
                      <SelectItem value="langues">Langues</SelectItem>
                      <SelectItem value="histoire">Histoire</SelectItem>
                      <SelectItem value="geographie">Géographie</SelectItem>
                      <SelectItem value="general">Général</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="pdfFile">Fichier PDF</Label>
                <Input
                  id="pdfFile"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
                {pdfUploadData.file && (
                  <p className="text-sm text-green-600 mt-1">
                    Fichier sélectionné : {pdfUploadData.file.name}
                  </p>
                )}
              </div>
              
              <Button 
                onClick={handlePDFUpload}
                disabled={uploadPDFMutation.isPending || !pdfUploadData.file || !pdfUploadData.title}
                className="w-full"
              >
                {uploadPDFMutation.isPending ? "Traitement en cours..." : "Uploader et Traiter le PDF"}
              </Button>

              <div className="text-sm text-muted-foreground">
                <p>• Le PDF sera automatiquement divisé en sections pour une recherche optimale</p>
                <p>• Seuls les fichiers PDF avec du texte extractible sont supportés</p>
                <p>• Taille maximale : 50MB</p>
              </div>
            </CardContent>
          </Card>
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