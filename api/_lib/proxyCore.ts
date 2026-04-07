/**
 * HTML da página alvo com script de gravação injetado — usado pelo Express (dev) e por api/proxy na Vercel.
 * Vive sob api/_lib para ser incluído no bundle da função serverless.
 */
import axios, { isAxiosError } from "axios";
import * as cheerio from "cheerio";

/** Limite de corpo da resposta (evita OOM em serverless). */
const MAX_BODY_BYTES = 3 * 1024 * 1024;

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export class ProxyFetchError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number, options?: { cause?: unknown }) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "ProxyFetchError";
    this.statusCode = statusCode;
  }
}

function resolveFetchTimeoutMs(): number {
  if (process.env.PROXY_FETCH_TIMEOUT_MS) {
    const n = Number(process.env.PROXY_FETCH_TIMEOUT_MS);
    if (Number.isFinite(n) && n > 0) return Math.min(n, 120_000);
  }
  return process.env.VERCEL ? 9000 : 25_000;
}

function responseDataAsUtf8String(data: unknown, targetUrl: string): string {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf-8");
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf-8");
  throw new ProxyFetchError(`Resposta inesperada (não texto) de ${targetUrl}`, 502);
}

const RECORDING_SCRIPT = `
        <script>
          (function() {
            console.log('Recording script injected');
            
            function getSelector(el) {
              if (!el || el.nodeType !== 1) return '';
              
              const dataAttrs = ['data-testid', 'data-cy', 'data-qa', 'data-automation'];
              for (const attr of dataAttrs) {
                const val = el.getAttribute(attr);
                if (val) {
                  const selector = '[' + attr + '="' + CSS.escape(val) + '"]';
                  if (document.querySelectorAll(selector).length === 1) {
                    return selector;
                  }
                }
              }

              if (el.id) {
                if (document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) {
                  return 'id=' + el.id;
                }
              }
              
              if (el.name) {
                const selector = '[name="' + CSS.escape(el.name) + '"]';
                if (document.querySelectorAll(selector).length === 1) {
                  return 'name=' + el.name;
                }
              }

              if (el.tagName === 'A' && el.innerText.trim()) {
                return 'linkText=' + el.innerText.trim();
              }

              if (el === document.body) return 'body';
              
              let path = [];
              let current = el;
              while (current && current.parentElement) {
                let siblingIndex = 1;
                let sibling = current.previousElementSibling;
                while (sibling) {
                  if (sibling.tagName === current.tagName) siblingIndex++;
                  sibling = sibling.previousElementSibling;
                }
                const tagName = current.tagName.toLowerCase();
                path.unshift(tagName + ':nth-of-type(' + siblingIndex + ')');
                current = current.parentElement;
              }
              return 'css=' + path.join(' > ');
            }

            document.addEventListener('click', (e) => {
              const selector = getSelector(e.target);
              window.parent.postMessage({
                type: 'WEBFLOW_EVENT',
                command: 'click',
                target: selector,
                value: '',
                tagName: e.target.tagName
              }, '*');
            }, true);

            document.addEventListener('input', (e) => {
              const selector = getSelector(e.target);
              window.parent.postMessage({
                type: 'WEBFLOW_EVENT',
                command: 'type',
                target: selector,
                value: e.target.value,
                tagName: e.target.tagName
              }, '*');
            }, true);

            document.addEventListener('submit', (e) => {
              const selector = getSelector(e.target);
              window.parent.postMessage({
                type: 'WEBFLOW_EVENT',
                command: 'submit',
                target: selector,
                value: '',
                tagName: e.target.tagName
              }, '*');
            }, true);

            let inspectorActive = false;
            let lastEl = null;

            function resolveSelector(selector) {
              if (!selector) return null;
              try {
                if (selector.startsWith('id=')) {
                  return document.getElementById(selector.substring(3));
                } else if (selector.startsWith('name=')) {
                  return document.getElementsByName(selector.substring(5))[0];
                } else if (selector.startsWith('linkText=')) {
                  const text = selector.substring(9);
                  return Array.from(document.getElementsByTagName('a')).find(a => a.innerText.trim() === text);
                } else if (selector.startsWith('css=')) {
                  return document.querySelector(selector.substring(4));
                } else if (selector.startsWith('xpath=')) {
                  return document.evaluate(selector.substring(6), document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                } else {
                  return document.querySelector(selector);
                }
              } catch (e) {
                console.error('Error resolving selector:', e);
                return null;
              }
            }

            window.addEventListener('message', (e) => {
              if (e.data.type === 'WEBFLOW_TOGGLE_INSPECTOR') {
                inspectorActive = e.data.active;
                if (!inspectorActive && lastEl) {
                  lastEl.style.outline = lastEl.dataset.originalOutline || '';
                  lastEl = null;
                }
              } else if (e.data.type === 'WEBFLOW_FIND_ELEMENT') {
                const el = resolveSelector(e.data.target);
                if (el) {
                  const originalOutline = el.style.outline;
                  el.style.outline = '4px solid #f59e0b';
                  el.style.outlineOffset = '-4px';
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  setTimeout(() => {
                    el.style.outline = originalOutline;
                  }, 2000);
                }
              }
            });

            document.addEventListener('mouseover', (e) => {
              if (!inspectorActive) return;

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

            document.addEventListener('mouseout', (e) => {
              if (!inspectorActive) return;
              if (e.target === lastEl) {
                e.target.style.outline = e.target.dataset.originalOutline || '';
                lastEl = null;
              }
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

export async function buildProxiedHtml(targetUrl: string): Promise<string> {
  let href: URL;
  try {
    href = new URL(targetUrl);
  } catch {
    throw new ProxyFetchError("URL inválida", 400);
  }
  if (href.protocol !== "http:" && href.protocol !== "https:") {
    throw new ProxyFetchError("Apenas http e https são permitidos", 400);
  }

  const timeoutMs = resolveFetchTimeoutMs();

  let response;
  try {
    response = await axios.get<string>(href.toString(), {
      headers: {
        "User-Agent": CHROME_UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      timeout: timeoutMs,
      maxRedirects: 5,
      maxContentLength: MAX_BODY_BYTES,
      maxBodyLength: MAX_BODY_BYTES,
      responseType: "text",
      validateStatus: (s) => s >= 200 && s < 300,
    });
  } catch (e: unknown) {
    if (isAxiosError(e)) {
      if (e.code === "ECONNABORTED") {
        throw new ProxyFetchError(
          `Timeout ao buscar a página (>${timeoutMs}ms). Tente um site menor ou aumente PROXY_FETCH_TIMEOUT_MS.`,
          504,
          { cause: e },
        );
      }
      if (e.response) {
        const st = e.response.status;
        throw new ProxyFetchError(
          `O site respondeu com HTTP ${st} (bloqueio comum para datacenters / bots).`,
          502,
          { cause: e },
        );
      }
      throw new ProxyFetchError(
        `Falha de rede: ${e.message || "erro desconhecido"}`,
        502,
        { cause: e },
      );
    }
    throw e;
  }

  const rawHtml = responseDataAsUtf8String(response.data, href.toString());
  if (rawHtml.length > MAX_BODY_BYTES) {
    throw new ProxyFetchError("HTML excede o tamanho máximo permitido pelo proxy", 413);
  }

  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(rawHtml);
  } catch (e: unknown) {
    throw new ProxyFetchError("Não foi possível analisar o HTML da página", 422, {
      cause: e,
    });
  }

  if ($("head").length === 0) {
    $("html").prepend("<head></head>");
  }
  $("head").prepend(RECORDING_SCRIPT);

  $("a, img, link, script, source, video").each((_i, el) => {
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
          const absoluteUrl = new URL(val, href.href).href;
          $(el).attr(attr, absoluteUrl);
        } catch {
          /* ignore */
        }
      }
    });
  });

  return $.html();
}

export const PROXY_RESPONSE_HEADERS: Record<string, string> = {
  "Content-Security-Policy": "default-src * 'unsafe-inline' 'unsafe-eval'; frame-ancestors *",
  "X-Frame-Options": "ALLOWALL",
};
