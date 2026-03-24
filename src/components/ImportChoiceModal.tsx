import { useEffect } from "react";

interface ImportChoiceModalProps {
  open: boolean;
  count: number;
  onReplace: () => void;
  onAppend: () => void;
  onCancel: () => void;
}

export function ImportChoiceModal({
  open,
  count,
  onReplace,
  onAppend,
  onCancel,
}: ImportChoiceModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-choice-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1A1A1E] shadow-2xl p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="import-choice-title" className="text-sm font-semibold text-white/90 mb-2">
          Importar fluxo
        </h2>
        <p className="text-xs text-white/50 mb-5">
          {count} passo(s) válido(s). Deseja substituir o fluxo atual ou anexar ao final?
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onReplace}
            className="w-full py-2.5 rounded-xl text-xs font-medium bg-white/10 text-white hover:bg-white/15 transition-colors"
          >
            Substituir fluxo atual
          </button>
          <button
            type="button"
            onClick={onAppend}
            className="w-full py-2.5 rounded-xl text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            Anexar ao final
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2 rounded-xl text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
