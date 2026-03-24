import { motion, AnimatePresence } from "motion/react";
import {
  MousePointer2,
  Type,
  ChevronRight,
  CheckCircle2,
  Terminal,
  Trash2,
  Copy,
  Clock,
  AlertCircle,
} from "lucide-react";
import type { Step } from "../types";

interface StepListProps {
  steps: Step[];
  onSelectStep: (step: Step) => void;
  onDeleteStep: (id: string) => void;
  onDuplicateStep: (step: Step) => void;
}

export function StepList({
  steps,
  onSelectStep,
  onDeleteStep,
  onDuplicateStep,
}: StepListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-white/40 uppercase tracking-tight">Automation Steps</span>
        <span className="text-xs px-2 py-0.5 bg-white/5 rounded-full text-white/60">{steps.length}</span>
      </div>

      <AnimatePresence initial={false}>
        {steps.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-xl text-white/20">
            <Terminal size={24} className="mb-2" />
            <p className="text-xs">No steps recorded yet</p>
          </div>
        ) : (
          steps.map((step, index) => (
            <motion.div
              key={step.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`group relative rounded-xl border cursor-pointer ${
                step.status === "executing"
                  ? "border-blue-500/50 bg-blue-500/5"
                  : step.status === "success"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : step.status === "error"
                      ? "border-red-500/40 bg-red-500/5"
                      : "border-white/5 bg-white/[0.02]"
              } transition-all hover:border-white/15`}
              onClick={() => onSelectStep(step)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectStep(step);
                }
              }}
            >
              <div className="p-3 pr-20">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {step.action === "click" && <MousePointer2 size={14} className="text-blue-400" />}
                    {step.action === "type" && <Type size={14} className="text-purple-400" />}
                    {step.action === "navigate" && <ChevronRight size={14} className="text-emerald-400" />}
                    {step.action === "wait" && <Clock size={14} className="text-amber-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
                        Step {index + 1}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        {step.status === "success" && <CheckCircle2 size={12} className="text-emerald-500" />}
                        {step.status === "error" && <AlertCircle size={12} className="text-red-400" />}
                        {step.status === "executing" && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                        )}
                      </div>
                    </div>
                    <p className="text-xs font-medium truncate mt-0.5">
                      {step.action === "navigate"
                        ? `Go to ${step.value}`
                        : step.action === "click"
                          ? `Click ${step.tagName || "element"}`
                          : step.action === "wait"
                            ? `Wait${step.value ? ` (${step.value})` : ""}`
                            : `Type "${step.value ?? ""}"`}
                    </p>
                    {step.selector && (
                      <p className="text-[10px] font-mono text-white/30 truncate mt-1 bg-black/20 p-1 rounded">
                        {step.selector}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicateStep(step);
                  }}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80"
                  title="Duplicar"
                >
                  <Copy size={12} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteStep(step.id);
                  }}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400"
                  title="Remover"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </div>
  );
}
