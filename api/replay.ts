import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, message: "Method not allowed" });
    return;
  }
  res.status(501).json({
    ok: false,
    message:
      "Replay com Playwright e logs em tempo real exige o servidor Node (npm run dev). Na Vercel use o app para gravar/exportar fluxos ou hospede o backend em Railway, Render, Fly.io, etc.",
  });
}
