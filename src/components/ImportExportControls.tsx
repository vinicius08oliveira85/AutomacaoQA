import { useRef } from "react";
import { Trash2, Download, Upload } from "lucide-react";

interface ImportExportControlsProps {
  onClear: () => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
  clearDisabled?: boolean;
  exportDisabled?: boolean;
}

export function ImportExportControls({
  onClear,
  onExport,
  onImportFile,
  clearDisabled,
  exportDisabled,
}: ImportExportControlsProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImportFile(f);
          e.target.value = "";
        }}
      />
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onClear}
          disabled={clearDisabled}
          className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-all text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 size={12} /> Clear
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={exportDisabled}
          className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-all text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={12} /> Export
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-all text-[10px]"
        >
          <Upload size={12} /> Import
        </button>
      </div>
    </>
  );
}
