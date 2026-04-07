/**
 * HTML da página alvo com script de gravação injetado — usado pelo Express (dev) e pelas funções Vercel.
 */
import axios from "axios";
import * as cheerio from "cheerio";

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
  const response = await axios.get(targetUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    },
    timeout: 10000,
  });

  const $ = cheerio.load(response.data);
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

export const PROXY_RESPONSE_HEADERS: Record<string, string> = {
  "Content-Security-Policy": "default-src * 'unsafe-inline' 'unsafe-eval'; frame-ancestors *",
  "X-Frame-Options": "ALLOWALL",
};
