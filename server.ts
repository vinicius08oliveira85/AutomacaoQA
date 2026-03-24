import express from "express";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import { createServer } from "http";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";
import cors from "cors";

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

  // Proxy endpoint to bypass CORS and inject recording script
  app.get("/api/proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).send("URL is required");
    }

    try {
      const response = await axios.get(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
        timeout: 10000,
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
    } catch (error: any) {
      res.status(500).send("Error fetching URL: " + error.message);
    }
  });

  // Replay endpoint (Mock for now, as Playwright might need setup)
  app.post("/api/replay", async (req, res) => {
    const { steps } = req.body;
    io.emit("replay_status", { message: "Starting replay...", type: "info" });
    
    // Simulate replay
    for (const step of steps) {
      await new Promise(r => setTimeout(r, 1000));
      io.emit("replay_status", { 
        message: `Executing: ${step.action} on ${step.selector}`, 
        type: "step",
        stepId: step.id 
      });
    }

    io.emit("replay_status", { message: "Replay completed successfully!", type: "success" });
    res.json({ success: true });
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
