import axios from "axios";
import * as cheerio from "cheerio";
import { PROXY_UA } from "./proxyProbe";

export { probeTargetUrl } from "./proxyProbe";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function proxyErrorHtml(message: string) {
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

const RECORDING_SCRIPT = `
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

/** Busca a página, injeta script de gravação e reescreve URLs relativas. */
export async function fetchAndInjectProxyHtml(targetUrl: string): Promise<string> {
  const response = await axios.get(targetUrl, {
    headers: {
      "User-Agent": PROXY_UA,
    },
    timeout: 10000,
    maxRedirects: 5,
    maxContentLength: 10 * 1024 * 1024,
  });

  const $ = cheerio.load(response.data);
  $("head").prepend(RECORDING_SCRIPT);

  $('a, img, link, script, source, video').each((_i, el) => {
    const attributes = ["href", "src", "srcset", "action"];
    attributes.forEach((attr) => {
      const val = $(el).attr(attr);
      if (
        val &&
        !val.startsWith("http") &&
        !val.startsWith("//") &&
        !val.startsWith("data:") &&
        !val.startsWith("#")
      ) {
        try {
          const absoluteUrl = new URL(val, targetUrl).href;
          $(el).attr(attr, absoluteUrl);
        } catch {
          /* ignore */
        }
      }
    });
  });

  return $.html();
}
