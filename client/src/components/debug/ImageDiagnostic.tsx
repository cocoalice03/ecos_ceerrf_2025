
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface ImageDiagnosticProps {
  imageUrl: string;
  altText?: string;
  className?: string;
}

interface DiagnosticResult {
  test: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: string;
}

export default function ImageDiagnostic({ imageUrl, altText, className }: ImageDiagnosticProps) {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setIsLoading(true);
    const diagnosticResults: DiagnosticResult[] = [];

    // Test 1: URL Format Validation
    try {
      const url = new URL(imageUrl);
      diagnosticResults.push({
        test: 'Format URL',
        status: 'success',
        message: 'URL valide',
        details: `Protocol: ${url.protocol}, Host: ${url.hostname}`
      });
    } catch (error) {
      diagnosticResults.push({
        test: 'Format URL',
        status: 'error',
        message: 'URL invalide',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      });
    }

    // Test 2: Image Accessibility
    try {
      const response = await fetch(imageUrl, { method: 'HEAD' });
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.startsWith('image/')) {
          diagnosticResults.push({
            test: 'Accessibilité Image',
            status: 'success',
            message: 'Image accessible',
            details: `Type: ${contentType}, Status: ${response.status}`
          });
        } else {
          diagnosticResults.push({
            test: 'Accessibilité Image',
            status: 'warning',
            message: 'Resource accessible mais pas une image',
            details: `Content-Type: ${contentType || 'Non défini'}`
          });
        }
      } else {
        diagnosticResults.push({
          test: 'Accessibilité Image',
          status: 'error',
          message: `Erreur HTTP ${response.status}`,
          details: response.statusText
        });
      }
    } catch (error) {
      diagnosticResults.push({
        test: 'Accessibilité Image',
        status: 'error',
        message: 'Impossible d\'accéder à l\'image',
        details: error instanceof Error ? error.message : 'Erreur réseau'
      });
    }

    // Test 3: CORS Policy
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          diagnosticResults.push({
            test: 'Politique CORS',
            status: 'success',
            message: 'CORS autorisé',
            details: `Dimensions: ${img.naturalWidth}x${img.naturalHeight}`
          });
          setImagePreview(imageUrl);
          resolve(void 0);
        };
        
        img.onerror = () => {
          diagnosticResults.push({
            test: 'Politique CORS',
            status: 'error',
            message: 'Erreur CORS ou image corrompue',
            details: 'L\'image ne peut pas être chargée par le navigateur'
          });
          reject(new Error('Image load failed'));
        };
        
        img.src = imageUrl;
        
        // Timeout après 10 secondes
        setTimeout(() => {
          diagnosticResults.push({
            test: 'Politique CORS',
            status: 'warning',
            message: 'Timeout lors du chargement',
            details: 'L\'image prend trop de temps à charger'
          });
          reject(new Error('Timeout'));
        }, 10000);
      });
    } catch (error) {
      // Déjà géré dans les callbacks
    }

    // Test 4: CSS Class Analysis
    if (className) {
      const element = document.createElement('div');
      element.className = className;
      document.body.appendChild(element);
      
      const computedStyles = window.getComputedStyle(element);
      const relevantStyles = {
        display: computedStyles.display,
        visibility: computedStyles.visibility,
        opacity: computedStyles.opacity,
        width: computedStyles.width,
        height: computedStyles.height,
        overflow: computedStyles.overflow,
        borderRadius: computedStyles.borderRadius
      };
      
      document.body.removeChild(element);
      
      const hiddenStyles = Object.entries(relevantStyles).filter(([key, value]) => 
        (key === 'display' && value === 'none') ||
        (key === 'visibility' && value === 'hidden') ||
        (key === 'opacity' && value === '0')
      );
      
      if (hiddenStyles.length > 0) {
        diagnosticResults.push({
          test: 'Analyse CSS',
          status: 'warning',
          message: 'Styles CSS qui peuvent cacher l\'élément',
          details: hiddenStyles.map(([key, value]) => `${key}: ${value}`).join(', ')
        });
      } else {
        diagnosticResults.push({
          test: 'Analyse CSS',
          status: 'success',
          message: 'Styles CSS normaux',
          details: Object.entries(relevantStyles).map(([key, value]) => `${key}: ${value}`).join(', ')
        });
      }
    }

    // Test 5: Network Performance
    const startTime = performance.now();
    try {
      await fetch(imageUrl, { method: 'HEAD' });
      const loadTime = performance.now() - startTime;
      
      if (loadTime < 1000) {
        diagnosticResults.push({
          test: 'Performance Réseau',
          status: 'success',
          message: 'Temps de réponse rapide',
          details: `${loadTime.toFixed(0)}ms`
        });
      } else if (loadTime < 3000) {
        diagnosticResults.push({
          test: 'Performance Réseau',
          status: 'warning',
          message: 'Temps de réponse lent',
          details: `${loadTime.toFixed(0)}ms`
        });
      } else {
        diagnosticResults.push({
          test: 'Performance Réseau',
          status: 'error',
          message: 'Temps de réponse très lent',
          details: `${loadTime.toFixed(0)}ms`
        });
      }
    } catch (error) {
      diagnosticResults.push({
        test: 'Performance Réseau',
        status: 'error',
        message: 'Impossible de mesurer la performance',
        details: 'Erreur réseau'
      });
    }

    setResults(diagnosticResults);
    setIsLoading(false);
  };

  useEffect(() => {
    if (imageUrl) {
      runDiagnostics();
    }
  }, [imageUrl]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-800 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-800 bg-yellow-50 border-yellow-200';
      case 'error':
        return 'text-red-800 bg-red-50 border-red-200';
      default:
        return 'text-gray-800 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Diagnostic d'Image
            <Button
              onClick={runDiagnostics}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Relancer
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* URL d'image */}
            <div>
              <h4 className="font-medium mb-2">URL de l'image :</h4>
              <p className="text-sm text-gray-600 break-all bg-gray-100 p-2 rounded">
                {imageUrl}
              </p>
            </div>

            {/* Résultats des tests */}
            <div>
              <h4 className="font-medium mb-3">Résultats des Tests :</h4>
              <div className="space-y-2">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-3 ${getStatusColor(result.status)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(result.status)}
                        <span className="font-medium">{result.test}</span>
                      </div>
                      <span className="text-sm">{result.message}</span>
                    </div>
                    {result.details && (
                      <p className="text-xs mt-2 opacity-75">{result.details}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Aperçu de l'image */}
            {imagePreview && (
              <div>
                <h4 className="font-medium mb-2">Aperçu de l'image :</h4>
                <div className="border rounded-lg p-4 bg-white">
                  <img
                    src={imagePreview}
                    alt={altText || "Image de test"}
                    className="max-w-full h-auto max-h-64 object-contain mx-auto"
                    onError={() => setImagePreview(null)}
                  />
                </div>
              </div>
            )}

            {/* Test avec la classe CSS actuelle */}
            {className && (
              <div>
                <h4 className="font-medium mb-2">Test avec la classe CSS actuelle :</h4>
                <div className="border rounded-lg p-4 bg-white">
                  <img
                    src={imageUrl}
                    alt={altText || "Image avec classe CSS"}
                    className={className}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.border = '2px dashed red';
                      target.style.padding = '20px';
                      target.alt = 'Erreur de chargement';
                    }}
                  />
                </div>
              </div>
            )}

            {/* Recommandations */}
            <div>
              <h4 className="font-medium mb-2">Recommandations :</h4>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <ul className="space-y-1 text-blue-800">
                  <li>• Vérifiez que l'URL est accessible depuis votre navigateur</li>
                  <li>• Assurez-vous que l'image existe et n'est pas corrompue</li>
                  <li>• Vérifiez les politiques CORS du serveur d'images</li>
                  <li>• Contrôlez que les styles CSS ne masquent pas l'image</li>
                  <li>• Testez avec une image locale en cas de problème réseau</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
