import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  UploadCloud,
  Plus,
  Trash2,
  Send,
  Sparkles,
  Bot,
  User as UserIcon,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  Search,
  RefreshCw,
  Layers,
  HelpCircle,
  Clock,
  Quote,
  Loader2,
  ExternalLink,
  Volume2,
  Play,
  Pause,
  Square,
  Globe,
  Mic,
  X,
  Menu,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Paper, ChatMessage, IndexedChunk, CitationSource, WebGroundingSource } from "../types";

// Helper to strip markdown and symbols so speech synthesis only reads natural language
function extractCleanTextForSpeech(markdown: string): string {
  return markdown
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, "")
    // Remove inline code
    .replace(/`([^`]+)`/g, "$1")
    // Remove headers
    .replace(/^#{1,6}\s+/gm, "")
    // Remove bold and italic
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    // Remove strikethrough
    .replace(/~~(.*?)~~/g, "$1")
    // Remove markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove page citations like [Page 3]
    .replace(/\[Page\s*\d+\]/gi, "")
    // Remove blockquotes
    .replace(/^\s*>\s+/gm, "")
    // Remove bullet point markers
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    // Remove table pipes and separators
    .replace(/\|/g, " ")
    .replace(/[-:]{3,}/g, "")
    // Collapse extra whitespace
    .replace(/\s+/g, " ")
    .trim();
}

interface DashboardProps {
  papers: Paper[];
  selectedPaper: Paper | null;
  onSelectPaper: (paper: Paper) => void;
  onOpenUpload: () => void;
  onOpenVoiceChat?: () => void;
  onDeletePaper: (paperId: string) => void;
  onLoadSample: () => void;
  token: string | null;
}

export const Dashboard: React.FC<DashboardProps> = ({
  papers,
  selectedPaper,
  onSelectPaper,
  onOpenUpload,
  onOpenVoiceChat,
  onDeletePaper,
  onLoadSample,
  token,
}) => {
  const [activeTab, setActiveTab] = useState<"chat" | "summary" | "chunks">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [searchGroundingEnabled, setSearchGroundingEnabled] = useState(false);
  const [chunks, setChunks] = useState<IndexedChunk[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Audio / Speech state
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const audioUtterancesRef = useRef<SpeechSynthesisUtterance[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Stop audio on unmount, paper switch, or tab switch
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMessageId(null);
    setIsAudioPaused(false);
    audioUtterancesRef.current = [];
  }, [selectedPaper?.id, activeTab]);

  const stopAudio = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    audioUtterancesRef.current = [];
    setSpeakingMessageId(null);
    setIsAudioPaused(false);
  };

  const pauseAudio = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window && speakingMessageId) {
      window.speechSynthesis.pause();
      setIsAudioPaused(true);
    }
  };

  const resumeAudio = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window && speakingMessageId) {
      window.speechSynthesis.resume();
      setIsAudioPaused(false);
    }
  };

  const playAudio = (messageId: string, rawText: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Audio playback is not supported in this browser.");
      return;
    }

    // Stop current speech first
    stopAudio();

    const cleanText = extractCleanTextForSpeech(rawText);
    if (!cleanText) return;

    // Split text into sentences to prevent browser utterance timeout issues
    const sentenceMatches = cleanText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleanText];
    const sentences = sentenceMatches.map((s) => s.trim()).filter((s) => s.length > 0);

    if (sentences.length === 0) return;

    const utterances: SpeechSynthesisUtterance[] = sentences.map((sentence, idx) => {
      const utterance = new SpeechSynthesisUtterance(sentence);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      if (idx === sentences.length - 1) {
        utterance.onend = () => {
          setSpeakingMessageId(null);
          setIsAudioPaused(false);
          audioUtterancesRef.current = [];
        };
      }
      utterance.onerror = (e) => {
        console.warn("Speech synthesis event:", e);
        if (idx === sentences.length - 1) {
          setSpeakingMessageId(null);
          setIsAudioPaused(false);
          audioUtterancesRef.current = [];
        }
      };
      return utterance;
    });

    audioUtterancesRef.current = utterances;
    setSpeakingMessageId(messageId);
    setIsAudioPaused(false);

    // Queue utterances in sequence
    for (const u of utterances) {
      window.speechSynthesis.speak(u);
    }
  };

  const toggleSource = (key: string) => {
    setExpandedSources((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Initialize or reset chat when paper changes
  useEffect(() => {
    if (selectedPaper) {
      setMessages([
        {
          id: "msg_welcome",
          sender: "assistant",
          text: `Welcome! I have loaded and indexed **"${selectedPaper.title}"**.\n\nThis paper contains **${selectedPaper.pageCount} pages** and has been indexed into **${selectedPaper.chunkCount} vector chunks**.\n\nYou can ask any question about the methodology, dataset, findings, limitations, or conclusion. Every answer will be grounded directly in the paper's text with verifiable page citations.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          agentReasoning: {
            retrievalRequired: false,
            intent: "session_initialization",
            decisionExplanation: "Session initiated. Vector index verified and ready for semantic retrieval queries.",
            queryAnalyzed: "paper_load",
            retrievedCount: 0,
          },
        },
      ]);
      // Preload paper chunks so the Vector Chunks Explorer is always populated
      fetchPaperChunks(selectedPaper.id);
    }
  }, [selectedPaper?.id]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const fetchPaperChunks = async (paperId: string) => {
    setLoadingChunks(true);
    try {
      const res = await fetch(`/api/papers/${paperId}/chunks`);
      const data = await res.json();
      if (res.ok) {
        setChunks(data.chunks || []);
      }
    } catch (err) {
      console.error("Failed to load chunks:", err);
    } finally {
      setLoadingChunks(false);
    }
  };

  const handleTabChange = (tab: "chat" | "summary" | "chunks") => {
    setActiveTab(tab);
    if (tab === "chunks" && selectedPaper) {
      fetchPaperChunks(selectedPaper.id);
    }
    if (tab === "summary" && selectedPaper && !selectedPaper.summary && !summaryLoading) {
      handleGenerateSummary();
    }
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputQuestion).trim();
    if (!textToSend || !selectedPaper || isSending) return;

    const userMessage: ChatMessage = {
      id: "msg_user_" + Date.now(),
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!customText) setInputQuestion("");
    setIsSending(true);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          paperId: selectedPaper.id,
          question: textToSend,
          searchGrounding: searchGroundingEnabled,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.detail || "Failed to process chat query");
      }

      const assistantMessage: ChatMessage = {
        id: "msg_ast_" + Date.now(),
        sender: "assistant",
        text: data.answer || data.text || "No response received.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        agentReasoning: data.agentReasoning,
        sources: data.sources,
        webSources: data.webSources,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: "msg_err_" + Date.now(),
        sender: "assistant",
        text: `Sorry, an error occurred while analyzing the paper: ${err.message || "Unknown error"}. Please check your connection or server logs.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!selectedPaper) return;
    setSummaryLoading(true);
    try {
      const res = await fetch(`/api/papers/${selectedPaper.id}/analyze`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.summary) {
        onSelectPaper({ ...selectedPaper, summary: data.summary });
      }
    } catch (err) {
      console.error("Summary error:", err);
    } finally {
      setSummaryLoading(false);
    }
  };

  const filteredPapers = papers.filter((p) =>
    p.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const sampleQuestions = [
    "What is this paper about and what problem does it solve?",
    "What methodology was used?",
    "What dataset was used?",
    "What are the key findings and results?",
    "What are the limitations?",
    "Explain this concept simply.",
  ];

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full max-w-full overflow-hidden bg-slate-100 dark:bg-slate-950 transition-colors relative">
      {/* Mobile Drawer Backdrop & Panel */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative flex w-4/5 max-w-xs flex-1 flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {/* Header with Close button */}
            <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-1.5 dark:text-white">
                <BookOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span>Research Papers ({papers.length})</span>
              </h2>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Close Papers Menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Upload button & Search */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
              <button
                onClick={() => {
                  setMobileSidebarOpen(false);
                  onOpenUpload();
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Upload New PDF</span>
              </button>

              <div className="relative">
                <Search className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 h-full w-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter papers..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Papers List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredPapers.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No papers found</p>
                  <button
                    onClick={() => {
                      setMobileSidebarOpen(false);
                      onLoadSample();
                    }}
                    className="mt-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400"
                  >
                    Load Sample Paper
                  </button>
                </div>
              ) : (
                filteredPapers.map((paper) => {
                  const isSelected = selectedPaper?.id === paper.id;
                  return (
                    <div
                      key={paper.id}
                      onClick={() => {
                        onSelectPaper(paper);
                        setMobileSidebarOpen(false);
                      }}
                      className={`rounded-xl p-3 cursor-pointer border transition-all ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 dark:border-indigo-500"
                          : "border-slate-200 bg-white hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/60"
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xs font-bold truncate leading-tight dark:text-white" title={paper.title}>
                            {paper.title}
                          </h3>
                          <div className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                            <span>{paper.pageCount} pages</span>
                            <span>&bull;</span>
                            <span>{paper.chunkCount} chunks</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/90 text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Vector Store Active</span>
              </span>
              <span className="text-[10px] font-mono text-indigo-700 dark:text-indigo-300">FastAPI</span>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Left Sidebar: Paper Library */}
      <aside className="hidden md:flex w-72 lg:w-80 shrink-0 border-r border-slate-200 bg-white flex-col h-full dark:border-slate-800 dark:bg-slate-900 transition-colors">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-1.5 dark:text-white">
              <BookOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Research Papers</span>
              <span className="ml-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                {papers.length}
              </span>
            </h2>
            <button
              onClick={onOpenUpload}
              className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Upload PDF</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 h-full w-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Filter papers..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
            />
          </div>
        </div>

        {/* Papers List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredPapers.length === 0 ? (
            <div className="text-center py-8 px-4">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 mb-2 dark:bg-slate-800 dark:text-slate-500">
                <FileText className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No papers found</p>
              <p className="text-[11px] text-slate-400 mt-0.5 dark:text-slate-500">Upload a PDF or load the landmark demo paper</p>
              <button
                onClick={onLoadSample}
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Load Sample Paper</span>
              </button>
            </div>
          ) : (
            filteredPapers.map((paper) => {
              const isSelected = selectedPaper?.id === paper.id;
              return (
                <div
                  key={paper.id}
                  onClick={() => onSelectPaper(paper)}
                  className={`group relative rounded-xl p-3 cursor-pointer border transition-all ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-50/70 shadow-xs dark:bg-indigo-950/40 dark:border-indigo-500"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h3
                          className={`text-xs font-bold truncate leading-tight ${
                            isSelected ? "text-indigo-950 dark:text-indigo-200" : "text-slate-900 dark:text-slate-100"
                          }`}
                          title={paper.title}
                        >
                          {paper.title}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 border border-slate-200/60 uppercase tracking-wider dark:bg-slate-700/60 dark:border-slate-700">
                            {paper.pageCount} {paper.pageCount === 1 ? "page" : "pages"}
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 border border-slate-200/60 uppercase tracking-wider dark:bg-slate-700/60 dark:border-slate-700">
                            {paper.chunkCount} chunks
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Delete button (hide for demo sample paper) */}
                    {paper.id !== "paper_attention_landmark" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Remove "${paper.title}" from your library?`)) {
                            onDeletePaper(paper.id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-1 rounded transition-opacity dark:hover:text-rose-400"
                        title="Delete paper"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase tracking-wider dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-400/20" />
              <span>Vector Store Active</span>
            </span>
            <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200/60 dark:bg-indigo-950/80 dark:text-indigo-300 dark:border-indigo-800">FastAPI RAG</span>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors">
        {!selectedPaper ? (
          /* Empty Workspace State */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-4 shadow-sm">
              <UploadCloud className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Select or Upload a Research Paper</h2>
            <p className="mt-1 text-sm text-slate-500 max-w-md">
              Choose an indexed paper from the left library, or upload a new PDF to extract text, compute vector
              chunks, and begin chatting.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={onOpenUpload}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow hover:bg-slate-800 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>Upload New PDF</span>
              </button>
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="md:hidden inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <BookOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span>Browse Papers ({papers.length})</span>
              </button>
              <button
                onClick={onLoadSample}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span>Load Landmark Transformer Paper</span>
              </button>
            </div>
          </div>
        ) : (
          /* Paper Workspace Layout */
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Paper Header Bar */}
            <header className="border-b border-slate-200 bg-white px-3 sm:px-6 py-2.5 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-4 dark:border-slate-800 dark:bg-slate-900 transition-colors shrink-0">
              <div className="flex items-center justify-between gap-2 min-w-0 w-full md:w-auto">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {/* Mobile open library drawer button */}
                  <button
                    type="button"
                    onClick={() => setMobileSidebarOpen(true)}
                    className="md:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 active:scale-95 transition-all"
                    title="Open Paper Library"
                    aria-label="Open Paper Library"
                  >
                    <BookOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </button>

                  <div className="hidden sm:flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-600/10 dark:bg-indigo-950/80 dark:text-indigo-400 dark:ring-indigo-700/40">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-xs sm:text-base font-black tracking-tight text-slate-900 truncate max-w-[200px] sm:max-w-md lg:max-w-xl dark:text-white" title={selectedPaper.title}>
                      {selectedPaper.title}
                    </h1>
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold text-slate-400 mt-0.5 dark:text-slate-500">
                      <span>{selectedPaper.pageCount} Pages</span>
                      <span>&bull;</span>
                      <span>{selectedPaper.chunkCount} Chunks</span>
                      <span className="hidden sm:inline">&bull;</span>
                      <span className="hidden sm:inline-flex items-center gap-1 text-emerald-700 font-bold uppercase tracking-wider text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Indexed
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mobile Voice button */}
                {onOpenVoiceChat && (
                  <button
                    id="live-voice-chat-btn-mobile"
                    type="button"
                    onClick={onOpenVoiceChat}
                    className="md:hidden shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-2.5 py-1.5 text-xs font-bold text-white shadow-xs"
                  >
                    <Mic className="h-3.5 w-3.5 animate-pulse" />
                    <span className="text-[11px]">Voice</span>
                  </button>
                )}
              </div>

              {/* Actions & Navigation Tabs */}
              <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto">
                {onOpenVoiceChat && (
                  <button
                    type="button"
                    onClick={onOpenVoiceChat}
                    className="hidden md:inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm shadow-indigo-600/20 hover:from-indigo-500 hover:to-indigo-600 active:scale-95 transition-all shrink-0"
                  >
                    <Mic className="h-3.5 w-3.5 text-white animate-pulse" />
                    <span>Live Voice</span>
                    <span className="rounded bg-indigo-500/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-extrabold text-indigo-100">
                      Live API
                    </span>
                  </button>
                )}

                {/* Navigation Tabs (Full width 3 columns on mobile) */}
                <div className="grid grid-cols-3 sm:flex items-center gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200/60 dark:bg-slate-800 dark:border-slate-700 w-full sm:w-auto">
                  <button
                    onClick={() => handleTabChange("chat")}
                    className={`rounded-lg px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-center truncate transition-all ${
                      activeTab === "chat"
                        ? "bg-white text-slate-900 shadow-xs ring-1 ring-slate-200 font-extrabold dark:bg-slate-900 dark:text-white dark:ring-slate-700"
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    💬 Chat
                  </button>
                  <button
                    onClick={() => handleTabChange("summary")}
                    className={`rounded-lg px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-center truncate transition-all ${
                      activeTab === "summary"
                        ? "bg-white text-slate-900 shadow-xs ring-1 ring-slate-200 font-extrabold dark:bg-slate-900 dark:text-white dark:ring-slate-700"
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    📑 Summary
                  </button>
                  <button
                    onClick={() => handleTabChange("chunks")}
                    className={`rounded-lg px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-center truncate transition-all ${
                      activeTab === "chunks"
                        ? "bg-white text-slate-900 shadow-xs ring-1 ring-slate-200 font-extrabold dark:bg-slate-900 dark:text-white dark:ring-slate-700"
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    🔍 Chunks ({selectedPaper.chunkCount})
                  </button>
                </div>
              </div>
            </header>

            {/* TAB 1: Chat Interface */}
            {activeTab === "chat" && (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Messages Scroll Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                  {/* Quick Viva Prompt Pills (if few messages) */}
                  {messages.length <= 2 && (
                    <div className="rounded-2xl border border-indigo-100 bg-white p-3.5 sm:p-4 shadow-xs dark:bg-slate-900 dark:border-slate-800">
                      <div className="flex items-center gap-2 mb-2.5 text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        <HelpCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        <span>Suggested Research Inquiries (Click to Ask):</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sampleQuestions.map((q, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSendMessage(q)}
                            disabled={isSending}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-400 hover:bg-indigo-50/80 hover:text-indigo-900 transition-colors text-left shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 max-w-full break-words"
                          >
                            &quot;{q}&quot;
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Messages List */}
                  {messages.map((msg) => {
                    const isUser = msg.sender === "user";

                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-3 max-w-3xl ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                      >
                        {/* Avatar */}
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold shadow-xs ${
                            isUser
                              ? "bg-slate-900 text-white"
                              : "bg-indigo-600 text-white"
                          }`}
                        >
                          {isUser ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                        </div>

                        {/* Message Bubble */}
                        <div className={`min-w-0 ${isUser ? "items-end" : "items-start"}`}>
                          <div
                            className={`rounded-2xl px-5 py-3.5 text-sm shadow-xs ${
                              isUser
                                ? "bg-slate-900 text-white font-medium dark:bg-indigo-600"
                                : "bg-white text-slate-800 border border-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800"
                            }`}
                          >
                            {/* Search Grounding indicator badge if used */}
                            {!isUser && msg.agentReasoning?.searchGroundingUsed && (
                              <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-sky-700 border border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800">
                                <Globe className="h-3 w-3" />
                                <span>Google Search Grounded &bull; gemini-3.5-flash</span>
                              </div>
                            )}

                            {/* Assistant Markdown Content */}
                            {isUser ? (
                              <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                            ) : (
                              <div className="prose prose-sm max-w-none prose-slate dark:prose-invert prose-p:leading-relaxed prose-headings:font-black prose-headings:text-slate-900 dark:prose-headings:text-white prose-ul:my-2 prose-li:my-0.5 break-words overflow-x-auto">
                                <ReactMarkdown>{msg.text}</ReactMarkdown>
                              </div>
                            )}

                            {/* Clean Source Citations Section */}
                            {!isUser && msg.sources && msg.sources.length > 0 && (
                              <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                                <div className="flex items-center gap-1.5 mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                  <Quote className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                  <span>PDF Citations ({msg.sources.length}):</span>
                                </div>
                                <div className="space-y-1.5">
                                  {msg.sources.map((src, i) => {
                                    const sourceKey = `${msg.id}_src_${i}`;
                                    const isExpanded = Boolean(expandedSources[sourceKey]);

                                    return (
                                      <div
                                        key={i}
                                        className="rounded-xl border border-slate-200 bg-slate-50/80 overflow-hidden text-xs dark:border-slate-800 dark:bg-slate-800/60"
                                      >
                                        <button
                                          type="button"
                                          onClick={() => toggleSource(sourceKey)}
                                          className="w-full flex items-center justify-between p-2.5 text-left font-semibold text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                                          aria-label={`Toggle supporting excerpt for page ${src.pageNumber}`}
                                        >
                                          <span className="flex items-center gap-2">
                                            <span className="rounded-md bg-indigo-100/80 px-2 py-0.5 text-[11px] font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                                              Page {src.pageNumber}
                                            </span>
                                            <span className="text-slate-500 text-[11px] font-medium dark:text-slate-400">
                                              Supporting excerpt
                                            </span>
                                          </span>
                                          {isExpanded ? (
                                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                          ) : (
                                            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                                          )}
                                        </button>
                                        {isExpanded && (
                                          <div className="px-3 pb-3 pt-1 border-t border-slate-200/60 bg-white dark:border-slate-750 dark:bg-slate-800/40">
                                            <p className="text-slate-600 italic leading-relaxed text-[11px] dark:text-slate-300">
                                              &quot;{src.textExcerpt}&quot;
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Google Search Grounding Web Sources Section */}
                            {!isUser && msg.webSources && msg.webSources.length > 0 && (
                              <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                                <div className="flex items-center gap-1.5 mb-2 text-xs font-extrabold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                                  <Globe className="h-3.5 w-3.5" />
                                  <span>Web Literature Sources ({msg.webSources.length}):</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {msg.webSources.map((ws, i) => (
                                    <a
                                      key={i}
                                      href={ws.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50/70 px-2.5 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-100 hover:text-sky-950 transition-colors dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900"
                                    >
                                      <span className="truncate max-w-[180px]">{ws.title}</span>
                                      <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Audio Playback Controls for Assistant Answers */}
                            {!isUser && (
                              <div className="mt-3.5 flex items-center gap-2 border-t border-slate-100 pt-2.5 text-xs dark:border-slate-800">
                                {speakingMessageId !== msg.id ? (
                                  <button
                                    type="button"
                                    onClick={() => playAudio(msg.id, msg.text)}
                                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
                                    title="Listen to this answer"
                                    aria-label="Listen to this answer"
                                  >
                                    <Volume2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                    <span>Listen</span>
                                  </button>
                                ) : (
                                  <div className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-2.5 py-1 border border-indigo-200/60 dark:bg-indigo-950/70 dark:border-indigo-800">
                                    <span className="inline-flex items-center gap-1 font-bold text-indigo-800 text-[11px] dark:text-indigo-300">
                                      <Volume2 className="h-3.5 w-3.5 animate-pulse text-indigo-600 dark:text-indigo-400" />
                                      <span>{isAudioPaused ? "Paused" : "Reading Aloud"}</span>
                                    </span>
                                    {isAudioPaused ? (
                                      <button
                                        type="button"
                                        onClick={resumeAudio}
                                        className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700 shadow-2xs hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
                                        title="Resume reading"
                                        aria-label="Resume reading"
                                      >
                                        <Play className="h-3 w-3" />
                                        <span>Resume</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={pauseAudio}
                                        className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700 shadow-2xs hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
                                        title="Pause reading"
                                        aria-label="Pause reading"
                                      >
                                        <Pause className="h-3 w-3" />
                                        <span>Pause</span>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={stopAudio}
                                      className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[11px] font-bold text-rose-600 shadow-2xs hover:bg-rose-50 dark:bg-slate-800 dark:text-rose-400 dark:hover:bg-slate-700 transition-colors"
                                      title="Stop reading"
                                      aria-label="Stop reading"
                                    >
                                      <Square className="h-3 w-3" />
                                      <span>Stop</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <span className="text-[10px] font-semibold text-slate-400 mt-1 block px-1 dark:text-slate-500">
                            {msg.timestamp}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Thinking/Generating indicator */}
                  {isSending && (
                    <div className="flex gap-3 mr-auto max-w-md">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3 shadow-xs dark:bg-slate-900 dark:border-slate-800">
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Analyzing paper with Gemini...</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Bottom Input Area */}
                <div className="p-2.5 sm:p-4 bg-white border-t border-slate-200 dark:border-slate-800 dark:bg-slate-900 transition-colors shrink-0">
                  {/* Controls: Search Grounding toggle and Live voice mode */}
                  <div className="flex items-center justify-between gap-1.5 mb-2">
                    <button
                      type="button"
                      id="toggle-search-grounding-btn"
                      onClick={() => setSearchGroundingEnabled((prev) => !prev)}
                      title="Ground answers with Google Search and gemini-3.5-flash"
                      className={`inline-flex items-center gap-1.5 rounded-xl px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-bold transition-all ${
                        searchGroundingEnabled
                          ? "bg-sky-100 text-sky-800 border border-sky-300 dark:bg-sky-950/80 dark:text-sky-300 dark:border-sky-700 shadow-2xs"
                          : "bg-slate-100 text-slate-500 border border-slate-200 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 dark:hover:text-slate-200"
                      }`}
                    >
                      <Globe className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                      <span>Search: {searchGroundingEnabled ? "ON" : "OFF"}</span>
                    </button>

                    {onOpenVoiceChat && (
                      <button
                        type="button"
                        id="voice-chat-shortcut-btn"
                        onClick={onOpenVoiceChat}
                        className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                      >
                        <Mic className="h-3.5 w-3.5 animate-pulse" />
                        <span className="hidden sm:inline">Speak with Paper</span>
                        <span className="sm:hidden">Live Voice</span>
                      </button>
                    )}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    className="flex items-center gap-1.5 sm:gap-2"
                  >
                    <input
                      type="text"
                      value={inputQuestion}
                      onChange={(e) => setInputQuestion(e.target.value)}
                      disabled={isSending}
                      placeholder="Ask a question about this paper..."
                      className="flex-1 rounded-xl border border-slate-300 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                    />
                    <button
                      type="submit"
                      disabled={!inputQuestion.trim() || isSending}
                      className="inline-flex h-9 w-9 sm:h-auto sm:w-auto items-center justify-center rounded-xl bg-slate-900 sm:px-5 sm:py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow hover:bg-slate-800 disabled:opacity-40 dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-all shrink-0"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                  <p className="mt-1 text-center text-[9px] sm:text-[10px] font-semibold text-slate-400 uppercase tracking-wider dark:text-slate-500 truncate">
                    Agentic RAG grounded in retrieved PDF chunks
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: Executive Summary & Technical Insights */}
            {activeTab === "summary" && (
              <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-50 dark:bg-slate-950 transition-colors">
                <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
                  {/* Action Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Executive Summary &amp; Key Insights</h2>
                      <p className="text-xs text-slate-500 font-medium dark:text-slate-400">
                        Structured technical breakdown extracted using Gemini AI.
                      </p>
                    </div>
                    <button
                      onClick={handleGenerateSummary}
                      disabled={summaryLoading}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${summaryLoading ? "animate-spin" : ""}`} />
                      <span>{summaryLoading ? "Synthesizing..." : "Refresh Summary"}</span>
                    </button>
                  </div>

                  {selectedPaper.summary ? (
                    <div className="space-y-4">
                      {/* Overview */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                        <h3 className="text-xs font-extrabold uppercase tracking-widest text-indigo-600 mb-2 dark:text-indigo-400">
                          1. Core Problem &amp; Objective
                        </h3>
                        <p className="text-sm text-slate-700 leading-relaxed dark:text-slate-300">
                          {selectedPaper.summary.overview}
                        </p>
                      </div>

                      {/* Methodology */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                        <h3 className="text-xs font-extrabold uppercase tracking-widest text-blue-600 mb-2 dark:text-blue-400">
                          2. Proposed Methodology &amp; Architecture
                        </h3>
                        <p className="text-sm text-slate-700 leading-relaxed dark:text-slate-300">
                          {selectedPaper.summary.methodology}
                        </p>
                      </div>

                      {/* Key Findings */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                        <h3 className="text-xs font-extrabold uppercase tracking-widest text-emerald-600 mb-3 dark:text-emerald-400">
                          3. Key Empirical Findings &amp; Results
                        </h3>
                        <ul className="space-y-2">
                          {selectedPaper.summary.keyFindings.map((finding, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5 dark:text-emerald-400" />
                              <span>{finding}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Limitations */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                        <h3 className="text-xs font-extrabold uppercase tracking-widest text-amber-600 mb-3 dark:text-amber-400">
                          4. Critical Limitations &amp; Scope Constraints
                        </h3>
                        <ul className="space-y-2">
                          {selectedPaper.summary.limitations.map((lim, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 mt-2" />
                              <span>{lim}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Conclusion */}
                      {selectedPaper.summary.conclusion && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                          <h3 className="text-xs font-extrabold uppercase tracking-widest text-violet-600 mb-2 dark:text-violet-400">
                            5. Conclusion &amp; Impact
                          </h3>
                          <p className="text-sm text-slate-700 leading-relaxed dark:text-slate-300">
                            {selectedPaper.summary.conclusion}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
                      <p className="text-sm text-slate-600 mb-3 dark:text-slate-400">
                        Executive summary is being generated or hasn&apos;t been synthesized yet.
                      </p>
                      <button
                        onClick={handleGenerateSummary}
                        disabled={summaryLoading}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Generate Executive Summary Now</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Vector Chunks Explorer (Viva transparency) */}
            {activeTab === "chunks" && (
              <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-50 dark:bg-slate-950 transition-colors">
                <div className="max-w-4xl mx-auto space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">Vector Chunks Explorer</h2>
                      <p className="text-xs text-slate-500 font-medium dark:text-slate-400">
                        Transparent inspection of all {chunks.length} extracted and chunked segments in the vector database.
                      </p>
                    </div>
                    <span className="self-start sm:self-auto rounded-full bg-indigo-50 px-3 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-700 border border-indigo-200 dark:bg-indigo-950/80 dark:text-indigo-300 dark:border-indigo-800">
                      Window: 2000 Chars &bull; Overlap: 200 Chars
                    </span>
                  </div>

                  {loadingChunks ? (
                    <div className="p-8 text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto mb-2 dark:text-indigo-400" />
                      <p className="text-xs text-slate-500 font-medium dark:text-slate-400">Loading vector store chunks...</p>
                    </div>
                  ) : chunks.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
                      <p className="text-xs text-slate-500 font-medium dark:text-slate-400">Click to fetch chunks from server.</p>
                      <button
                        onClick={() => fetchPaperChunks(selectedPaper.id)}
                        className="mt-2 text-xs font-bold uppercase tracking-wider text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        Load Chunks
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {chunks.map((chunk) => (
                        <div
                          key={chunk.id}
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900"
                        >
                          <div className="flex items-center justify-between text-xs mb-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                            <span className="font-bold text-slate-900 flex items-center gap-2 dark:text-slate-100">
                              <span className="rounded-md bg-indigo-600 text-white px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider">
                                Chunk #{chunk.chunkIndex + 1}
                              </span>
                              <span className="text-slate-600 font-semibold dark:text-slate-400">Page {chunk.pageNumber}</span>
                            </span>
                            <span className="font-mono text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                              {chunk.charLength} chars
                            </span>
                          </div>
                          <p className="text-xs font-mono text-slate-700 whitespace-pre-wrap break-words leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 dark:bg-slate-800/60 dark:border-slate-800 dark:text-slate-300">
                            {chunk.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

