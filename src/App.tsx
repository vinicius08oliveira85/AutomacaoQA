import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Square, 
  Trash2, 
  Download, 
  MousePointer2, 
  Type, 
  ExternalLink, 
  Settings, 
  ChevronRight, 
  Terminal,
  Search,
  CheckCircle2,
  AlertCircle,
  Info,
  Pause,
  SkipForward,
  Plus,
  X,
  Globe,
  Code,
  List
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { io } from "socket.io-client";

/** Dev local (`npm run dev`) usa Socket.IO no mesmo host; em build estático (Vercel) o replay usa só HTTP. */
const USE_SOCKET = import.meta.env.DEV || Boolean(import.meta.env.VITE_SOCKET_URL);

interface Step {
  id: string;
  command: string;
  target: string;
  value: string;
  status?: "pending" | "executing" | "success" | "error";
}

interface InspectorData {
  selector: string;
  tagName: string;
  attributes: {
    id?: string;
    class?: string;
    name?: string;
  };
}

export default function App() {
  const [url, setUrl] = useState("https://www.google.com");
  const [currentUrl, setCurrentUrl] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [isInspectorActive, setIsInspectorActive] = useState(false);
  const [inspector, setInspector] = useState<InspectorData | null>(null);
  const [logs, setLogs] = useState<{ message: string; type: string }[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const selectedStep = steps.find(s => s.id === selectedStepId);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "WEBFLOW_EVENT" && isRecording) {
        const newStep: Step = {
          id: Math.random().toString(36).substr(2, 9),
          command: event.data.command,
          target: event.data.target,
          value: event.data.value || "",
          status: "pending"
        };
        setSteps(prev => [...prev, newStep]);
        setSelectedStepId(newStep.id);
      } else if (event.data.type === "WEBFLOW_INSPECT" && isInspectorActive) {
        setInspector({
          selector: event.data.selector,
          tagName: event.data.tagName,
          attributes: event.data.attributes
        });
      } else if (event.data.type === "WEBFLOW_NAVIGATE") {
        const newUrl = event.data.url;
        setUrl(newUrl);
        setCurrentUrl(`/api/proxy?url=${encodeURIComponent(newUrl)}`);
        if (isRecording) {
          const navStep: Step = {
            id: Math.random().toString(36).substr(2, 9),
            command: "open",
            target: newUrl,
            value: "",
            status: "success"
          };
          setSteps(prev => [...prev, navStep]);
          setSelectedStepId(navStep.id);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isRecording, isInspectorActive]);

  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'WEBFLOW_TOGGLE_INSPECTOR',
        active: isInspectorActive
      }, '*');
    }
    if (!isInspectorActive) {
      setInspector(null);
    }
  }, [isInspectorActive]);

  useEffect(() => {
    if (!USE_SOCKET) return;
    const socket = import.meta.env.VITE_SOCKET_URL
      ? io(String(import.meta.env.VITE_SOCKET_URL))
      : io();
    socket.on("replay_status", (data: { message: string; type: string; stepId?: string }) => {
      setLogs((prev) => [...prev, { message: data.message, type: data.type }]);
      if (data.stepId) {
        setSteps((prev) =>
          prev.map((s) =>
            s.id === data.stepId ? { ...s, status: data.type === "step" ? "executing" : "success" } : s
          )
        );
      }
      if (data.type === "success" || data.type === "error") {
        setIsReplaying(false);
      }
    });
    return () => {
      socket.off("replay_status");
      socket.disconnect();
    };
  }, []);

  const handleNavigate = () => {
    if (!url) return;
    
    // Prevent recursion if the user enters the app's own URL
    const isSelf = url.includes(window.location.hostname);
    if (isSelf) {
      setLogs(prev => [...prev, { message: "Cannot automate the automation tool itself!", type: "error" }]);
      return;
    }

    setCurrentUrl(`/api/proxy?url=${encodeURIComponent(url)}`);
    const initialStep: Step = {
      id: "initial-nav",
      command: "open",
      target: url,
      value: "",
      status: "success"
    };
    setSteps([initialStep]);
    setSelectedStepId(initialStep.id);
  };

  const startRecording = () => {
    setIsRecording(true);
    setLogs(prev => [...prev, { message: "Recording started", type: "info" }]);
  };

  const stopRecording = () => {
    setIsRecording(false);
    setLogs(prev => [...prev, { message: "Recording stopped", type: "info" }]);
  };

  const applyReplayEvent = (data: { message: string; type: string; stepId?: string }) => {
    setLogs((prev) => [...prev, { message: data.message, type: data.type }]);
    if (data.stepId) {
      setSteps((prev) =>
        prev.map((s) =>
          s.id === data.stepId ? { ...s, status: data.type === "step" ? "executing" : "success" } : s
        )
      );
    }
    if (data.type === "success" || data.type === "error") {
      setIsReplaying(false);
    }
  };

  const runReplay = async () => {
    setIsReplaying(true);
    setLogs([]);
    setSteps((prev) => prev.map((s) => ({ ...s, status: "pending" })));

    try {
      const res = await fetch("/api/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      if (!USE_SOCKET) {
        const data = (await res.json()) as {
          events?: Array<{ message: string; type: string; stepId?: string }>;
        };
        const evs = data.events ?? [];
        for (const ev of evs) {
          applyReplayEvent(ev);
          await new Promise((r) => setTimeout(r, 800));
        }
        setIsReplaying(false);
      } else {
        await res.json().catch(() => ({}));
      }
    } catch {
      setLogs((prev) => [...prev, { message: "Replay failed to start", type: "error" }]);
      setIsReplaying(false);
    }
  };

  const clearSteps = () => {
    setSteps([]);
    setLogs([]);
    setSelectedStepId(null);
  };

  const exportSteps = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(steps, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "webflow_automation.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const updateSelectedStep = (field: keyof Step, value: string) => {
    if (selectedStepId) {
      setSteps(prev => prev.map(s => s.id === selectedStepId ? { ...s, [field]: value } : s));
    }
  };

  const findTarget = () => {
    if (selectedStep && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'WEBFLOW_FIND_ELEMENT',
        target: selectedStep.target
      }, '*');
      setLogs(prev => [...prev, { message: `Finding element: ${selectedStep.target}`, type: "info" }]);
    }
  };

  const addStep = () => {
    const newStep: Step = {
      id: Math.random().toString(36).substr(2, 9),
      command: "click",
      target: "",
      value: "",
      status: "pending"
    };
    setSteps(prev => [...prev, newStep]);
    setSelectedStepId(newStep.id);
  };

  const removeStep = (id: string) => {
    setSteps(prev => prev.filter(s => s.id !== id));
    if (selectedStepId === id) setSelectedStepId(null);
  };

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-[#cccccc] font-sans overflow-hidden relative">
      {/* Selenium IDE Style Toolbar */}
      <div className="h-12 bg-[#2d2d2d] border-b border-[#3c3c3c] flex items-center px-4 gap-4 shrink-0">
        <div className="flex items-center gap-1 pr-4 border-r border-[#3c3c3c]">
          <div className="w-6 h-6 bg-[#007acc] rounded flex items-center justify-center">
            <Globe size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-white ml-2">WebFlow Automator</span>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={runReplay}
            disabled={isReplaying || steps.length === 0}
            className="p-1.5 hover:bg-[#3c3c3c] rounded text-[#4ec9b0] disabled:opacity-30 transition-colors"
            title="Run all tests"
          >
            <Play size={18} fill="currentColor" />
          </button>
          <button className="p-1.5 hover:bg-[#3c3c3c] rounded text-[#ce9178] opacity-30" title="Pause">
            <Pause size={18} fill="currentColor" />
          </button>
          <button className="p-1.5 hover:bg-[#3c3c3c] rounded text-[#dcdcaa] opacity-30" title="Step over">
            <SkipForward size={18} fill="currentColor" />
          </button>
        </div>

        <div className="h-6 w-px bg-[#3c3c3c]" />

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsInspectorActive(!isInspectorActive)}
            className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-medium transition-colors ${
              isInspectorActive 
                ? "bg-[#007acc] text-white" 
                : "bg-[#3c3c3c] hover:bg-[#4c4c4c] text-[#cccccc]"
            }`}
            title="Inspect Element"
          >
            <Search size={14} />
            INSPECT
          </button>

          {!isRecording ? (
            <button 
              onClick={startRecording}
              className="flex items-center gap-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              REC
            </button>
          ) : (
            <button 
              onClick={stopRecording}
              className="flex items-center gap-2 px-3 py-1 bg-[#3c3c3c] hover:bg-[#4c4c4c] text-white rounded text-xs font-medium transition-colors"
            >
              <Square size={12} fill="currentColor" />
              STOP
            </button>
          )}
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-1 w-full max-w-md">
            <Globe size={14} className="text-[#858585]" />
            <input 
              type="text" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNavigate()}
              className="bg-transparent border-none outline-none text-xs w-full text-[#cccccc]"
              placeholder="Base URL"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={exportSteps} className="p-1.5 hover:bg-[#3c3c3c] rounded text-[#858585]" title="Save project">
            <Download size={18} />
          </button>
          <button onClick={clearSteps} className="p-1.5 hover:bg-[#3c3c3c] rounded text-[#858585]" title="Clear all">
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Steps Table */}
        <div className="w-[450px] border-r border-[#3c3c3c] flex flex-col bg-[#252526]">
          <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-[#3c3c3c]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#858585]">Test Steps</span>
            <button onClick={addStep} className="p-1 hover:bg-[#3c3c3c] rounded text-[#858585]">
              <Plus size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#252526] shadow-sm">
                <tr className="text-[10px] uppercase text-[#858585] border-b border-[#3c3c3c]">
                  <th className="px-3 py-2 font-medium w-8">#</th>
                  <th className="px-3 py-2 font-medium">Command</th>
                  <th className="px-3 py-2 font-medium">Target</th>
                  <th className="px-3 py-2 font-medium">Value</th>
                  <th className="px-3 py-2 font-medium w-8"></th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step, index) => (
                  <tr 
                    key={step.id}
                    onClick={() => setSelectedStepId(step.id)}
                    className={`text-[11px] border-b border-[#2d2d2d] cursor-pointer transition-all duration-150 ${
                      selectedStepId === step.id 
                        ? 'bg-[#04395e] text-white' 
                        : 'hover:bg-[#2a2d2e] text-[#cccccc]'
                    } ${
                      step.status === 'executing' ? 'bg-[#094771] ring-1 ring-inset ring-[#007acc]' : 
                      step.status === 'success' ? 'bg-[#1e3a1e]' : 
                      step.status === 'error' ? 'bg-[#4e1e1e]' : ''
                    }`}
                  >
                    <td className={`px-3 py-2 ${selectedStepId === step.id ? 'text-blue-200' : 'text-[#858585]'}`}>{index + 1}</td>
                    <td className="px-3 py-2 font-mono text-[#4ec9b0] font-medium">{step.command}</td>
                    <td className="px-3 py-2 truncate max-w-[120px] text-[#ce9178]">{step.target}</td>
                    <td className="px-3 py-2 truncate max-w-[80px] text-[#dcdcaa]">{step.value}</td>
                    <td className="px-3 py-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeStep(step.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#4c4c4c] rounded text-[#858585]"
                      >
                        <X size={10} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Step Editor Panel */}
          <div className="h-64 border-t border-[#3c3c3c] bg-[#1e1e1e] flex flex-col">
            <div className="px-4 py-2 bg-[#2d2d2d] border-b border-[#3c3c3c] flex items-center gap-2">
              <Code size={14} className="text-[#858585]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#858585]">Step Editor</span>
            </div>
            
            {selectedStep ? (
              <div className="p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-[#858585] uppercase font-bold">Command</label>
                  <input 
                    type="text"
                    value={selectedStep.command}
                    onChange={(e) => updateSelectedStep('command', e.target.value)}
                    className="w-full bg-[#3c3c3c] border border-[#3c3c3c] rounded px-2 py-1.5 text-xs text-white focus:border-[#007acc] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-[#858585] uppercase font-bold">Target</label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={selectedStep.target}
                      onChange={(e) => updateSelectedStep('target', e.target.value)}
                      className="flex-1 bg-[#3c3c3c] border border-[#3c3c3c] rounded px-2 py-1.5 text-xs text-white focus:border-[#007acc] outline-none"
                    />
                    <button 
                      onClick={findTarget}
                      className="px-2 bg-[#3c3c3c] hover:bg-[#4c4c4c] rounded text-[#858585] transition-colors"
                      title="Find element on page"
                    >
                      <Search size={14} />
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-[#858585] uppercase font-bold">Value</label>
                  <input 
                    type="text"
                    value={selectedStep.value}
                    onChange={(e) => updateSelectedStep('value', e.target.value)}
                    className="w-full bg-[#3c3c3c] border border-[#3c3c3c] rounded px-2 py-1.5 text-xs text-white focus:border-[#007acc] outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[#858585] text-xs italic">
                Select a step to edit
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Browser & Logs */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e]">
          {/* Browser View */}
          <div className="flex-1 relative bg-white overflow-hidden">
            {currentUrl ? (
              <iframe 
                ref={iframeRef}
                src={currentUrl}
                className="w-full h-full border-none"
                title="Automation Target"
                onLoad={() => {
                  if (iframeRef.current?.contentWindow) {
                    iframeRef.current.contentWindow.postMessage({
                      type: 'WEBFLOW_TOGGLE_INSPECTOR',
                      active: isInspectorActive
                    }, '*');
                  }
                }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-[#1e1e1e] text-[#858585]">
                <Globe size={48} className="mb-4 opacity-20" />
                <p className="text-sm">Enter a URL and click "Open" to start</p>
                <button 
                  onClick={handleNavigate}
                  className="mt-4 px-4 py-2 bg-[#007acc] hover:bg-[#0062a3] text-white rounded text-xs font-medium transition-colors"
                >
                  Open Browser
                </button>
              </div>
            )}

            {/* Inspector Overlay */}
            {inspector && (
              <div className="absolute bottom-4 right-4 max-w-xs bg-[#252526] border border-[#3c3c3c] rounded shadow-2xl p-3 pointer-events-none z-50">
                <div className="flex items-center gap-2 mb-2">
                  <Search size={12} className="text-[#007acc]" />
                  <span className="text-[10px] font-bold uppercase text-[#858585]">Inspector</span>
                </div>
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono break-all text-[#ce9178] bg-[#1e1e1e] p-1.5 rounded">
                    {inspector.selector}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-[#858585]">
                    <span>Tag: <span className="text-[#4ec9b0]">{inspector.tagName}</span></span>
                    {inspector.attributes.id && <span>ID: <span className="text-[#dcdcaa]">{inspector.attributes.id}</span></span>}
                    {inspector.attributes.class && <span className="truncate max-w-[150px]">Class: <span className="text-[#ce9178]">{inspector.attributes.class}</span></span>}
                    {inspector.attributes.name && <span>Name: <span className="text-[#9cdcfe]">{inspector.attributes.name}</span></span>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Panel - Logs */}
          <div className="h-48 border-t border-[#3c3c3c] flex flex-col bg-[#1e1e1e]">
            <div className="px-4 py-2 bg-[#2d2d2d] border-b border-[#3c3c3c] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <List size={14} className="text-[#858585]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#858585]">Log</span>
              </div>
              <button onClick={() => setLogs([])} className="text-[10px] text-[#858585] hover:text-white transition-colors">
                Clear
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] space-y-1">
              {logs.length === 0 ? (
                <div className="text-[#858585] italic opacity-50">No logs to display</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-[#858585] shrink-0">[{new Date().toLocaleTimeString()}]</span>
                    <span className={`${
                      log.type === 'error' ? 'text-[#f44747]' : 
                      log.type === 'success' ? 'text-[#4ec9b0]' : 
                      log.type === 'info' ? 'text-[#007acc]' : 'text-[#cccccc]'
                    }`}>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
