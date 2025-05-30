
import { Request, Response } from "express";

export function addDiagnosticRoutes(app: any) {
  app.get("/api/diagnostic/health", async (req: Request, res: Response) => {
    try {
      const health = {
        timestamp: new Date().toISOString(),
        status: "healthy",
        checks: {
          memory: process.memoryUsage(),
          uptime: process.uptime(),
          platform: process.platform,
          nodeVersion: process.version,
          env: {
            NODE_ENV: process.env.NODE_ENV,
            hasOpenAI: !!process.env.OPENAI_API_KEY,
            hasPinecone: !!process.env.PINECONE_API_KEY
          }
        }
      };
      
      res.json(health);
    } catch (error) {
      res.status(500).json({
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/diagnostic/routes", async (req: Request, res: Response) => {
    try {
      // Get all registered routes
      const routes: any[] = [];
      
      app._router.stack.forEach((middleware: any) => {
        if (middleware.route) {
          routes.push({
            path: middleware.route.path,
            methods: Object.keys(middleware.route.methods)
          });
        } else if (middleware.name === 'router') {
          middleware.handle.stack.forEach((handler: any) => {
            if (handler.route) {
              routes.push({
                path: handler.route.path,
                methods: Object.keys(handler.route.methods)
              });
            }
          });
        }
      });

      res.json({ routes });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}
