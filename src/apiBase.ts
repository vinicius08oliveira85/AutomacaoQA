/** Base da API (vazio = mesma origem). Use se o front estiver em outro host que o Express. */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

/**
 * Lê a resposta de /api/proxy-health mesmo quando o servidor devolve HTML ou corpo vazio (ex.: 500 da Vercel),
 * evitando que `response.json()` quebre e dispare só "Falha de rede".
 */
export async function parseProxyHealthResponse(
  r: Response
): Promise<{ ok: boolean; message?: string }> {
  const text = await r.text();
  const trimmed = text.trim();
  try {
    if (trimmed) {
      const data = JSON.parse(trimmed) as { ok?: boolean; message?: string };
      if (typeof data.ok === "boolean") {
        return { ok: data.ok, message: data.message };
      }
    }
  } catch {
    /* não é JSON válido */
  }
  if (!r.ok) {
    const oneLine = trimmed.replace(/\s+/g, " ");
    const preview = oneLine.length > 180 ? `${oneLine.slice(0, 180)}…` : oneLine;
    return {
      ok: false,
      message: preview
        ? `HTTP ${r.status}: ${preview}`
        : `HTTP ${r.status} (resposta vazia ou não JSON — veja Runtime Logs na Vercel)`,
    };
  }
  return { ok: false, message: "Resposta inválida do servidor" };
}

/** Em produção, Socket.IO só se VITE_USE_SOCKET=true (servidor Node com socket). */
export const SOCKET_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_USE_SOCKET === "true";
