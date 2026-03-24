import { useEffect, useState } from "react";
import type { AppSettings } from "../types";

interface SettingsModalProps {
  open: boolean;
  initial: AppSettings;
  onClose: () => void;
  onSave: (s: AppSettings) => void;
}

export function SettingsModal({ open, initial, onClose, onSave }: SettingsModalProps) {
  const [draft, setDraft] = useState<AppSettings>(initial);

  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A1A1E] shadow-2xl p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="settings-title" className="text-sm font-semibold text-white/90 uppercase tracking-wider mb-4">
          Configurações
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-mono uppercase text-white/40 mb-1.5">URL padrão</label>
            <input
              type="text"
              value={draft.defaultUrl}
              onChange={(e) => setDraft((d) => ({ ...d, defaultUrl: e.target.value }))}
              className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-white/90 outline-none focus:border-blue-500/50"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={draft.startRecordingOnLoad}
              onChange={(e) =>
                setDraft((d) => ({ ...d, startRecordingOnLoad: e.target.checked }))
              }
              className="rounded border-white/20 bg-black/40 text-blue-500 focus:ring-blue-500/40"
            />
            <span className="text-sm text-white/70 group-hover:text-white/90">
              Iniciar gravação após carregar a página (botão Ir)
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={draft.confirmBeforeClear}
              onChange={(e) =>
                setDraft((d) => ({ ...d, confirmBeforeClear: e.target.checked }))
              }
              className="rounded border-white/20 bg-black/40 text-blue-500 focus:ring-blue-500/40"
            />
            <span className="text-sm text-white/70 group-hover:text-white/90">
              Confirmar antes de limpar os passos
            </span>
          </label>
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
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
