# AI Research Paper Analyzer & Chatbot (PaperMind)

An Agentic Retrieval-Augmented Generation (RAG) platform that empowers students, researchers, and engineers to upload academic research papers in PDF format and interrogate them using Google Gemini AI, semantic vector search, and verifiable page-level citations.

---

## 1. Project Overview

Academic research papers are dense, lengthy, and filled with domain-specific terminology, mathematical formulations, and empirical tables. Students and researchers often spend hours parsing through papers to find specific methodologies, dataset characteristics, benchmark metrics, and limitations.

**PaperMind** solves this problem by providing an end-to-end Agentic RAG pipeline:
1. Extract text and page boundaries from any uploaded research paper PDF.
2. Segment the document into semantic overlapping chunks while tracking source pages.
3. Compute dense vector embeddings and index them in a similarity vector store.
4. Apply an **Agentic Decision Router** that determines if vector retrieval is necessary or if a direct conversational response is appropriate.
5. Retrieve the top-$K$ most relevant chunks using Cosine Similarity.
6. Synthesize grounded, hallucination-resistant answers with **Google Gemini 3.8 Flash**, attaching exact source citations (`[Page X]`).

---

## 2. Key Features

- **Modern SaaS Interface**: Clean landing page, interactive technical pipeline diagram, and responsive dashboard.
- **Lightweight Authentication**: User signup, login, session token validation, and a **1-Click Demo Student Account** (`demo@college.edu` / `demo123`).
- **Robust PDF Processing**: Drag-and-drop PDF upload (up to 15MB) with live multi-stage progress indicators.
- **Smart Chunking Engine**: Chunks documents into 750-character windows with 150-character overlaps, preserving exact page numbers.
- **Vector Similarity Search**: Cosine similarity retrieval over high-dimensional vector representations.
- **Agentic Decision Step**: Automatically determines whether user queries require vector retrieval (e.g. methodology, datasets, findings) or direct conversational answers.
- **Source Citation Cards**: Grounded answers displaying the source page numbers and text excerpts directly beneath responses.
- **Executive Summary Generator**: Automatically synthesizes the Core Problem, Methodology, Key Findings, and Known Limitations.
- **Vector Chunks Explorer**: Transparency tool allowing viva examiners and evaluators to inspect every indexed chunk in the vector store.
- **Preloaded Landmark Paper**: Includes the famous *"Attention Is All You Need"* (Vaswani et al.) paper pre-indexed for instant viva demonstrations.

---

## 3. Tech Stack

- **Frontend**:
  - React 19 + TypeScript
  - Vite (Fast bundler)
  - Tailwind CSS (Modern utility-first styling)
  - Lucide React (Icons)
  - React Markdown (Rich formatting for math & academic explanations)
- **Backend & Server**:
  - Node.js + Express (Full-Stack TypeScript server with `tsx`)
  - `pdf-parse` (Page-aware PDF text extraction)
  - `multer` (File upload handling)
- **AI & RAG Engine**:
  - `@google/genai` (Official Google Gemini TypeScript SDK)
  - **Gemini 3.8 Flash** for generation and academic synthesis
  - **Gemini Embedding** / Semantic vector cosine index
- **Database & Storage**:
  - In-memory vector database and user session store

---

## 4. Architecture & RAG Pipeline

```
┌────────────────────────────────────────────────────────┐
│                   React 19 Frontend                    │
│      Landing Page  •  Auth Modal  •  Chat UI           │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP / REST API
┌───────────────────────────▼────────────────────────────┐
│                  Express Backend API                   │
│             Auth  •  Upload  •  Chat Router            │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                    PDF RAG Pipeline                    │
│                                                        │
│  [1] PDF Upload & Page Extraction (pdf-parse)          │
│                       ↓                                │
│  [2] Text Cleaning & Overlap Chunking (750 / 150)      │
│                       ↓                                │
│  [3] Vector Embeddings Generation                      │
│                       ↓                                │
│  [4] In-Memory Vector Store Indexing                   │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                   Agentic Chat Engine                  │
│                                                        │
│  User Query → Agentic Intent Classifier                │
│    ├── General / Greeting → Direct Conversational      │
│    └── Research Question → Semantic Cosine Retrieval   │
│                               ↓                        │
│                Top-K Relevant Chunks (Sources)         │
│                               ↓                        │
│                Google Gemini 3.8 Flash Grounding       │
│                               ↓                        │
│                Answer + Page Number Citations          │
└────────────────────────────────────────────────────────┘
```

---

## 5. Environment Variables

Create a `.env` file in the root directory (based on `.env.example`):

```env
# Google Gemini API Key
GEMINI_API_KEY="your_google_gemini_api_key_here"

# Application URL
APP_URL="http://localhost:3000"
```

> **Note**: In Google AI Studio, the `GEMINI_API_KEY` is automatically injected into the server environment from the platform's Secrets configuration.

---

## 6. How to Run

### Installation
Ensure Node.js (v18+) is installed. Run:
```bash
npm install
```

### Running the Application
To start the unified development server:
```bash
npm run dev
```
The application will be accessible at:
```
http://localhost:3000
```

### Building for Production
```bash
npm run build
npm start
```

---

## 7. Viva & Examination Guide

When presenting this project in a viva or college project review, highlight the following:

1. **Why RAG instead of standard prompting?**
   - Standard LLMs hallucinate or cannot access the full private text of custom research papers. RAG guarantees that answers are grounded in the actual document.
2. **What makes it "Agentic"?**
   - Rather than blindly executing vector search on every token, the system employs an Agentic Router step that classifies intent, evaluates whether retrieval is warranted, and surfaces its decision rationale to the user.
3. **How does Chunking with Overlap prevent loss of context?**
   - Splitting sentences cleanly at paragraph boundaries with a 150-character sliding overlap ensures key definitions or equations split across page boundaries are not lost.
4. **How are citations validated?**
   - Each chunk retains its source `pageNumber` during PDF parsing. When retrieved, citations are physically tied to the originating page.

---

## 8. Future Improvements

- Support for OCR (Optical Character Recognition) for scanned or image-only PDFs.
- Multi-paper comparative synthesis (chatting across a folder of 10+ papers simultaneously).
- LaTeX equation rendering via KaTeX.
- Graph-RAG representation for cross-paper citation networks.
