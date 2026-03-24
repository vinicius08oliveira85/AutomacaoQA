import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchAndInjectProxyHtml, proxyErrorHtml } from "../lib/proxyCore";

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") {
      res.status(405).end();
      return;
    }
    const q = req.query.url;
    const targetUrl = typeof q === "string" ? q : Array.isArray(q) ? q[0] : "";
    if (!targetUrl) {
      res
        .status(400)
        .setHeader("Content-Type", "text/html; charset=utf-8")
        .send(proxyErrorHtml("URL is required"));
      return;
    }
    try {
      const html = await fetchAndInjectProxyHtml(targetUrl);
      res.setHeader(
        "Content-Security-Policy",
        "default-src * 'unsafe-inline' 'unsafe-eval'; frame-ancestors *"
      );
      res.setHeader("X-Frame-Options", "ALLOWALL");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(html);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res
        .status(500)
        .setHeader("Content-Type", "text/html; charset=utf-8")
        .send(proxyErrorHtml("Error fetching URL: " + msg));
    }
  } catch (err) {
    console.error("[proxy]", err);
    res
      .status(500)
      .setHeader("Content-Type", "text/html; charset=utf-8")
      .send(proxyErrorHtml("Erro interno do proxy."));
  }
}
