import type { VercelRequest, VercelResponse } from "@vercel/node";

interface ReplayStep {
  id?: string;
  command?: string;
  target?: string;
  value?: string;
}

/** Mesmo formato usado pelo Socket.IO em dev — o cliente aplica em sequência quando não há socket. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).end("Method Not Allowed");
    return;
  }

  const body = req.body as { steps?: ReplayStep[] };
  const steps = Array.isArray(body?.steps) ? body.steps : [];

  const events: Array<{ message: string; type: string; stepId?: string }> = [
    { message: "Starting replay...", type: "info" },
  ];

  for (const step of steps) {
    events.push({
      message: `Executing: ${step.command ?? "?"} on ${step.target ?? "?"} with value: ${step.value ?? ""}`,
      type: "step",
      stepId: step.id,
    });
  }

  events.push({ message: "Replay completed successfully!", type: "success" });

  res.status(200).json({ success: true, events });
}
