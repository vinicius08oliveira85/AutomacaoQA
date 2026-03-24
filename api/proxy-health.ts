import type { VercelRequest, VercelResponse } from "@vercel/node";
import { probeTargetUrl } from "../lib/proxyProbe";

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") {
      res.status(405).json({ ok: false, message: "Method not allowed" });
      return;
    }
    const q = req.query.url;
    const targetUrl = typeof q === "string" ? q : Array.isArray(q) ? q[0] : "";
    if (!targetUrl) {
      res.status(400).json({ ok: false, message: "URL is required" });
      return;
    }
    const result = await probeTargetUrl(targetUrl);
    res.status(200).json(result);
  } catch (err) {
    console.error("[proxy-health]", err);
    res.status(500).json({
      ok: false,
      message: "Erro interno ao verificar a URL. Veja os logs da função.",
    });
  }
}
