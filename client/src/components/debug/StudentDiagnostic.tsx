
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react";

interface StudentDiagnosticProps {
  email: string;
}

export default function StudentDiagnostic({ email }: StudentDiagnosticProps) {
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostic = async () => {
    setIsRunning(true);
    const results: any = {
      timestamp: new Date().toISOString(),
      email: email,
      tests: []
    };

    try {
      // Test 1: Check if email is valid
      results.tests.push({
        name: "Email Validation",
        status: email && email.includes('@') ? 'success' : 'error',
        message: email && email.includes('@') ? 'Email format is valid' : 'Invalid email format',
        data: { email, emailType: typeof email }
      });

      // Test 2: Test available scenarios endpoint directly
      try {
        console.log('Testing available scenarios endpoint...');
        const scenariosResponse = await apiRequest('GET', `/api/ecos/available-scenarios?email=${encodeURIComponent(email)}`);
        results.tests.push({
          name: "Available Scenarios API",
          status: scenariosResponse?.scenarios ? 'success' : 'warning',
          message: scenariosResponse?.scenarios ? 
            `Found ${scenariosResponse.scenarios.length} scenarios` : 
            'No scenarios returned',
          data: {
            responseKeys: Object.keys(scenariosResponse || {}),
            scenariosCount: scenariosResponse?.scenarios?.length || 0,
            scenarios: scenariosResponse?.scenarios || []
          }
        });
      } catch (error: any) {
        results.tests.push({
          name: "Available Scenarios API",
          status: 'error',
          message: `API Error: ${error.message}`,
          data: { error: error.toString() }
        });
      }

      // Test 3: Test sessions endpoint
      try {
        const sessionsResponse = await apiRequest('GET', `/api/ecos/sessions?email=${encodeURIComponent(email)}`);
        results.tests.push({
          name: "Sessions API",
          status: 'success',
          message: `Found ${sessionsResponse?.sessions?.length || 0} sessions`,
          data: {
            sessions: sessionsResponse?.sessions || [],
            responseKeys: Object.keys(sessionsResponse || {})
          }
        });
      } catch (error: any) {
        results.tests.push({
          name: "Sessions API",
          status: 'error',
          message: `API Error: ${error.message}`,
          data: { error: error.toString() }
        });
      }

      // Test 4: Test admin scenarios endpoint (should fail for students)
      try {
        const adminResponse = await apiRequest('GET', `/api/ecos/scenarios?email=${encodeURIComponent(email)}`);
        results.tests.push({
          name: "Admin Scenarios Access",
          status: 'warning',
          message: 'Student has admin access (unexpected)',
          data: { adminResponse }
        });
      } catch (error: any) {
        results.tests.push({
          name: "Admin Scenarios Access",
          status: 'success',
          message: 'Correctly blocked (student should not have admin access)',
          data: { error: error.message }
        });
      }

      // Test 5: React Query state simulation
      results.tests.push({
        name: "React Query Conditions",
        status: 'info',
        message: 'Checking React Query enabled conditions',
        data: {
          emailExists: !!email,
          emailTruthy: !!email,
          enabledCondition: !!email
        }
      });

      // Test 6: Browser/Network check
      results.tests.push({
        name: "Browser Environment",
        status: 'info',
        message: 'Browser environment check',
        data: {
          userAgent: navigator.userAgent,
          url: window.location.href,
          searchParams: window.location.search
        }
      });

    } catch (globalError: any) {
      results.globalError = globalError.toString();
    }

    setDiagnosticResults(results);
    setIsRunning(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default: return <AlertTriangle className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-50 border-green-200';
      case 'error': return 'bg-red-50 border-red-200';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6" />
            Diagnostic Mode Étudiant
          </CardTitle>
          <p className="text-gray-600">
            Cet outil diagnostique les problèmes de récupération des scénarios en mode étudiant.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Button 
                onClick={runDiagnostic} 
                disabled={isRunning}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
                {isRunning ? 'Diagnostic en cours...' : 'Lancer le Diagnostic'}
              </Button>
              <Badge variant="outline">Email: {email}</Badge>
            </div>

            {diagnosticResults && (
              <div className="space-y-4">
                <Alert>
                  <AlertDescription>
                    Diagnostic exécuté à {new Date(diagnosticResults.timestamp).toLocaleString()}
                  </AlertDescription>
                </Alert>

                {diagnosticResults.globalError && (
                  <Alert className="bg-red-50 border-red-200">
                    <XCircle className="w-4 h-4" />
                    <AlertDescription>
                      Erreur globale: {diagnosticResults.globalError}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-3">
                  {diagnosticResults.tests.map((test: any, index: number) => (
                    <Card key={index} className={`border ${getStatusColor(test.status)}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                          {getStatusIcon(test.status)}
                          <div>
                            <h4 className="font-medium">{test.name}</h4>
                            <p className="text-sm text-gray-600">{test.message}</p>
                          </div>
                        </div>
                        
                        {test.data && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                              Voir les détails
                            </summary>
                            <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
                              {JSON.stringify(test.data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Quick Analysis */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-blue-800">Analyse Rapide</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {diagnosticResults.tests.find((t: any) => t.name === "Available Scenarios API")?.status === 'success' ? (
                        <p className="text-green-700">
                          ✅ L'API des scénarios fonctionne correctement
                        </p>
                      ) : (
                        <p className="text-red-700">
                          ❌ Problème avec l'API des scénarios
                        </p>
                      )}
                      
                      {diagnosticResults.tests.find((t: any) => t.name === "Available Scenarios API")?.data?.scenariosCount > 0 ? (
                        <p className="text-green-700">
                          ✅ Des scénarios sont disponibles dans la base de données
                        </p>
                      ) : (
                        <p className="text-red-700">
                          ❌ Aucun scénario trouvé dans la réponse
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
