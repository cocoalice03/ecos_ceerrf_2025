import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./db";
import { addDiagnosticRoutes } from "./diagnostic-endpoint";
import { createDebugMiddleware, createDatabaseErrorHandler } from "./debug.middleware";
import { createTrainingSessionsTables } from "./db";
import { Server } from "http";

// Environment variable validation
function validateEnvironment() {
  console.log('🔍 Validating environment variables...');
  
  const requiredEnvVars = [
    'DATABASE_URL',
    'OPENAI_API_KEY',
    'PINECONE_API_KEY'
  ];

  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.warn(`⚠️ Missing environment variables: ${missing.join(', ')}`);
    console.warn('Application may not function correctly without these variables');
  } else {
    console.log('✅ All required environment variables are present');
  }

  // Log environment info
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Port: ${process.env.PORT || 5000}`);
  console.log(`💾 Database configured: ${!!process.env.DATABASE_URL}`);
}

// Graceful shutdown handler
let httpServer: Server | null = null;

function setupGracefulShutdown() {
  const gracefulShutdown = (signal: string) => {
    console.log(`📡 Received ${signal}. Starting graceful shutdown...`);
    
    if (httpServer) {
      httpServer.close((err) => {
        if (err) {
          console.error('❌ Error during server shutdown:', err instanceof Error ? err.message : String(err));
          process.exit(1);
        }
        console.log('✅ Server shut down gracefully');
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        console.error('⏰ Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    } else {
      process.exit(0);
    }
  };

  // Handle various shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Nodemon restart
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add debug middleware
app.use(createDebugMiddleware());
app.use(createDatabaseErrorHandler());

// Startup health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    // Test database connection
    await db.execute('SELECT 1 as test');
    
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 5000,
      database: 'connected',
      services: {
        openai: !!process.env.OPENAI_API_KEY,
        pinecone: !!process.env.PINECONE_API_KEY
      }
    };
    
    res.status(200).json(healthStatus);
  } catch (error) {
    const errorStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      database: 'disconnected'
    };
    
    console.error('❌ Health check failed:', error);
    res.status(503).json(errorStatus);
  }
});

// Readiness probe endpoint
app.get('/ready', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString()
  });
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
  console.log('🚀 Starting LearnWorlds RAG Application...');
  
  // Step 1: Validate environment
  validateEnvironment();
  
  // Step 2: Setup graceful shutdown handlers
  setupGracefulShutdown();
  
  // Step 3: Setup diagnostic routes first
  console.log('📊 Setting up diagnostic routes...');
  addDiagnosticRoutes(app);

  // Step 4: Create training sessions tables if they don't exist
  console.log('🗄️ Initializing database tables...');
  try {
    await createTrainingSessionsTables();
    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('Warning: Could not create training sessions tables:', error instanceof Error ? error.message : String(error));
  }

  // Step 5: Setup routes
  console.log('🛣️ Setting up application routes...');
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
        '/__open-in-editor',
        '/@vite/client',
        '/src/',
        '/@fs/',
        '/@vite/'
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

  // Step 6: Setup Vite or static serving
  console.log('⚙️ Setting up frontend serving...');
  if (app.get("env") === "development") {
    await setupVite(app, server);
    console.log('✅ Vite development server configured');
  } else {
    serveStatic(app);
    console.log('✅ Static file serving configured');
  }

  // Step 7: Start the server
  console.log('🌐 Starting HTTP server...');
  
  // Determine port and host for Cloud Run compatibility
  // Always use port 5000 for Replit deployment compatibility
  const isProduction = process.env.NODE_ENV === 'production';
  const port = 5000; // Fixed port for Replit deployment
  const host = '0.0.0.0';
  
  console.log(`🎯 Target port: ${port} (production: ${isProduction})`);
  console.log(`🎯 Target host: ${host}`);
  
  // Store server reference for graceful shutdown
  httpServer = server;
  
  // Enhanced server startup with production/development port handling
  const startServer = async (targetPort: number): Promise<void> => {
    // In production, strictly use the specified port (no fallback)
    if (isProduction) {
      return new Promise<void>((resolve, reject) => {
        const serverInstance = server.listen({
          port: targetPort,
          host,
        }, (err?: Error) => {
          if (err) {
            console.error('❌ Production server failed to start:', err.message);
            reject(err);
            return;
          }
          
          console.log('✅ Production server started successfully');
          console.log(`🌐 Listening on http://${host}:${targetPort}`);
          console.log(`🏥 Health check: http://${host}:${targetPort}/health`);
          console.log(`🚀 Ready check: http://${host}:${targetPort}/ready`);
          console.log(`📊 Environment: ${process.env.NODE_ENV}`);
          console.log(`⏰ Started at: ${new Date().toISOString()}`);
          
          resolve();
        });

        serverInstance.on('error', (error: Error) => {
          console.error('❌ Production server error:', error.message);
          reject(error);
        });

        // Shorter timeout for production
        setTimeout(() => {
          reject(new Error('Production server startup timeout'));
        }, 5000);
      });
    }
    
    // Development mode: Allow port fallback
    const maxAttempts = 5;
    let attemptPort = targetPort;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await new Promise<void>((resolve, reject) => {
          const serverInstance = server.listen({
            port: attemptPort,
            host,
          }, (err?: Error) => {
            if (err) {
              reject(err);
              return;
            }
            
            console.log('✅ Development server started successfully');
            console.log(`🌐 Listening on http://${host}:${attemptPort}`);
            console.log(`🏥 Health check: http://${host}:${attemptPort}/health`);
            console.log(`🚀 Ready check: http://${host}:${attemptPort}/ready`);
            console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`⏰ Started at: ${new Date().toISOString()}`);
            
            resolve();
          });

          serverInstance.on('error', (error: Error) => {
            reject(error);
          });

          // Timeout for development
          setTimeout(() => {
            reject(new Error('Development server startup timeout'));
          }, 10000);
        });
        
        return; // Success
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (errorMessage.includes('EADDRINUSE') && attempt < maxAttempts) {
          console.warn(`⚠️ Port ${attemptPort} in use, trying port ${attemptPort + 1} (attempt ${attempt}/${maxAttempts})`);
          attemptPort++;
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        console.error(`❌ Failed to start development server after ${attempt} attempts:`, errorMessage);
        throw error;
      }
    }
    
    throw new Error(`Failed to start server after ${maxAttempts} attempts`);
  };

  try {
    await startServer(port);
    
    // Perform initial health check
    setTimeout(async () => {
      try {
        console.log('🔍 Performing initial health check...');
        await db.execute('SELECT 1 as test');
        console.log('✅ Initial health check passed');
      } catch (error) {
        console.warn('⚠️ Initial health check failed:', error instanceof Error ? error.message : String(error));
      }
    }, 1000);
    
  } catch (error) {
    console.error('💥 Failed to start server:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
})().catch((error) => {
  console.error('💥 Application startup failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});