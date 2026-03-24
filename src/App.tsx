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
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { io } from "socket.io-client";

interface Step {
  id: string;
  action: "click" | "type" | "navigate" | "wait";
  selector?: string;
  value?: string;
  text?: string;
  tagName?: string;
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

const socket = io();

export default function App() {
  const [url, setUrl] = useState("https://www.google.com");
  const [currentUrl, setCurrentUrl] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [inspector, setInspector] = useState<InspectorData | null>(null);
  const [logs, setLogs] = useState<{ message: string; type: string }[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "WEBFLOW_EVENT" && isRecording) {
        const newStep: Step = {
          id: Math.random().toString(36).substr(2, 9),
          action: event.data.action,
          selector: event.data.selector,
          value: event.data.value,
          text: event.data.text,
          tagName: event.data.tagName,
          status: "pending"
        };
        setSteps(prev => [...prev, newStep]);
      } else if (event.data.type === "WEBFLOW_INSPECT") {
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
          setSteps(prev => [...prev, {
            id: Math.random().toString(36).substr(2, 9),
            action: "navigate",
            value: newUrl,
            status: "success"
          }]);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isRecording]);

  useEffect(() => {
    socket.on("replay_status", (data) => {
      setLogs(prev => [...prev, { message: data.message, type: data.type }]);
      if (data.stepId) {
        setSteps(prev => prev.map(s => 
          s.id === data.stepId ? { ...s, status: data.type === "step" ? "executing" : "success" } : s
        ));
      }
      if (data.type === "success" || data.type === "error") {
        setIsReplaying(false);
      }
    });

    return () => {
      socket.off("replay_status");
    };
  }, []);

  const handleNavigate = () => {
    setCurrentUrl(`/api/proxy?url=${encodeURIComponent(url)}`);
    setSteps([{
      id: "initial-nav",
      action: "navigate",
      value: url,
      status: "success"
    }]);
  };

  const startRecording = () => {
    setIsRecording(true);
    setLogs(prev => [...prev, { message: "Recording started", type: "info" }]);
  };

  const stopRecording = () => {
    setIsRecording(false);
    setLogs(prev => [...prev, { message: "Recording stopped", type: "info" }]);
  };

  const runReplay = async () => {
    setIsReplaying(true);
    setLogs([]);
    setSteps(prev => prev.map(s => ({ ...s, status: "pending" })));
    
    try {
      await fetch("/api/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps })
      });
    } catch (error) {
      setLogs(prev => [...prev, { message: "Replay failed to start", type: "error" }]);
      setIsReplaying(false);
    }
  };

  const clearSteps = () => {
    setSteps([]);
    setLogs([]);
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

  return (
    <div className="flex h-screen bg-[#0F0F11] text-white font-sans overflow-hidden">
      {/* Sidebar - Step Manager */}
      <div className="w-80 border-r border-white/10 flex flex-col bg-[#151518]">
        <div className="p-4 border-bottom border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
            <h1 className="font-semibold text-sm uppercase tracking-wider text-white/70">WebFlow Automator</h1>
          </div>
          <button className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
            <Settings size={16} className="text-white/40" />
          </button>
        </div>

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
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`group p-3 rounded-xl border ${
                    step.status === 'executing' ? 'border-blue-500/50 bg-blue-500/5' : 
                    step.status === 'success' ? 'border-emerald-500/30 bg-emerald-500/5' :
                    'border-white/5 bg-white/[0.02]'
                  } transition-all`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {step.action === 'click' && <MousePointer2 size={14} className="text-blue-400" />}
                      {step.action === 'type' && <Type size={14} className="text-purple-400" />}
                      {step.action === 'navigate' && <ChevronRight size={14} className="text-emerald-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Step {index + 1}</p>
                        {step.status === 'success' && <CheckCircle2 size={12} className="text-emerald-500" />}
                        {step.status === 'executing' && <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />}
                      </div>
                      <p className="text-xs font-medium truncate mt-0.5">
                        {step.action === 'navigate' ? `Go to ${step.value}` : 
                         step.action === 'click' ? `Click ${step.tagName || 'element'}` :
                         `Type "${step.value}"`}
                      </p>
                      {step.selector && (
                        <p className="text-[10px] font-mono text-white/30 truncate mt-1 bg-black/20 p-1 rounded">
                          {step.selector}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        <div className="p-4 border-t border-white/10 bg-[#1A1A1E] space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {!isRecording ? (
              <button 
                onClick={startRecording}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all font-medium text-xs"
              >
                <Play size={14} fill="currentColor" /> Record
              </button>
            ) : (
              <button 
                onClick={stopRecording}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black hover:bg-white/90 transition-all font-medium text-xs"
              >
                <Square size={14} fill="currentColor" /> Stop
              </button>
            )}
            <button 
              onClick={runReplay}
              disabled={isReplaying || steps.length === 0}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-xs"
            >
              <Play size={14} fill="currentColor" /> Replay
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={clearSteps}
              className="flex items-center justify-center gap-2 py-2 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-all text-xs"
            >
              <Trash2 size={14} /> Clear
            </button>
            <button 
              onClick={exportSteps}
              className="flex items-center justify-center gap-2 py-2 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-all text-xs"
            >
              <Download size={14} /> Export
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Browser View */}
      <div className="flex-1 flex flex-col relative">
        {/* Address Bar */}
        <div className="p-3 bg-[#151518] border-b border-white/10 flex items-center gap-3">
          <div className="flex-1 flex items-center gap-3 bg-black/30 border border-white/5 rounded-xl px-4 py-2 focus-within:border-blue-500/50 transition-all">
            <Search size={16} className="text-white/20" />
            <input 
              type="text" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNavigate()}
              className="bg-transparent border-none outline-none text-sm w-full text-white/80 placeholder:text-white/10"
              placeholder="Enter URL to automate..."
            />
          </div>
          <button 
            onClick={handleNavigate}
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Browser Iframe */}
        <div className="flex-1 bg-white relative overflow-hidden">
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
          
          {/* Overlay for Inspector */}
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
                  <p className="text-[10px] font-mono bg-black/40 p-1.5 rounded mt-1 break-all">{inspector.selector}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-white/30 uppercase font-mono">ID</p>
                    <p className="text-[10px] truncate">{inspector.attributes.id || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 uppercase font-mono">Class</p>
                    <p className="text-[10px] truncate">{inspector.attributes.class || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Console / Logs */}
        <div className="h-48 bg-[#0A0A0C] border-t border-white/10 flex flex-col">
          <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between bg-[#151518]">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-white/40" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Execution Logs</span>
            </div>
            <button onClick={() => setLogs([])} className="text-[10px] text-white/20 hover:text-white/40 transition-colors uppercase">Clear</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] space-y-1.5">
            {logs.length === 0 ? (
              <p className="text-white/10 italic">Waiting for activity...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-white/20">[{new Date().toLocaleTimeString()}]</span>
                  {log.type === 'info' && <Info size={12} className="mt-0.5 text-blue-400" />}
                  {log.type === 'success' && <CheckCircle2 size={12} className="mt-0.5 text-emerald-400" />}
                  {log.type === 'error' && <AlertCircle size={12} className="mt-0.5 text-red-400" />}
                  {log.type === 'step' && <ChevronRight size={12} className="mt-0.5 text-white/40" />}
                  <span className={`flex-1 ${
                    log.type === 'error' ? 'text-red-400' : 
                    log.type === 'success' ? 'text-emerald-400' : 
                    'text-white/60'
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
  );
}
