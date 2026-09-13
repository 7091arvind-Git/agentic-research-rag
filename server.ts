import "dotenv/config";
import express, { Request, Response } from "express";
import http from "http";
import path from "path";
import multer from "multer";
import { WebSocketServer, WebSocket } from "ws";
import { Modality } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { registerUser, loginUser, getUserFromToken, logoutUser } from "./server/auth";
import { getGenAI, hasApiKey } from "./server/gemini";
import {
  processAndStorePdf,
  seedSamplePaper,
  listPapers,
  getPaper,
  getPaperChunks,
  deletePaper,
  executeAgenticChat,
  generatePaperSummary,
  getPaperContextForVoice,
} from "./server/rag";

const app = express();
const PORT = 3000;

// CORS middleware for flexible cross-origin support
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

// Middleware for parsing JSON with generous payload limits (supporting large textbook chunks)
app.use(express.json({ limit: "150mb" }));
app.use(express.urlencoded({ extended: true, limit: "150mb" }));

// Configure multer for memory storage (up to 75MB PDF for 100-200+ page textbooks)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 75 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files (.pdf) are supported."));
    }
  },
});

// Authentication middleware
function requireAuth(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: "Authentication required. Please log in." });
    return;
  }
  const user = getUserFromToken(authHeader);
  if (!user) {
    res.status(401).json({ error: "Session expired or invalid token. Please log in again." });
    return;
  }
  (req as any).user = user;
  next();
}

// Optional Auth middleware (falls back to demo user if unauthenticated)
function optionalAuth(req: Request, _res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const user = getUserFromToken(authHeader);
    if (user) {
      (req as any).user = user;
    }
  }
  next();
}

// ==================== API ROUTES ====================

// Base deployment health check (Phase 26)
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Health check with diagnostic metadata
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    environment: process.env.NODE_ENV || "development",
    hasGeminiKey: hasApiKey(),
    timestamp: new Date().toISOString(),
  });
});

// Auth: Register
app.post("/api/auth/register", (req, res) => {
  try {
    const { name, email, password } = req.body;
    const result = registerUser(name, email, password);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Registration failed" });
  }
});

// Auth: Login
app.post("/api/auth/login", (req, res) => {
  try {
    const { email, password } = req.body;
    const result = loginUser(email, password);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message || "Invalid credentials" });
  }
});

// Auth: Current User
app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: (req as any).user });
});

// Auth: Logout
app.post("/api/auth/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    logoutUser(authHeader);
  }
  res.json({ success: true });
});

// Papers: List
app.get("/api/papers", optionalAuth, (req, res) => {
  const userId = (req as any).user?.id;
  const papers = listPapers(userId);
  res.json({ papers });
});

// Papers: Get Single
app.get("/api/papers/:id", optionalAuth, (req, res) => {
  const paper = getPaper(req.params.id);
  if (!paper) {
    res.status(404).json({ error: "Paper not found" });
    return;
  }
  res.json({ paper });
});

// Papers: Get Chunks (for viva presentation & transparency)
app.get("/api/papers/:id/chunks", optionalAuth, (req, res) => {
  const paper = getPaper(req.params.id);
  if (!paper) {
    res.status(404).json({ error: "Paper not found" });
    return;
  }
  const chunks = getPaperChunks(req.params.id);
  // Return without heavy embedding arrays
  const sanitized = chunks.map((c) => ({
    id: c.id,
    chunkIndex: c.chunkIndex,
    pageNumber: c.pageNumber,
    charLength: c.text.length,
    text: c.text,
  }));
  res.json({ paperId: paper.id, totalChunks: sanitized.length, chunks: sanitized });
});

// Papers: Upload & Process PDF with real-time streaming progress
app.post("/api/papers/upload", optionalAuth, upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Please select a PDF file to upload." });
      return;
    }

    const file = req.file;
    const title = (req.body.title || file.originalname.replace(/\.pdf$/i, "")).trim();
    const userId = (req as any).user?.id || "usr_demo_1";
    const paperId = "paper_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

    // Support streaming progress via application/x-ndjson or ?stream=true
    const wantsStream = req.headers.accept?.includes("application/x-ndjson") || req.query.stream === "true";

    if (wantsStream) {
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Transfer-Encoding", "chunked");
      res.setHeader("Cache-Control", "no-cache, no-transform");

      const sendEvent = (event: any) => {
        if (!res.writableEnded) {
          res.write(JSON.stringify(event) + "\n");
        }
      };

      sendEvent({
        stage: "upload_received",
        message: "PDF uploaded to server successfully",
      });

      await processAndStorePdf(
        paperId,
        userId,
        title,
        file.originalname,
        file.buffer,
        (progress) => {
          sendEvent(progress);
        }
      );

      res.end();
    } else {
      const paperMetadata = await processAndStorePdf(
        paperId,
        userId,
        title,
        file.originalname,
        file.buffer
      );

      res.json({
        success: true,
        message: "Research paper successfully processed and indexed into vector store.",
        paper: paperMetadata,
      });
    }
  } catch (err: any) {
    console.error("Upload & RAG processing error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        error: err.message || "Failed to process research paper PDF.",
      });
    } else {
      res.write(JSON.stringify({ stage: "error", message: err.message || "Failed to process research paper PDF." }) + "\n");
      res.end();
    }
  }
});

// Papers: Analyze / Generate Summary
app.post("/api/papers/:id/analyze", optionalAuth, async (req, res) => {
  try {
    const summary = await generatePaperSummary(req.params.id);
    if (!summary) {
      res.status(404).json({ error: "Paper not found or no content extracted" });
      return;
    }
    res.json({ summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to summarize paper" });
  }
});

// Papers: Delete
app.delete("/api/papers/:id", optionalAuth, (req, res) => {
  const success = deletePaper(req.params.id);
  if (!success) {
    res.status(404).json({ error: "Paper not found or cannot be deleted" });
    return;
  }
  res.json({ success: true, message: "Paper removed successfully" });
});

// RAG: Agentic Chat
app.post("/api/chat", optionalAuth, async (req: Request, res: Response) => {
  try {
    const { paperId, question, searchGrounding } = req.body;
    if (!paperId) {
      res.status(400).json({ error: "paperId is required" });
      return;
    }
    if (!question || !question.trim()) {
      res.status(400).json({ error: "Question cannot be empty" });
      return;
    }

    const response = await executeAgenticChat(paperId, question.trim(), Boolean(searchGrounding));
    res.json(response);
  } catch (err: any) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err.message || "Error generating response" });
  }
});

// Boot HTTP server and seed sample paper
async function startServer() {
  await seedSamplePaper();

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const httpServer = http.createServer(app);

  // Setup WebSocket server for Gemini Live API (gemini-3.1-flash-live-preview)
  const wss = new WebSocketServer({ server: httpServer, path: "/api/live-voice" });

  wss.on("connection", async (clientWs: WebSocket, req) => {
    try {
      const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
      const paperId = url.searchParams.get("paperId") || "";
      const paperContext = paperId ? getPaperContextForVoice(paperId) : null;

      const ai = getGenAI();
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: `You are an academic AI Research Assistant conducting real-time voice discussion for the paper "${paperContext?.title || "Academic Research Paper"}".
Respond conversationally, concisely, and clearly.
${paperContext?.overview ? `Key Context: ${paperContext.overview}` : ""}
${paperContext?.keyFindings?.length ? `Findings: ${paperContext.keyFindings.slice(0, 3).join("; ")}` : ""}
Keep spoken responses natural, direct, and under 3-4 sentences per turn.`,
        },
        callbacks: {
          onmessage: (message: any) => {
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "audio", audio }));
            }
            if (message.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "interrupted" }));
            }
            if (message.serverContent?.turnComplete && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "turnComplete" }));
            }
          },
          onclose: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.close();
            }
          },
          onerror: (err: any) => {
            console.error("Live API session error:", err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "error", error: err?.message || "Live API session encountered an error" }));
            }
          },
        },
      });

      clientWs.on("message", (raw) => {
        try {
          const payload = JSON.parse(raw.toString());
          if (payload.audio) {
            session.sendRealtimeInput({
              audio: { data: payload.audio, mimeType: "audio/pcm;rate=16000" },
            });
          }
          if (payload.text) {
            session.sendRealtimeInput({
              text: payload.text,
            });
          }
        } catch (err) {
          console.error("Error processing client message:", err);
        }
      });

      clientWs.on("close", () => {
        try {
          session.close();
        } catch (_) {}
      });

      clientWs.send(JSON.stringify({
        type: "ready",
        paperTitle: paperContext?.title || "Indexed Research Paper",
      }));
    } catch (err: any) {
      console.error("Live Voice session initialization failed:", err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: "error",
          error: err?.message || "Failed to initialize Live Voice conversation with Gemini Live API",
        }));
        clientWs.close();
      }
    }
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
