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

// Add debug middleware
app.use(createDebugMiddleware());
app.use(createDatabaseErrorHandler());

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

  // Security middleware - Block access to sensitive files and directories
  app.use((req, res, next) => {
    // Skip security restrictions in development for Vite resources
    if (app.get("env") === "development") {
      // Liste des ressources Vite autorisées
      const viteResources = [
        '/node_modules/.vite/',
        '/__vite_ping',
        '/@react-refresh',
        '/__open-in-editor'
      ];

      // Autoriser les fichiers statiques (images, CSS, JS, etc.)
      const staticResources = [
        '/images/',
        '/css/',
        '/js/',
        '/fonts/',
        '/assets/',
        '.css',
        '.js',
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.svg',
        '.ico',
        '.woff',
        '.woff2'
      ];

      if (viteResources.some(resource => req.path.startsWith(resource)) ||
          staticResources.some(resource => req.path.startsWith(resource) || req.path.endsWith(resource))) {
        return next();
      }
    }

    // Allow legitimate application routes
    const legitimateRoutes = [
      '/api/',
      '/chat/',
      '/teacher/',
      '/student/',
      '/admin',
      '/diagnostic',
      '/favicon.ico'
    ];

    // Check if it's a legitimate route first
    const isLegitimateRoute = legitimateRoutes.some(route => req.path.startsWith(route));

    if (isLegitimateRoute) {
      return next();
    }

    const sensitivePaths = [
      // Environment and config files
      '/.env',
      '/.env.local',
      '/.env.development',
      '/.env.production',
      '/config.json',
      '/package.json',
      '/package-lock.json',
      '/yarn.lock',
      '/pnpm-lock.yaml',
      '/.replit',
      '/replit.nix',
      '/tsconfig.json',
      '/vite.config.ts',
      '/tailwind.config.ts',
      '/postcss.config.js',
      '/components.json',
      '/drizzle.config.ts',

      // Git and version control
      '/.git',
      '/.gitignore',
      '/.github',

      // Node modules and build artifacts
      '/node_modules',
      '/dist',
      '/build',

      // Server files (block direct access to server directory)
      '/server',

      // Shared schema (block direct access)
      '/shared',

      // Scripts and documentation
      '/scripts',
      '/docs',
      '/documentation',

      // Test files
      '/test',

      // Any dotfiles (except Vite development resources)
      '/.*'
    ];

    // Check if the path matches any sensitive pattern
    const isSensitive = sensitivePaths.some(pattern => {
      if (pattern.includes('*')) {
        // Handle wildcard patterns
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(req.path);
      }
      return req.path.startsWith(pattern) || req.path === pattern;
    });

    if (isSensitive) {
      console.log(`🚫 SECURITY: Blocked access to sensitive path: ${req.path} from IP: ${req.ip}`);

      // Log security incident
      console.warn(`⚠️ SECURITY ALERT: Attempt to access sensitive file ${req.path} from ${req.ip} at ${new Date().toISOString()}`);

      // Return 404 instead of 403 to not reveal file existence
      return res.status(404).json({ 
        error: "Not Found", 
        message: "The requested resource was not found on this server" 
      });
    }

    next();
  });

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
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();