import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildProxiedHtml, PROXY_RESPONSE_HEADERS, ProxyFetchError } from "./_lib/proxyCore";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).end("Method Not Allowed");
    return;
  }

  const raw = req.query.url;
  const targetUrl = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  if (!targetUrl) {
    res.status(400).send("URL is required");
    return;
  }

  try {
    const html = await buildProxiedHtml(targetUrl);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    for (const [k, v] of Object.entries(PROXY_RESPONSE_HEADERS)) {
      res.setHeader(k, v);
    }
    res.status(200).send(html);
  } catch (e: unknown) {
    if (e instanceof ProxyFetchError) {
      res.status(e.statusCode).send(e.message);
      return;
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/proxy]", msg, e);
    res.status(500).send("Error fetching URL: " + msg);
  }
}
