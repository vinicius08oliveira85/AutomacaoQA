import express from "express";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import { createServer } from "http";
import path from "path";
import cors from "cors";
import { buildProxiedHtml, PROXY_RESPONSE_HEADERS, ProxyFetchError } from "./lib/proxyCore";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  app.get("/api/proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).send("URL is required");
    }

    try {
      const html = await buildProxiedHtml(targetUrl);
      for (const [key, value] of Object.entries(PROXY_RESPONSE_HEADERS)) {
        res.setHeader(key, value);
      }
      res.send(html);
    } catch (error: unknown) {
      if (error instanceof ProxyFetchError) {
        res.status(error.statusCode).send(error.message);
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).send("Error fetching URL: " + message);
    }
  });

  app.post("/api/replay", async (req, res) => {
    const { steps } = req.body;
    const list = Array.isArray(steps) ? steps : [];
    io.emit("replay_status", { message: "Starting replay...", type: "info" });

    for (const step of list) {
      await new Promise((r) => setTimeout(r, 1000));
      io.emit("replay_status", {
        message: `Executing: ${step.command} on ${step.target} with value: ${step.value}`,
        type: "step",
        stepId: step.id,
      });
    }

    io.emit("replay_status", { message: "Replay completed successfully!", type: "success" });
    res.json({ success: true });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
