import type { VercelRequest, VercelResponse } from "@vercel/node";
import { probeTargetUrl } from "../lib/proxyProbe";

export const config = {
  maxDuration: 30,
};

function sendJson(res: VercelResponse, status: number, body: unknown) {
  try {
    res.status(status).json(body);
  } catch {
    res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").send(JSON.stringify(body));
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") {
      sendJson(res, 405, { ok: false, message: "Method not allowed" });
      return;
    }
    const q = req.query?.url;
    const targetUrl = typeof q === "string" ? q : Array.isArray(q) ? q[0] ?? "" : "";
    if (!targetUrl) {
      sendJson(res, 400, { ok: false, message: "URL is required" });
      return;
    }
    const result = await probeTargetUrl(targetUrl);
    sendJson(res, 200, result);
  } catch (err) {
    console.error("[proxy-health]", err);
    try {
      sendJson(res, 500, {
        ok: false,
        message: "Erro interno ao verificar a URL. Veja os logs da função.",
      });
    } catch (sendErr) {
      console.error("[proxy-health] falha ao enviar 500", sendErr);
    }
  }
}
