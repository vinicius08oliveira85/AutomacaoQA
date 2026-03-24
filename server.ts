import express from "express";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import { createServer } from "http";
import path from "path";
import cors from "cors";
import { chromium } from "playwright";
import { parseReplayOrigin, toReplayProxyNavigateUrl } from "./replayProxyUrl";
import {
  probeTargetUrl,
  proxyErrorHtml,
  fetchAndInjectProxyHtml,
} from "./lib/proxyCore";

/** Defina `REPLAY_USE_PROXY=0` ou `false` para `page.goto` direto na URL gravada (depuração). */
function replayUsesProxy(): boolean {
  const v = process.env.REPLAY_USE_PROXY;
  return v !== "0" && v !== "false";
}

interface ReplayStepPayload {
  id: string;
  action: string;
  selector?: string;
  value?: string;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function runPlaywrightReplay(
  steps: ReplayStepPayload[],
  io: Server,
  replayOptions: { replayOrigin: string; useProxy: boolean }
) {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    io.emit("replay_status", { message: "Iniciando navegador (Playwright)...", type: "info" });
    browser = await chromium.launch({
      headless: process.env.PLAYWRIGHT_HEADED !== "1",
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    for (const step of steps) {
      io.emit("replay_status", {
        message: `Executando: ${step.action}${step.selector ? ` → ${step.selector.slice(0, 80)}` : ""}`,
        type: "step",
        stepId: step.id,
      });

      try {
        switch (step.action) {
          case "navigate": {
            if (!step.value?.trim()) throw new Error("navigate sem URL");
            const navigateUrl = toReplayProxyNavigateUrl(
              step.value,
              replayOptions.replayOrigin,
              replayOptions.useProxy
            );
            await page.goto(navigateUrl, {
              waitUntil: "domcontentloaded",
              timeout: 45000,
            });
            break;
          }
          case "click": {
            if (!step.selector?.trim()) throw new Error("click sem seletor");
            await page.click(step.selector, { timeout: 20000 });
            break;
          }
          case "type": {
            if (!step.selector?.trim()) throw new Error("type sem seletor");
            await page.fill(step.selector, step.value ?? "", { timeout: 20000 });
            break;
          }
          case "wait": {
            const raw = step.value?.trim();
            const ms = raw ? Math.min(120_000, Math.max(0, parseInt(raw, 10) || 1000)) : 1000;
            await sleep(ms);
            break;
          }
          default:
            io.emit("replay_status", {
              message: `Passo ignorado (ação desconhecida): ${step.action}`,
              type: "info",
            });
        }
        io.emit("replay_status", {
          message: `Concluído: ${step.action}`,
          type: "step_ok",
          stepId: step.id,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        io.emit("replay_status", {
          message: `Falha no passo: ${msg}`,
          type: "step_error",
          stepId: step.id,
        });
        io.emit("replay_status", { message: "Replay interrompido por erro.", type: "error" });
        return;
      }
    }

    io.emit("replay_status", { message: "Replay concluído com sucesso.", type: "success" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    io.emit("replay_status", { message: `Erro ao executar replay: ${msg}`, type: "error" });
  } finally {
    await browser?.close();
  }
}

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

  app.get("/api/proxy-health", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ ok: false, message: "URL is required" });
    }
    const result = await probeTargetUrl(targetUrl);
    return res.json(result);
  });

  // Proxy endpoint to bypass CORS and inject recording script
  app.get("/api/proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      res.status(400).type("html").send(proxyErrorHtml("URL is required"));
      return;
    }

    try {
      const html = await fetchAndInjectProxyHtml(targetUrl);

      res.setHeader("Content-Security-Policy", "default-src * 'unsafe-inline' 'unsafe-eval'; frame-ancestors *");
      res.setHeader("X-Frame-Options", "ALLOWALL");

      res.send(html);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).type("html").send(proxyErrorHtml("Error fetching URL: " + msg));
    }
  });

  app.post("/api/replay", (req, res) => {
    const steps = req.body?.steps as ReplayStepPayload[] | undefined;
    if (!Array.isArray(steps) || steps.length === 0) {
      res.status(400).json({ ok: false, message: "Envie um array steps não vazio" });
      return;
    }
    const replayOrigin = parseReplayOrigin(req.body?.replayOrigin);
    if (!replayOrigin) {
      res.status(400).json({
        ok: false,
        message: "replayOrigin inválido ou ausente (use http(s)://host:porta, sem credenciais)",
      });
      return;
    }
    res.json({ ok: true, started: true });
    void runPlaywrightReplay(steps, io, {
      replayOrigin,
      useProxy: replayUsesProxy(),
    });
  });

  // Vite middleware for development
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
