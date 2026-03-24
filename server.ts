import express from "express";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import { createServer } from "http";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";
import cors from "cors";
import { chromium } from "playwright";

interface ReplayStepPayload {
  id: string;
  action: string;
  selector?: string;
  value?: string;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function runPlaywrightReplay(steps: ReplayStepPayload[], io: Server) {
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
            await page.goto(step.value.trim(), {
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

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function proxyErrorHtml(message: string) {
  const safe = escapeHtml(message);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Erro do proxy</title>
  <style>
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
      background:#0F0F11; color:#e4e4e7; font-family: system-ui, sans-serif; padding:24px; }
    .box { max-width:420px; text-align:center; }
    h1 { font-size:1rem; font-weight:600; color:#fafafa; margin:0 0 12px; }
    p { font-size:0.875rem; color:#a1a1aa; line-height:1.5; margin:0 0 20px; word-break:break-word; }
    a { color:#60a5fa; text-decoration:none; font-size:0.875rem; }
    a:hover { text-decoration:underline; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Não foi possível carregar a página</h1>
    <p>${safe}</p>
    <p><a href="javascript:history.back()">Tentar voltar</a></p>
  </div>
</body>
</html>`;
}

const PROXY_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

async function probeTargetUrl(targetUrl: string): Promise<{ ok: boolean; message?: string }> {
  try {
    new URL(targetUrl);
  } catch {
    return { ok: false, message: "URL inválida" };
  }
  try {
    const response = await axios.get(targetUrl, {
      headers: { "User-Agent": PROXY_UA },
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: () => true,
      maxContentLength: 2 * 1024 * 1024,
    });
    if (response.status >= 400) {
      return { ok: false, message: `HTTP ${response.status} ao acessar a URL` };
    }
    return { ok: true };
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string; response?: { status?: number } };
    if (err.response?.status) {
      return { ok: false, message: `HTTP ${err.response.status} ao acessar a URL` };
    }
    const msg = err.code === "ECONNABORTED" ? "Tempo esgotado" : err.message || "Falha de rede";
    return { ok: false, message: msg };
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
      const response = await axios.get(targetUrl, {
        headers: {
          "User-Agent": PROXY_UA,
        },
        timeout: 10000,
        maxRedirects: 5,
        maxContentLength: 10 * 1024 * 1024,
      });

      const $ = cheerio.load(response.data);

      // Inject recording script
      const recordingScript = `
        <script>
          (function() {
            console.log('Recording script injected');
            
            function getSelector(el) {
              if (el.id) return '#' + el.id;
              if (el === document.body) return 'body';
              
              let path = [];
              while (el && el.parentElement) {
                let siblingIndex = 1;
                let sibling = el.previousElementSibling;
                while (sibling) {
                  if (sibling.tagName === el.tagName) siblingIndex++;
                  sibling = sibling.previousElementSibling;
                }
                path.unshift(el.tagName.toLowerCase() + ':nth-of-type(' + siblingIndex + ')');
                el = el.parentElement;
              }
              return path.join(' > ');
            }

            document.addEventListener('click', (e) => {
              // Prevent default navigation if recording
              // e.preventDefault(); 
              
              const selector = getSelector(e.target);
              window.parent.postMessage({
                type: 'WEBFLOW_EVENT',
                action: 'click',
                selector: selector,
                text: e.target.innerText?.substring(0, 50).trim(),
                tagName: e.target.tagName
              }, '*');
            }, true);

            document.addEventListener('input', (e) => {
              const selector = getSelector(e.target);
              window.parent.postMessage({
                type: 'WEBFLOW_EVENT',
                action: 'type',
                selector: selector,
                value: e.target.value,
                tagName: e.target.tagName
              }, '*');
            }, true);

            // Highlight on hover
            let lastEl = null;
            document.addEventListener('mouseover', (e) => {
              if (lastEl) {
                lastEl.style.outline = lastEl.dataset.originalOutline || '';
              }
              
              if (!e.target.dataset.originalOutline) {
                e.target.dataset.originalOutline = e.target.style.outline;
              }
              
              e.target.style.outline = '2px solid rgba(59, 130, 246, 0.8)';
              e.target.style.outlineOffset = '-2px';
              lastEl = e.target;
              
              const selector = getSelector(e.target);
              window.parent.postMessage({
                type: 'WEBFLOW_INSPECT',
                selector: selector,
                tagName: e.target.tagName,
                attributes: {
                  id: e.target.id,
                  class: e.target.className,
                  name: e.target.name
                }
              }, '*');
            }, true);

            // Handle link clicks to stay in proxy
            document.addEventListener('click', (e) => {
              const link = e.target.closest('a');
              if (link && link.href && !link.href.startsWith('javascript:')) {
                e.preventDefault();
                const newUrl = link.href;
                window.parent.postMessage({
                  type: 'WEBFLOW_NAVIGATE',
                  url: newUrl
                }, '*');
              }
            }, true);
          })();
        </script>
      `;

      $('head').prepend(recordingScript);

      // Fix relative links and resources
      const baseUrl = new URL(targetUrl);
      $('a, img, link, script, source, video').each((i, el) => {
        const attributes = ['href', 'src', 'srcset', 'action'];
        attributes.forEach(attr => {
          const val = $(el).attr(attr);
          if (val && !val.startsWith('http') && !val.startsWith('//') && !val.startsWith('data:') && !val.startsWith('#')) {
            try {
              const absoluteUrl = new URL(val, targetUrl).href;
              $(el).attr(attr, absoluteUrl);
            } catch (e) {}
          }
        });
      });

      // Remove security headers that might block iframe
      res.setHeader("Content-Security-Policy", "default-src * 'unsafe-inline' 'unsafe-eval'; frame-ancestors *");
      res.setHeader("X-Frame-Options", "ALLOWALL");
      
      res.send($.html());
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
    res.json({ ok: true, started: true });
    void runPlaywrightReplay(steps, io);
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
