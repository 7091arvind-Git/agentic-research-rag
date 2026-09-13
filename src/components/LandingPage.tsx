import React from "react";
import {
  FileText,
  Cpu,
  Database,
  ArrowRight,
  Bot,
  Sparkles,
  CheckCircle2,
  Layers,
  Search,
  Quote,
  Zap,
} from "lucide-react";

interface LandingPageProps {
  onGetStarted: () => void;
  onOpenAuth: (mode: "login" | "signup") => void;
  isLoggedIn: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onGetStarted,
  onOpenAuth,
  isLoggedIn,
}) => {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-14 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28 border-b border-slate-100 dark:border-slate-800">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45rem_50rem_at_top,theme(colors.indigo.50),white)] dark:bg-[radial-gradient(45rem_50rem_at_top,rgba(67,56,202,0.15),transparent)] opacity-70" />
        
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Refined Google Gemini AI & Agentic RAG Badge */}
          <div className="inline-flex items-center gap-2 sm:gap-2.5 rounded-full border border-slate-200 bg-white/95 px-3 sm:px-3.5 py-1.5 shadow-xs backdrop-blur-md mb-6 sm:mb-8 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/90 dark:hover:border-slate-600 transition-all">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 ring-1 ring-inset ring-indigo-700/20 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-700/50">
              Agentic RAG
            </span>
            <span className="h-3 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span className="text-slate-500 font-medium dark:text-slate-400 hidden xs:inline">Powered by</span>
              <span className="inline-flex items-center gap-1 font-bold text-slate-900 dark:text-white">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600 fill-indigo-500/20 dark:text-indigo-400" />
                Google Gemini AI
              </span>
            </div>
          </div>

          {/* Main Title */}
          <h1 className="mx-auto max-w-4xl text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.14]">
            Transform Complex Research Papers Into{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-800 dark:from-indigo-400 dark:via-blue-400 dark:to-indigo-300">
              Actionable Insights
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-4 sm:mt-6 max-w-2xl text-sm sm:text-lg text-slate-600 dark:text-slate-400 font-normal leading-relaxed">
            Upload any academic PDF to extract text, compute vector embeddings, and interrogate the paper using
            an intelligent agentic retrieval-augmented generation (RAG) system with traceable page citations and Live Voice interaction.
          </p>

          {/* CTA Buttons */}
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full max-w-md sm:max-w-none mx-auto">
            <button
              id="hero-btn-analyze-paper"
              onClick={onGetStarted}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl bg-slate-900 px-6 sm:px-7 py-3 sm:py-3.5 text-xs font-extrabold uppercase tracking-wider text-white shadow-md hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-all hover:shadow-lg"
            >
              <span>Analyze Research Paper</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            {!isLoggedIn && (
              <button
                id="hero-btn-demo-account"
                onClick={() => onOpenAuth("login")}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 sm:px-6 py-3 sm:py-3.5 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors shadow-xs"
              >
                <span>Sign In with Demo Account</span>
              </button>
            )}
          </div>

          {/* Mini Highlights */}
          <div className="mt-8 sm:mt-12 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400" />
              PDF Page Extraction
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400" />
              Cosine Vector Search
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400" />
              Agentic Intent Routing
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400" />
              Verifiable Page Citations
            </span>
          </div>
        </div>
      </section>

      {/* RAG Pipeline Diagram (Viva-Ready Architecture) */}
      <section className="py-16 bg-slate-50 border-b border-slate-200 dark:bg-slate-900/60 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2">Technical Implementation</h2>
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              How the Agentic RAG Pipeline Works
            </h3>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              A transparent, end-to-end multi-stage pipeline designed for academic rigor, verifiable answers, and college viva demonstration.
            </p>
          </div>

          {/* Workflow Steps Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 mb-4 font-black text-sm">
                01
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1">PDF &amp; Page Extraction</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                Parses the uploaded research PDF page by page. Normalizes typography, repairs broken hyphenations, and preserves page boundaries.
              </p>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-2.5 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                pdf-parse &bull; Page Tracking
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 mb-4 font-black text-sm">
                02
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1">Chunking &amp; Vectors</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                Segments text into overlapping chunks (750 chars, 150 overlap). Computes dense vector embeddings for each chunk to build a vector store.
              </p>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-2.5 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                Vector Store &bull; Overlap Window
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 mb-4 font-black text-sm">
                03
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1">Agentic Router Step</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                Inspects user query intent. Decides whether vector similarity search is required, or routes conversational messages directly.
              </p>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-2.5 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                Intent Router &bull; Cosine Top-K
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 mb-4 font-black text-sm">
                04
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1">Gemini AI &amp; Citations</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                Synthesizes retrieved chunks with strict academic grounding. Emits clear answers citing exact source pages [Page X].
              </p>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-2.5 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                Gemini 3.8 Flash &bull; Source Pages
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Showcase Grid */}
      <section className="py-16 bg-white dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2">Research Toolkit</h2>
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Core Capabilities Designed for Research
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Everything needed to examine, summarize, and critique academic literature with confidence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500 transition-all">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 mb-4">
                <FileText className="h-5 w-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">Deep Paper Understanding</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Ask targeted questions about the core problem formulation, theoretical foundations, mathematical formulas, and algorithmic contributions.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500 transition-all">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 mb-4">
                <Search className="h-5 w-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">Empirical &amp; Benchmark Audit</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Instantly retrieve what datasets, baselines, BLEU/accuracy metrics, and hardware specifications were utilized by the authors during experiments.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 hover:border-purple-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-purple-500 transition-all">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400 mb-4">
                <Quote className="h-5 w-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">Zero-Hallucination Citations</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Every generated response attaches traceable source cards highlighting the exact page number and text snippet retrieved from the PDF.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Viva Questions Sample Banner */}
      <section className="py-14 bg-slate-900 text-white dark:bg-slate-900/90 border-t border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-xl sm:text-2xl font-black tracking-tight mb-3">
            Try Inquiring with Pre-Configured Academic Prompts
          </h3>
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider max-w-xl mx-auto mb-8">
            Clicking any prompt in the dashboard runs an automatic semantic search across the vector store
          </p>

          <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
            <span className="rounded-xl bg-slate-800/90 border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 shadow-xs">
              &quot;What methodology was used in this paper?&quot;
            </span>
            <span className="rounded-xl bg-slate-800/90 border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 shadow-xs">
              &quot;What datasets and benchmarks were tested?&quot;
            </span>
            <span className="rounded-xl bg-slate-800/90 border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 shadow-xs">
              &quot;What are the stated limitations and weaknesses?&quot;
            </span>
            <span className="rounded-xl bg-slate-800/90 border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 shadow-xs">
              &quot;Summarize the key empirical findings.&quot;
            </span>
          </div>

          <div className="mt-10">
            <button
              onClick={onGetStarted}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-7 py-3 text-xs font-extrabold uppercase tracking-wider text-white shadow-md transition-all"
            >
              <span>Launch Paper Workspace</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
