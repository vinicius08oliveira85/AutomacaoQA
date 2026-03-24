import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Square,
  Settings,
  ChevronRight,
  Terminal,
  Search,
  CheckCircle2,
  AlertCircle,
  Info,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { io, type Socket } from "socket.io-client";
import { apiUrl, SOCKET_ENABLED, parseProxyHealthResponse } from "./apiBase";
import type { Step, InspectorData, AppSettings } from "./types";
import { loadSettings, saveSettings } from "./settingsStorage";
import { parseStepsJson, newStepId } from "./stepImport";
import { ProxyErrorBanner } from "./components/ProxyErrorBanner";
import { SettingsModal } from "./components/SettingsModal";
import { StepEditModal } from "./components/StepEditModal";
import { ImportChoiceModal } from "./components/ImportChoiceModal";
import { ImportExportControls } from "./components/ImportExportControls";
import { StepList } from "./components/StepList";

const socketUrl = import.meta.env.VITE_SOCKET_URL as string | undefined;
const socket: Socket | null = SOCKET_ENABLED
  ? socketUrl
    ? io(socketUrl)
    : io()
  : null;

export default function App() {
  const [appSettings, setAppSettings] = useState<AppSettings>(() => loadSettings());
  const [url, setUrl] = useState(() => loadSettings().defaultUrl);
  const [currentUrl, setCurrentUrl] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [inspector, setInspector] = useState<InspectorData | null>(null);
  const [logs, setLogs] = useState<{ message: string; type: string }[]>([]);
  const [proxyError, setProxyError] = useState<string | null>(null);
  const [navChecking, setNavChecking] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [pendingImport, setPendingImport] = useState<Step[] | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isRecordingRef = useRef(isRecording);
  isRecordingRef.current = isRecording;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const navigateWithHealth = useCallback(
    async (
      targetUrl: string,
      options?: { replaceStepsWithInitialNav?: boolean; appendNavigateStep?: boolean }
    ): Promise<boolean> => {
      setProxyError(null);
      setNavChecking(true);
      try {
        const r = await fetch(
          apiUrl(`/api/proxy-health?url=${encodeURIComponent(targetUrl)}`)
        );
        const data = await parseProxyHealthResponse(r);
        if (!data.ok) {
          setProxyError(data.message || "Não foi possível verificar a URL");
          return false;
        }
        setUrl(targetUrl);
        setCurrentUrl(apiUrl(`/api/proxy?url=${encodeURIComponent(targetUrl)}`));
        if (options?.replaceStepsWithInitialNav) {
          setSteps([
            {
              id: "initial-nav",
              action: "navigate",
              value: targetUrl,
              status: "success",
            },
          ]);
        }
        if (options?.appendNavigateStep) {
          setSteps((prev) => [
            ...prev,
            {
              id: newStepId(),
              action: "navigate",
              value: targetUrl,
              status: "success",
            },
          ]);
        }
        return true;
      } catch {
        setProxyError("Falha de rede ao verificar a URL");
        return false;
      } finally {
        setNavChecking(false);
      }
    },
    []
  );

  const navigateWithHealthRef = useRef(navigateWithHealth);
  navigateWithHealthRef.current = navigateWithHealth;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "WEBFLOW_EVENT" && isRecordingRef.current) {
        const newStep: Step = {
          id: newStepId(),
          action: event.data.action,
          selector: event.data.selector,
          value: event.data.value,
          text: event.data.text,
          tagName: event.data.tagName,
          status: "pending",
        };
        setSteps((prev) => [...prev, newStep]);
      } else if (event.data.type === "WEBFLOW_INSPECT") {
        setInspector({
          selector: event.data.selector,
          tagName: event.data.tagName,
          attributes: event.data.attributes,
        });
      } else if (event.data.type === "WEBFLOW_NAVIGATE") {
        const newUrl = event.data.url as string;
        void navigateWithHealthRef.current(newUrl, {
          appendNavigateStep: isRecordingRef.current,
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onReplayStatus = (data: {
      message?: string;
      type: string;
      stepId?: string;
    }) => {
      if (data.message) {
        setLogs((prev) => [...prev, { message: data.message, type: data.type }]);
      }
      if (data.stepId && data.type === "step") {
        setSteps((prev) =>
          prev.map((s) => (s.id === data.stepId ? { ...s, status: "executing" } : s))
        );
      }
      if (data.stepId && data.type === "step_ok") {
        setSteps((prev) =>
          prev.map((s) => (s.id === data.stepId ? { ...s, status: "success" } : s))
        );
      }
      if (data.stepId && data.type === "step_error") {
        setSteps((prev) =>
          prev.map((s) => (s.id === data.stepId ? { ...s, status: "error" } : s))
        );
      }
      if (data.type === "success" || data.type === "error") {
        setIsReplaying(false);
      }
    };

    socket.on("replay_status", onReplayStatus);
    return () => {
      socket.off("replay_status", onReplayStatus);
    };
  }, []);

  const handleNavigate = async () => {
    const ok = await navigateWithHealth(url, { replaceStepsWithInitialNav: true });
    if (ok && appSettings.startRecordingOnLoad) {
      setIsRecording(true);
      setLogs((prev) => [...prev, { message: "Recording started", type: "info" }]);
    }
  };

  const startRecording = () => {
    setIsRecording(true);
    setLogs((prev) => [...prev, { message: "Recording started", type: "info" }]);
  };

  const stopRecording = () => {
    setIsRecording(false);
    setLogs((prev) => [...prev, { message: "Recording stopped", type: "info" }]);
  };

  const runReplay = async () => {
    if (!socket) {
      setLogs([
        {
          message:
            "Replay com Playwright não está disponível aqui (sem Socket.IO). Use npm run dev localmente ou hospede o backend completo. Na Vercel você pode gravar e exportar o JSON.",
          type: "info",
        },
      ]);
      return;
    }

    setIsReplaying(true);
    setLogs([]);
    setSteps((prev) => prev.map((s) => ({ ...s, status: "pending" })));

    try {
      const res = await fetch(apiUrl("/api/replay"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steps: stepsRef.current,
          replayOrigin: window.location.origin,
        }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as { message?: string } | null;
        setLogs((prev) => [
          ...prev,
          {
            message: errBody?.message || `Falha ao iniciar replay (HTTP ${res.status})`,
            type: "error",
          },
        ]);
        setIsReplaying(false);
      }
    } catch {
      setLogs((prev) => [...prev, { message: "Replay failed to start", type: "error" }]);
      setIsReplaying(false);
    }
  };

  const clearSteps = () => {
    if (appSettings.confirmBeforeClear) {
      if (!window.confirm("Limpar todos os passos e logs?")) return;
    }
    setSteps([]);
    setLogs([]);
  };

  const exportSteps = () => {
    const dataStr =
      "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(steps, null, 2));
    const a = document.createElement("a");
    a.setAttribute("href", dataStr);
    a.setAttribute("download", "webflow_automation.json");
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const stepsOut = parseStepsJson(parsed);
        if (!stepsOut) {
          window.alert("JSON inválido: esperado um array de passos com action válida.");
          return;
        }
        setPendingImport(stepsOut);
        setImportModalOpen(true);
      } catch {
        window.alert("Não foi possível ler o arquivo JSON.");
      }
    };
    reader.readAsText(file, "utf-8");
  };

  const applyImportReplace = () => {
    if (pendingImport) setSteps(pendingImport.map((s) => ({ ...s, status: s.status ?? "pending" })));
    setPendingImport(null);
    setImportModalOpen(false);
  };

  const applyImportAppend = () => {
    if (pendingImport) {
      setSteps((prev) => [
        ...prev,
        ...pendingImport.map((s) => ({ ...s, id: newStepId(), status: s.status ?? "pending" })),
      ]);
    }
    setPendingImport(null);
    setImportModalOpen(false);
  };

  const cancelImport = () => {
    setPendingImport(null);
    setImportModalOpen(false);
  };

  const handleSaveSettings = (s: AppSettings) => {
    setAppSettings(s);
    saveSettings(s);
    setUrl(s.defaultUrl);
  };

  const deleteStep = (id: string) => {
    setSteps((prev) => prev.filter((x) => x.id !== id));
  };

  const duplicateStep = (step: Step) => {
    setSteps((prev) => [...prev, { ...step, id: newStepId(), status: "pending" }]);
  };

  const saveEditedStep = (updated: Step) => {
    setSteps((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  return (
    <div className="flex h-screen bg-[#0F0F11] text-white font-sans overflow-hidden">
      <SettingsModal
        open={settingsOpen}
        initial={appSettings}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
      <StepEditModal
        step={editingStep}
        onClose={() => setEditingStep(null)}
        onSave={saveEditedStep}
      />
      <ImportChoiceModal
        open={importModalOpen}
        count={pendingImport?.length ?? 0}
        onReplace={applyImportReplace}
        onAppend={applyImportAppend}
        onCancel={cancelImport}
      />

      <div className="w-80 border-r border-white/10 flex flex-col bg-[#151518] shrink-0">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
            <h1 className="font-semibold text-sm uppercase tracking-wider text-white/70">
              WebFlow Automator
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
            aria-label="Configurações"
          >
            <Settings size={16} className="text-white/40" />
          </button>
        </div>

        <StepList
          steps={steps}
          onSelectStep={setEditingStep}
          onDeleteStep={deleteStep}
          onDuplicateStep={duplicateStep}
        />

        <div className="p-4 border-t border-white/10 bg-[#1A1A1E] space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {!isRecording ? (
              <button
                type="button"
                onClick={startRecording}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all font-medium text-xs"
              >
                <Play size={14} fill="currentColor" /> Record
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black hover:bg-white/90 transition-all font-medium text-xs"
              >
                <Square size={14} fill="currentColor" /> Stop
              </button>
            )}
            <button
              type="button"
              onClick={runReplay}
              disabled={isReplaying || steps.length === 0 || !socket}
              title={
                !socket
                  ? "Replay exige backend Node com Socket.IO (npm run dev)"
                  : undefined
              }
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-xs"
            >
              <Play size={14} fill="currentColor" /> Replay
            </button>
          </div>
          <ImportExportControls
            onClear={clearSteps}
            onExport={exportSteps}
            onImportFile={handleImportFile}
            clearDisabled={steps.length === 0 && logs.length === 0}
            exportDisabled={steps.length === 0}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col relative min-w-0">
        <ProxyErrorBanner message={proxyError} onDismiss={() => setProxyError(null)} />

        <div className="p-3 bg-[#151518] border-b border-white/10 flex items-center gap-3 shrink-0">
          <div className="flex-1 flex items-center gap-3 bg-black/30 border border-white/5 rounded-xl px-4 py-2 focus-within:border-blue-500/50 transition-all">
            <Search size={16} className="text-white/20 shrink-0" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleNavigate()}
              className="bg-transparent border-none outline-none text-sm w-full text-white/80 placeholder:text-white/10"
              placeholder="Enter URL to automate..."
            />
          </div>
          <button
            type="button"
            onClick={() => void handleNavigate()}
            disabled={navChecking}
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all disabled:opacity-50"
            aria-label="Ir"
          >
            {navChecking ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}
          </button>
        </div>

        <div className="flex-1 bg-white relative overflow-hidden min-h-0">
          {currentUrl ? (
            <iframe
              ref={iframeRef}
              src={currentUrl}
              className="w-full h-full border-none"
              title="Automation Target"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#0F0F11] text-white/20">
              <div className="w-24 h-24 rounded-3xl border-2 border-dashed border-white/5 flex items-center justify-center mb-4">
                <ExternalLink size={32} />
              </div>
              <p className="text-sm">Enter a URL to start recording actions</p>
            </div>
          )}

          {inspector && (
            <div className="absolute bottom-6 right-6 w-72 bg-[#1A1A1E]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-4 pointer-events-none animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-blue-500/20 rounded-lg">
                  <Search size={14} className="text-blue-400" />
                </div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60">Inspector</h3>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] text-white/30 uppercase font-mono">Tag Name</p>
                  <p className="text-xs font-medium text-blue-400">{inspector.tagName}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/30 uppercase font-mono">Selector</p>
                  <p className="text-[10px] font-mono bg-black/40 p-1.5 rounded mt-1 break-all">
                    {inspector.selector}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-white/30 uppercase font-mono">ID</p>
                    <p className="text-[10px] truncate">{inspector.attributes.id || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 uppercase font-mono">Class</p>
                    <p className="text-[10px] truncate">{inspector.attributes.class || "-"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="h-48 bg-[#0A0A0C] border-t border-white/10 flex flex-col shrink-0">
          <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between bg-[#151518]">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-white/40" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                Execution Logs
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLogs([])}
              className="text-[10px] text-white/20 hover:text-white/40 transition-colors uppercase"
            >
              Clear
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] space-y-1.5 min-h-0">
            {logs.length === 0 ? (
              <p className="text-white/10 italic">Waiting for activity...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-white/20">[{new Date().toLocaleTimeString()}]</span>
                  {log.type === "info" && <Info size={12} className="mt-0.5 text-blue-400 shrink-0" />}
                  {log.type === "success" && (
                    <CheckCircle2 size={12} className="mt-0.5 text-emerald-400 shrink-0" />
                  )}
                  {log.type === "error" && (
                    <AlertCircle size={12} className="mt-0.5 text-red-400 shrink-0" />
                  )}
                  {log.type === "step" && (
                    <ChevronRight size={12} className="mt-0.5 text-white/40 shrink-0" />
                  )}
                  {log.type === "step_ok" && (
                    <CheckCircle2 size={12} className="mt-0.5 text-emerald-500/80 shrink-0" />
                  )}
                  {log.type === "step_error" && (
                    <AlertCircle size={12} className="mt-0.5 text-red-400 shrink-0" />
                  )}
                  <span
                    className={`flex-1 ${
                      log.type === "error" || log.type === "step_error"
                        ? "text-red-400"
                        : log.type === "success" || log.type === "step_ok"
                          ? "text-emerald-400"
                          : "text-white/60"
                    }`}
                  >
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
