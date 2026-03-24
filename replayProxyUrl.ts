/**
 * Valida a origem enviada pelo cliente para montar URLs do proxy no replay Playwright.
 * Retorna `origin` normalizado (ex.: http://localhost:3000) ou null.
 */
export function parseReplayOrigin(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username !== "" || u.password !== "") return null;
  return u.origin;
}

const PROXY_PATH = "/api/proxy";

function isAlreadyProxyUrl(u: URL, replayOrigin: string): boolean {
  if (u.origin !== replayOrigin) return false;
  const path = u.pathname.replace(/\/$/, "") || "/";
  if (path !== PROXY_PATH) return false;
  return u.searchParams.has("url");
}

/**
 * Se `useProxy` e a URL for http(s) absoluta (ou relativa à origem) e ainda não for o proxy deste app,
 * retorna `{replayOrigin}/api/proxy?url=...`. Caso contrário retorna a URL original (trimada).
 */
export function toReplayProxyNavigateUrl(
  targetUrl: string,
  replayOrigin: string,
  useProxy: boolean
): string {
  const trimmed = targetUrl.trim();
  if (!useProxy) return trimmed;

  let u: URL;
  try {
    u = new URL(trimmed, replayOrigin);
  } catch {
    return trimmed;
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return trimmed;
  }

  if (isAlreadyProxyUrl(u, replayOrigin)) {
    return u.href;
  }

  return `${replayOrigin}${PROXY_PATH}?url=${encodeURIComponent(u.href)}`;
}
