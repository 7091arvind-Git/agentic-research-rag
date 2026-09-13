import React, { useState, useRef, useEffect } from "react";
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Paper } from "../types";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  onSuccess: (newPaper: Paper) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  token,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Real processing stage tracking (0 to 8)
  // 0: idle, 1: extracting, 2: extracted, 3: chunking, 4: chunked, 5: embedding, 6: embedded, 7: indexing, 8: completed
  const [stageOrder, setStageOrder] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [totalChunks, setTotalChunks] = useState<number>(0);
  const [processedChunks, setProcessedChunks] = useState<number>(0);
  const [currentBatch, setCurrentBatch] = useState<number>(0);
  const [totalBatches, setTotalBatches] = useState<number>(0);
  const [isCached, setIsCached] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Timer to monitor processing duration and show safety guidance if taking long
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isProcessing) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing]);

  if (!isOpen) return null;

  const resetModalState = () => {
    setFile(null);
    setTitle("");
    setIsProcessing(false);
    setStageOrder(0);
    setTotalPages(0);
    setTotalChunks(0);
    setProcessedChunks(0);
    setCurrentBatch(0);
    setTotalBatches(0);
    setIsCached(false);
    setElapsedSeconds(0);
    setError(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const validateAndSetFile = (selectedFile: File) => {
    setError(null);
    if (!selectedFile.name.toLowerCase().endsWith(".pdf") && selectedFile.type !== "application/pdf") {
      setError("Only PDF files (.pdf) are supported.");
      return;
    }
    if (selectedFile.size > 75 * 1024 * 1024) {
      setError("File size exceeds the 75MB limit. Please upload a PDF under 75MB.");
      return;
    }
    setFile(selectedFile);
    if (!title) {
      setTitle(selectedFile.name.replace(/\.pdf$/i, ""));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleProgressEvent = (event: any) => {
    if (event.totalPages) setTotalPages(event.totalPages);
    if (event.totalChunks) setTotalChunks(event.totalChunks);
    if (typeof event.processedChunks === "number") setProcessedChunks(event.processedChunks);
    if (typeof event.currentBatch === "number") setCurrentBatch(event.currentBatch);
    if (typeof event.totalBatches === "number") setTotalBatches(event.totalBatches);
    if (event.isCached) setIsCached(true);

    switch (event.stage) {
      case "upload_received":
        setStageOrder(1);
        break;
      case "extracting":
        setStageOrder(1);
        break;
      case "extracted":
        setStageOrder(2);
        break;
      case "chunking":
        setStageOrder(3);
        break;
      case "chunked":
        setStageOrder(4);
        break;
      case "embedding":
        setStageOrder(5);
        break;
      case "indexing":
        setStageOrder(7);
        break;
      case "completed":
        setStageOrder(8);
        break;
      case "error":
        throw new Error(event.message || "Failed to process paper.");
    }
  };

  const handleUploadAndProcess = async () => {
    if (!file) {
      setError("Please select a PDF file first.");
      return;
    }

    setError(null);
    setIsProcessing(true);
    setStageOrder(1); // Stage 1: Upload received
    setElapsedSeconds(0);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title.trim() || file.name.replace(/\.pdf$/i, ""));

      const headers: Record<string, string> = {
        Accept: "application/x-ndjson, application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/papers/upload?stream=true", {
        method: "POST",
        headers,
        body: formData,
        signal: controller.signal,
      });

      if (!res.ok && !res.body) {
        throw new Error(`Upload failed with server status ${res.status}`);
      }

      const reader = res.body?.getReader();
      let finalPaper: Paper | null = null;

      if (!reader) {
        // Fallback for non-streaming response
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to process research paper PDF.");
        finalPaper = data.paper;
      } else {
        const decoder = new TextDecoder("utf-8");
        let streamBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          streamBuffer += decoder.decode(value, { stream: true });
          const lines = streamBuffer.split("\n");
          streamBuffer = lines.pop() || ""; // Keep unfinished tail

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line.trim());
              handleProgressEvent(event);
              if (event.paper) {
                finalPaper = event.paper;
              }
            } catch (jsonErr) {
              console.warn("Could not parse NDJSON line:", line, jsonErr);
            }
          }
        }
      }

      if (finalPaper) {
        setStageOrder(8);
        setTimeout(() => {
          onSuccess(finalPaper!);
          onClose();
          resetModalState();
        }, 800);
      } else {
        throw new Error("Indexing finished without returning paper metadata.");
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setError("Upload canceled.");
      } else {
        setError(err.message || "An error occurred during paper indexing.");
      }
      setIsProcessing(false);
      setStageOrder(0);
    }
  };

  const handleCancel = () => {
    if (isProcessing && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    resetModalState();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto overflow-x-hidden">
      <div className="relative w-full max-w-sm sm:max-w-lg my-auto max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-2xl bg-white p-4 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 transition-colors">
        {/* Close button */}
        <button
          onClick={handleCancel}
          disabled={isProcessing && stageOrder === 8}
          className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors disabled:opacity-30"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-5">
          <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Upload Research Paper PDF</h2>
          <p className="text-xs text-slate-500 font-medium mt-1 dark:text-slate-400">
            The paper will be parsed, split into semantic chunks, and embedded for grounded RAG synthesis.
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Drag & Drop Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-7 text-center cursor-pointer transition-all ${
            isDragging
              ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40"
              : file
              ? "border-emerald-300 bg-emerald-50/40 dark:border-emerald-700 dark:bg-emerald-950/30"
              : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50/80 dark:border-slate-700 dark:hover:border-indigo-500 dark:hover:bg-slate-800/60"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,application/pdf"
            className="hidden"
          />

          {file ? (
            <div className="flex flex-col items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 mb-3 shadow-xs dark:bg-emerald-900/60 dark:text-emerald-300">
                <FileText className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-slate-900 truncate max-w-[280px] dark:text-white">{file.name}</p>
              <p className="text-xs font-semibold text-slate-500 mt-1 dark:text-slate-400">
                {(file.size / (1024 * 1024)).toFixed(2)} MB &bull; PDF Document
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-800 border border-emerald-200/60 dark:bg-emerald-900/70 dark:text-emerald-300 dark:border-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" /> PDF SELECTED
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-3 shadow-xs ring-1 ring-indigo-600/10 dark:bg-indigo-950/80 dark:text-indigo-400 dark:ring-indigo-700/50">
                <UploadCloud className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Drag and drop your research paper PDF here
              </p>
              <p className="text-xs text-slate-500 mt-1 font-medium dark:text-slate-400">or click to browse your computer</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-3 dark:text-slate-500">PDF format &bull; Supports 100–200+ Page Textbooks &bull; Up to 75MB</p>
            </div>
          )}
        </div>

        {/* Paper Title Field */}
        {file && !isProcessing && (
          <div className="mt-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 dark:text-slate-300">
              Custom Paper Title (Optional)
            </label>
            <input
              type="text"
              disabled={isProcessing}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Attention Is All You Need"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        )}

        {/* Real-time Processing Pipeline Stages (NO Fake Progress) */}
        {isProcessing && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/90 p-4.5 dark:border-slate-800 dark:bg-slate-800/80 transition-all">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                {stageOrder < 8 ? (
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
                <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  {stageOrder === 8
                    ? "READY FOR RAG"
                    : isCached
                    ? "RESTORING FROM VECTOR CACHE..."
                    : "PROCESSING PAPER"}
                </span>
              </div>
              {totalChunks > 0 && processedChunks > 0 && stageOrder < 8 && (
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {Math.round((processedChunks / totalChunks) * 100)}%
                </span>
              )}
            </div>

            {/* Stages Checklist */}
            <div className="space-y-2.5 text-xs">
              {/* 1. PDF uploaded */}
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="font-semibold text-slate-700 dark:text-slate-200">PDF uploaded</span>
              </div>

              {/* 2. Text extracted */}
              <div className="flex items-center gap-2.5">
                {stageOrder >= 2 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : stageOrder === 1 ? (
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600 shrink-0" />
                ) : (
                  <div className="h-4 w-4 rounded-full border border-slate-300 dark:border-slate-600 shrink-0" />
                )}
                <span className={stageOrder === 1 ? "font-bold text-indigo-600 dark:text-indigo-400" : stageOrder >= 2 ? "font-semibold text-slate-700 dark:text-slate-200" : "font-medium text-slate-400 dark:text-slate-500"}>
                  {totalPages > 0 ? `Text extracted (${totalPages} pages)` : stageOrder === 1 ? "Extracting text..." : "Text extracted"}
                </span>
              </div>

              {/* 3. Chunks created */}
              <div className="flex items-center gap-2.5">
                {stageOrder >= 4 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : stageOrder === 3 ? (
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600 shrink-0" />
                ) : (
                  <div className="h-4 w-4 rounded-full border border-slate-300 dark:border-slate-600 shrink-0" />
                )}
                <span className={stageOrder === 3 ? "font-bold text-indigo-600 dark:text-indigo-400" : stageOrder >= 4 ? "font-semibold text-slate-700 dark:text-slate-200" : "font-medium text-slate-400 dark:text-slate-500"}>
                  {totalChunks > 0 ? `Chunks created (${totalChunks} chunks)` : stageOrder === 3 ? "Creating chunks..." : "Chunks created"}
                </span>
              </div>

              {/* 4. Generating embeddings */}
              <div className="flex items-center gap-2.5">
                {stageOrder >= 7 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : stageOrder === 5 ? (
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600 shrink-0" />
                ) : (
                  <div className="h-4 w-4 rounded-full border border-slate-300 dark:border-slate-600 shrink-0" />
                )}
                <span className={stageOrder === 5 ? "font-bold text-indigo-600 dark:text-indigo-400" : stageOrder >= 7 ? "font-semibold text-slate-700 dark:text-slate-200" : "font-medium text-slate-400 dark:text-slate-500"}>
                  {stageOrder >= 7
                    ? `Embeddings generated (${totalChunks} chunks)`
                    : stageOrder === 5
                    ? totalBatches > 1
                      ? `Generating embeddings (batch ${currentBatch}/${totalBatches} • ${processedChunks}/${totalChunks} chunks)`
                      : "Generating embeddings..."
                    : "Generating embeddings"}
                </span>
              </div>

              {/* 5. Indexing vector store */}
              <div className="flex items-center gap-2.5">
                {stageOrder >= 8 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : stageOrder === 7 ? (
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600 shrink-0" />
                ) : (
                  <div className="h-4 w-4 rounded-full border border-slate-300 dark:border-slate-600 shrink-0" />
                )}
                <span className={stageOrder === 7 ? "font-bold text-indigo-600 dark:text-indigo-400" : stageOrder >= 8 ? "font-semibold text-emerald-600 dark:text-emerald-400" : "font-medium text-slate-400 dark:text-slate-500"}>
                  {stageOrder >= 8 ? "READY FOR RAG" : "Indexing vector store"}
                </span>
              </div>
            </div>

            {/* Accurate Progress Bar (Exact % when embedding, clean indeterminate during extraction) */}
            <div className="w-full bg-slate-200 h-2 rounded-full mt-4 overflow-hidden dark:bg-slate-700">
              {stageOrder === 8 ? (
                <div className="bg-emerald-500 h-full rounded-full w-full transition-all duration-300" />
              ) : totalChunks > 0 && processedChunks > 0 ? (
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(5, Math.round((processedChunks / totalChunks) * 100)))}%` }}
                />
              ) : (
                <div className="bg-indigo-600 h-full rounded-full animate-pulse w-full opacity-60" />
              )}
            </div>

            {/* Timeout / Long processing notice */}
            {elapsedSeconds > 40 && stageOrder < 8 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2.5 font-semibold">
                Indexing is taking longer than expected. Please wait or try again.
              </p>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isProcessing && stageOrder === 8}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUploadAndProcess}
            disabled={!file || isProcessing}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-all"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>Upload &amp; Build Vector Store</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
