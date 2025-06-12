import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./db";
import { insertLog } from "./storage";
import { addDiagnosticRoutes } from "./diagnostic-endpoint";
import { createDebugMiddleware, createDatabaseErrorHandler } from "./debug.middleware";
import { createTrainingSessionsTables } from "./db";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Security middleware - Block access to sensitive files and directories
app.use((req, res, next) => {
  const sensitivePaths = [
    // Environment and config files
    '/.env',
    '/config.json',
    '/package.json',
    '/package-lock.json',
    '/tsconfig.json',
    '/vite.config.ts',
    '/tailwind.config.ts',
    '/postcss.config.js',
    '/components.json',
    '/drizzle.config.ts',
    
    // Git directory and files
    '/.git',
    '/.gitignore',
    
    // Replit specific files
    '/.replit',
    '/replit.nix',
    
    // Node modules and build artifacts
    '/node_modules',
    '/dist',
    '/build',
    
    // Server source code
    '/server',
    
    // Test directories
    '/test',
    '/tests',
    
    // Admin and debug endpoints (should only be accessible via API)
    '/admin',
    '/debug',
    
    // Scripts and configuration
    '/scripts',
    
    // Shared schema
    '/shared',
    
    // Any dotfiles
    '/.*',
    
    // Backup and temp files
    '*.bak',
    '*.tmp',
    '*.log',
    '*~'
  ];

  const requestPath = req.path.toLowerCase();
  
  // Check if the request path matches any sensitive pattern
  const isSensitive = sensitivePaths.some(pattern => {
    if (pattern.includes('*')) {
      // Handle wildcard patterns
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(requestPath);
    } else {
      // Exact match or starts with pattern
      return requestPath === pattern || requestPath.startsWith(pattern + '/');
    }
  });

  if (isSensitive) {
    console.log(`🚫 Blocked access to sensitive path: ${req.path}`);
    return res.status(403).json({ 
      error: 'Forbidden',
      message: 'Access to this resource is not allowed'
    });
  }

  next();
});

// Add debug middleware
app.use(createDebugMiddleware());
app.use(createDatabaseErrorHandler());

// Security headers middleware
app.use((req, res, next) => {
  // Remove server signature
  res.removeHeader('X-Powered-By');
  
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Prevent directory traversal
  if (req.path.includes('..')) {
    console.log(`🚫 Blocked directory traversal attempt: ${req.path}`);
    return res.status(403).json({ 
      error: 'Forbidden',
      message: 'Directory traversal not allowed'
    });
  }
  
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Setup diagnostic routes first
  addDiagnosticRoutes(app);

  // Create training sessions tables if they don't exist
  try {
    await createTrainingSessionsTables();
  } catch (error) {
    console.error('Warning: Could not create training sessions tables:', error.message);
  }

  // Setup routes
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log the error with more details
    console.error(`❌ Server Error [${status}]:`, {
      message,
      stack: err.stack,
      url: _req.url,
      method: _req.method,
      timestamp: new Date().toISOString()
    });

    res.status(status).json({ message });

    // Don't throw the error in production to prevent crash
    if (process.env.NODE_ENV !== 'production') {
      throw err;
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }



  // Add diagnostic routes
  // addDiagnosticRoutes(app);

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  
  // Handle port already in use gracefully
  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${port} is already in use. Trying to kill existing processes...`);
      process.exit(1);
    } else {
      console.error('❌ Server error:', err);
      throw err;
    }
  });
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();