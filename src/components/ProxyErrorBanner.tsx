import { AlertCircle, X } from "lucide-react";

interface ProxyErrorBannerProps {
  message: string | null;
  onDismiss: () => void;
}

export function ProxyErrorBanner({ message, onDismiss }: ProxyErrorBannerProps) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-red-950/90 border-b border-red-500/30 text-red-100 text-sm shrink-0">
      <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
      <p className="flex-1 min-w-0 leading-relaxed">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 rounded-lg hover:bg-white/10 text-red-200 transition-colors shrink-0"
        aria-label="Fechar aviso"
      >
        <X size={18} />
      </button>
    </div>
  );
}
