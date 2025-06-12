import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Secure static file serving with restrictions
  app.use(express.static(distPath, {
    dotfiles: 'deny', // Block access to dotfiles
    index: ['index.html'],
    setHeaders: (res, filePath) => {
      // Additional security headers for static files
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      // Block direct access to sensitive file types in static directory
      const ext = path.extname(filePath).toLowerCase();
      const sensitiveExtensions = ['.env', '.config', '.json', '.ts', '.js.map'];
      
      if (sensitiveExtensions.includes(ext) && !filePath.endsWith('index.html')) {
        res.status(403);
        return false;
      }
    }
  }));

  // fall through to index.html if the file doesn't exist
  app.use("*", (req, res) => {
    // Additional check for sensitive paths in catch-all
    const sensitivePaths = ['/.env', '/config.json', '/.git', '/server', '/node_modules'];
    
    if (sensitivePaths.some(pattern => req.path.startsWith(pattern))) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Access to this resource is not allowed'
      });
    }
    
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
