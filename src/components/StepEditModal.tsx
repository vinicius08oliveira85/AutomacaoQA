import { useEffect, useState } from "react";
import type { Step } from "../types";

interface StepEditModalProps {
  step: Step | null;
  onClose: () => void;
  onSave: (step: Step) => void;
}

export function StepEditModal({ step, onClose, onSave }: StepEditModalProps) {
  const [action, setAction] = useState<Step["action"]>("click");
  const [selector, setSelector] = useState("");
  const [value, setValue] = useState("");
  const [text, setText] = useState("");
  const [tagName, setTagName] = useState("");

  useEffect(() => {
    if (!step) return;
    setAction(step.action);
    setSelector(step.selector ?? "");
    setValue(step.value ?? "");
    setText(step.text ?? "");
    setTagName(step.tagName ?? "");
  }, [step]);

  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, onClose]);

  if (!step) return null;

  const handleSave = () => {
    onSave({
      ...step,
      action,
      selector: selector.trim() || undefined,
      value: value.trim() || undefined,
      text: text.trim() || undefined,
      tagName: tagName.trim() || undefined,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="step-edit-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#1A1A1E] shadow-2xl p-5 max-h-[90vh] overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="step-edit-title" className="text-sm font-semibold text-white/90 mb-4">
          Editar passo
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-mono uppercase text-white/40 mb-1">Ação</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as Step["action"])}
              className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-white/90 outline-none focus:border-blue-500/50"
            >
              <option value="click">click</option>
              <option value="type">type</option>
              <option value="navigate">navigate</option>
              <option value="wait">wait</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase text-white/40 mb-1">Seletor</label>
            <input
              type="text"
              value={selector}
              onChange={(e) => setSelector(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm font-mono text-white/90 outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase text-white/40 mb-1">
              Valor / URL (type ou navigate)
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-white/90 outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase text-white/40 mb-1">Texto (opcional)</label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-white/90 outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase text-white/40 mb-1">Tag (opcional)</label>
            <input
              type="text"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-white/90 outline-none focus:border-blue-500/50"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-white/60 hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
