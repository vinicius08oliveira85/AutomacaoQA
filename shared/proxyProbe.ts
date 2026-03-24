/** Probe de URL sem cheerio/axios — adequado a serverless (ex.: Vercel). */

export const PROXY_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

const TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;

/** Evita `res.body?.cancel().catch` — com body null vira `undefined.catch` e lança TypeError. */
async function cancelResponseBody(body: Response["body"]): Promise<void> {
  if (!body || typeof body.cancel !== "function") return;
  try {
    await body.cancel();
  } catch {
    /* ignore */
  }
}

async function drainResponseBody(res: Response, maxBytes: number): Promise<void> {
  const body = res.body;
  if (!body) return;
  const reader = body.getReader();
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        break;
      }
    }
  } catch {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }
}

export async function probeTargetUrl(targetUrl: string): Promise<{ ok: boolean; message?: string }> {
  let href: string;
  try {
    const u = new URL(targetUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, message: "URL inválida" };
    }
    href = u.href;
  } catch {
    return { ok: false, message: "URL inválida" };
  }

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(href, {
        method: "GET",
        headers: {
          "User-Agent": PROXY_UA,
          Accept: "*/*",
        },
        redirect: "follow",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(t);
    }

    if (res.status >= 400) {
      await cancelResponseBody(res.body);
      return { ok: false, message: `HTTP ${res.status} ao acessar a URL` };
    }

    await drainResponseBody(res, MAX_BODY_BYTES);
    return { ok: true };
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string };
    if (err.name === "AbortError" || err.name === "TimeoutError") {
      return { ok: false, message: "Tempo esgotado" };
    }
    return { ok: false, message: err.message || "Falha de rede" };
  }
}
