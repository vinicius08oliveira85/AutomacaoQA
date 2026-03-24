/** Base da API (vazio = mesma origem). Use se o front estiver em outro host que o Express. */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

/** Em produção, Socket.IO só se VITE_USE_SOCKET=true (servidor Node com socket). */
export const SOCKET_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_USE_SOCKET === "true";
