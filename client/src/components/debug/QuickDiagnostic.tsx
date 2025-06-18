
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, Info } from "lucide-react";

interface QuickDiagnosticProps {
  onClose?: () => void;
}

export default function QuickDiagnostic({ onClose }: QuickDiagnosticProps) {
  const [diagnostics, setDiagnostics] = React.useState<any[]>([]);

  React.useEffect(() => {
    const runDiagnostics = () => {
      const results = [];

      // Check if app is running
      results.push({
        test: "Application Status",
        status: "success",
        message: "Application is running successfully"
      });

      // Check for console errors
      const hasConsoleErrors = window.console && typeof window.console.error === 'function';
      results.push({
        test: "Console API",
        status: hasConsoleErrors ? "success" : "warning",
        message: hasConsoleErrors ? "Console API available" : "Console API issues detected"
      });

      // Check for React
      results.push({
        test: "React Framework",
        status: typeof React !== 'undefined' ? "success" : "error",
        message: typeof React !== 'undefined' ? "React loaded successfully" : "React not found"
      });

      // Check for network connectivity
      results.push({
        test: "Network Status",
        status: navigator.onLine ? "success" : "error",
        message: navigator.onLine ? "Network connection active" : "Network connection offline"
      });

      // Check for local storage
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        results.push({
          test: "Local Storage",
          status: "success",
          message: "Local storage working"
        });
      } catch (e) {
        results.push({
          test: "Local Storage",
          status: "error",
          message: "Local storage not available"
        });
      }

      // Check for fetch API
      results.push({
        test: "Fetch API",
        status: typeof fetch !== 'undefined' ? "success" : "error",
        message: typeof fetch !== 'undefined' ? "Fetch API available" : "Fetch API not supported"
      });

      setDiagnostics(results);
    };

    runDiagnostics();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Quick Diagnostic</h2>
          {onClose && (
            <Button variant="ghost" onClick={onClose}>
              ✕
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {diagnostics.map((diagnostic, index) => (
            <div
              key={index}
              className={`p-3 rounded border ${getStatusColor(diagnostic.status)}`}
            >
              <div className="flex items-center gap-2">
                {getStatusIcon(diagnostic.status)}
                <span className="font-medium">{diagnostic.test}</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">{diagnostic.message}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
          <h3 className="font-medium text-blue-900 mb-2">Debugging Tips:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Check the browser console (F12) for detailed error messages</li>
            <li>• Verify network requests in the Network tab</li>
            <li>• Check if all required environment variables are set</li>
            <li>• Ensure the backend server is running on the correct port</li>
          </ul>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          <p>Diagnostic run at: {new Date().toLocaleString()}</p>
          <p>User Agent: {navigator.userAgent}</p>
          <p>URL: {window.location.href}</p>
        </div>
      </div>
    </div>
  );
}
