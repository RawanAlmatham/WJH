import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { refreshDueResearchFeeds } from "../db";
import { createOAuthRouter } from "../mcp/oauthRoutes";
import {
  authenticateMcpRequest,
  handleMcpRequest,
  showMcpBrowserInfo,
} from "../mcp/server";

const RESEARCH_FEED_JOB_INTERVAL_MS = 30 * 60 * 1000;

function startResearchFeedJob() {
  const run = () =>
    void refreshDueResearchFeeds().catch(error =>
      console.warn("[Research feeds] Scheduled refresh failed:", error)
    );
  setTimeout(run, 10_000).unref();
  setInterval(run, RESEARCH_FEED_JOB_INTERVAL_MS).unref();
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  app.disable("x-powered-by");
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth discovery/authorization and the authenticated remote MCP endpoint.
  app.use(createOAuthRouter());
  app.all(
    "/mcp",
    showMcpBrowserInfo,
    authenticateMcpRequest,
    (request, response, next) => {
      void handleMcpRequest(request, response).catch(next);
    }
  );
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    startResearchFeedJob();
  });
}

startServer().catch(console.error);
