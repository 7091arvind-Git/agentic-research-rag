import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, VolumeX, X, Radio, Sparkles, MessageSquare, AlertCircle } from "lucide-react";
import { Paper } from "../types";

interface VoiceChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  paper: Paper | null;
}

export const VoiceChatModal: React.FC<VoiceChatModalProps> = ({ isOpen, onClose, paper }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcriptLogs, setTranscriptLogs] = useState<{ sender: "user" | "gemini"; text: string }[]>([]);
  const [textInput, setTextInput] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Stop all audio output and clear queues
  const stopAudioPlayback = () => {
    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
      } catch (_) {}
    }
    activeSourcesRef.current = [];
    if (audioContextOutRef.current) {
      nextPlayTimeRef.current = audioContextOutRef.current.currentTime;
    }
    setIsSpeaking(false);
  };

  // Convert Base64 PCM 24kHz to AudioBuffer and schedule playback
  const playAudioChunk = (base64Audio: string) => {
    try {
      if (!audioContextOutRef.current) {
        audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000,
        });
      }
      const ctx = audioContextOutRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const binaryStr = atob(base64Audio);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      // Convert 16-bit PCM to Float32
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      const startTime = Math.max(now, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;

      activeSourcesRef.current.push(source);
      setIsSpeaking(true);

      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
        if (activeSourcesRef.current.length === 0) {
          setIsSpeaking(false);
        }
      };
    } catch (err) {
      console.error("Audio playback error:", err);
    }
  };

  // Start Voice Session
  const startSession = async () => {
    if (!paper) return;
    setIsConnecting(true);
    setErrorMessage(null);
    setTranscriptLogs([
      {
        sender: "gemini",
        text: `Connected to Gemini Live API. I am ready to discuss "${paper.title}". Speak into your microphone or type a question below!`,
      },
    ]);

    try {
      // Connect to WebSocket server
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/live-voice?paperId=${encodeURIComponent(paper.id)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        setIsConnected(true);
        setIsConnecting(false);
        await initMicrophone(ws);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "audio" && msg.audio) {
            playAudioChunk(msg.audio);
          } else if (msg.type === "interrupted") {
            stopAudioPlayback();
          } else if (msg.type === "error") {
            setErrorMessage(msg.error || "Gemini Live API encountered an error.");
          }
        } catch (e) {
          console.error("Failed to parse websocket message:", e);
        }
      };

      ws.onerror = (e) => {
        console.error("WebSocket error:", e);
        setErrorMessage("Could not connect to Live Voice session. Check your internet connection.");
        setIsConnecting(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        cleanupAudio();
      };
    } catch (err: any) {
      console.error("Session start error:", err);
      setErrorMessage(err.message || "Failed to initialize microphone or connection.");
      setIsConnecting(false);
    }
  };

  // Initialize Microphone & PCM Streamer
  const initMicrophone = async (ws: WebSocket) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      audioContextInRef.current = audioCtx;

      const sourceNode = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      sourceNode.connect(analyser);

      // ScriptProcessorNode for 16-bit PCM chunk streaming
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (isMuted || ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to 16-bit PCM
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Convert PCM16 buffer to Base64
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Audio = btoa(binary);

        ws.send(JSON.stringify({ audio: base64Audio }));
      };

      sourceNode.connect(processor);
      processor.connect(audioCtx.destination);

      startVisualizer();
    } catch (err: any) {
      console.error("Microphone capture error:", err);
      setErrorMessage("Microphone access denied or unavailable. You can still type prompts below.");
    }
  };

  // Animated Waveform Visualizer
  const startVisualizer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      let values: Uint8Array;
      if (analyserRef.current) {
        values = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(values);
      } else {
        values = new Uint8Array(32).fill(10);
      }

      const barCount = 36;
      const barWidth = (width / barCount) * 0.65;
      const spacing = (width - barCount * barWidth) / (barCount + 1);

      for (let i = 0; i < barCount; i++) {
        const valIndex = Math.floor((i / barCount) * values.length);
        const rawVal = values[valIndex] || 0;
        const normalized = isSpeaking ? (rawVal / 255) * 0.8 + 0.2 : (rawVal / 255);
        const barHeight = Math.max(4, normalized * (height * 0.85));

        const x = spacing + i * (barWidth + spacing);
        const y = (height - barHeight) / 2;

        // Visual gradients
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (isSpeaking) {
          gradient.addColorStop(0, "#818cf8"); // Indigo-400
          gradient.addColorStop(1, "#4f46e5"); // Indigo-600
        } else if (!isMuted) {
          gradient.addColorStop(0, "#38bdf8"); // Sky-400
          gradient.addColorStop(1, "#0284c7"); // Sky-600
        } else {
          gradient.addColorStop(0, "#94a3b8"); // Slate-400
          gradient.addColorStop(1, "#64748b"); // Slate-500
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 4);
        ctx.fill();
      }
    };

    render();
  };

  // Cleanup all audio resources
  const cleanupAudio = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    stopAudioPlayback();
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextInRef.current) {
      audioContextInRef.current.close().catch(() => {});
      audioContextInRef.current = null;
    }
    if (audioContextOutRef.current) {
      audioContextOutRef.current.close().catch(() => {});
      audioContextOutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({ text: textInput.trim() }));
    setTranscriptLogs((prev) => [...prev, { sender: "user", text: textInput.trim() }]);
    setTextInput("");
  };

  const handleInterrupt = () => {
    stopAudioPlayback();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ text: "Please pause and listen to my follow-up." }));
    }
  };

  useEffect(() => {
    if (isOpen) {
      startSession();
    } else {
      cleanupAudio();
      setIsConnected(false);
      setIsConnecting(false);
    }
    return () => {
      cleanupAudio();
    };
  }, [isOpen, paper?.id]);

  if (!isOpen || !paper) return null;

  return (
    <div
      id="voice-chat-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-xs transition-all overflow-y-auto overflow-x-hidden"
    >
      <div
        id="voice-chat-modal-container"
        className="w-full max-w-sm sm:max-w-xl md:max-w-2xl my-auto max-h-[92vh] flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 sm:px-6 py-3 sm:py-4 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
              <Radio className={`h-4 w-4 sm:h-5 sm:w-5 ${isConnected ? "animate-pulse" : ""}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                  Gemini Live Voice
                </h3>
                <span className="hidden xs:inline-block rounded-md bg-indigo-50 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300">
                  gemini-3.1-flash
                </span>
              </div>
              <p className="max-w-[190px] sm:max-w-md truncate text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">
                Discussing: <span className="font-semibold text-slate-700 dark:text-slate-300">{paper.title}</span>
              </p>
            </div>
          </div>
          <button
            id="voice-modal-close-btn"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Visualizer Stage */}
        <div className="relative flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100/50 px-6 py-8 dark:from-slate-900/90 dark:to-slate-950">
          {/* Waveform Canvas */}
          <div className="relative flex h-28 w-full items-center justify-center">
            <canvas
              ref={canvasRef}
              width={480}
              height={100}
              className="w-full max-w-md rounded-xl"
            />
          </div>

          {/* Status Badge */}
          <div className="mt-4 flex items-center gap-2">
            {isConnecting ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                <span className="h-2 w-2 animate-ping rounded-full bg-amber-500" />
                Connecting to Gemini Live...
              </span>
            ) : isSpeaking ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                <Sparkles className="h-3.5 w-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                Gemini is Speaking...
              </span>
            ) : isMuted ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                <MicOff className="h-3.5 w-3.5" />
                Microphone Muted
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Listening to you...
              </span>
            )}
          </div>

          {/* Error Message banner */}
          {errorMessage && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Live Transcript / Dialogue Box */}
        <div className="max-h-48 overflow-y-auto border-t border-slate-100 bg-white p-4 space-y-2.5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Real-time Dialogue Feed
          </p>
          {transcriptLogs.map((log, index) => (
            <div
              key={index}
              className={`flex items-start gap-2.5 text-xs ${
                log.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {log.sender === "gemini" && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold text-[10px]">
                  AI
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 leading-relaxed ${
                  log.sender === "user"
                    ? "bg-slate-900 text-white dark:bg-slate-800"
                    : "bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60"
                }`}
              >
                {log.text}
              </div>
            </div>
          ))}
        </div>

        {/* Interactive Controls & Text Fallback */}
        <div className="border-t border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50">
          {/* Quick Audio Action Buttons */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <button
                id="voice-toggle-mute-btn"
                onClick={() => setIsMuted((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  isMuted
                    ? "bg-rose-600 text-white shadow-sm hover:bg-rose-700"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                <span>{isMuted ? "Unmute Mic" : "Mute Mic"}</span>
              </button>

              {isSpeaking && (
                <button
                  id="voice-interrupt-btn"
                  onClick={handleInterrupt}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300 transition-colors"
                >
                  <VolumeX className="h-4 w-4" />
                  <span>Interrupt</span>
                </button>
              )}
            </div>

            <button
              id="voice-end-session-btn"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition-colors"
            >
              End Voice Session
            </button>
          </div>

          {/* Text input fallback */}
          <form onSubmit={handleSendText} className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                id="voice-text-fallback-input"
                type="text"
                placeholder="Or type a quick question for Gemini Live..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
              />
            </div>
            <button
              id="voice-text-send-btn"
              type="submit"
              disabled={!textInput.trim() || !isConnected}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
