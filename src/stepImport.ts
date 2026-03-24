import type { Step } from "./types";

const ACTIONS = ["click", "type", "navigate", "wait"] as const;

export function newStepId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export function parseStepsJson(raw: unknown): Step[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Step[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const o = item as Record<string, unknown>;
    const action = o.action;
    if (typeof action !== "string" || !ACTIONS.includes(action as (typeof ACTIONS)[number])) {
      return null;
    }
    const id =
      typeof o.id === "string" && o.id.length > 0 ? o.id : newStepId();
    const status = o.status;
    const validStatus =
      status === "pending" ||
      status === "executing" ||
      status === "success" ||
      status === "error"
        ? status
        : undefined;
    out.push({
      id,
      action: action as Step["action"],
      selector: typeof o.selector === "string" ? o.selector : undefined,
      value: typeof o.value === "string" ? o.value : undefined,
      text: typeof o.text === "string" ? o.text : undefined,
      tagName: typeof o.tagName === "string" ? o.tagName : undefined,
      status: validStatus,
    });
  }
  return out;
}
