import os
import time
import json
import math
import hashlib
import asyncio
from typing import Optional, List
from contextlib import asynccontextmanager

from pathlib import Path
from fastapi import FastAPI, Request, Response, UploadFile, File, Form, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from backend.config import has_gemini_key
from backend.models import (
    User,
    PaperMetadata,
    PaperSummary,
    IndexedChunk,
    ChatRequest,
    ChatMessage,
    RegisterRequest,
    LoginRequest,
)
from backend.auth import (
    register_user,
    login_user,
    get_user_from_token,
    logout_user,
)
from backend.chunker import extract_pages_from_pdf_bytes, chunk_document, clean_surrogates, has_extractable_text
from backend.vector_store import (
    PAPERS_STORE,
    PAPER_CHUNKS_STORE,
    PAPER_HASH_STORE,
    get_batch_embeddings,
    seed_sample_paper,
)
from backend.agent import execute_agentic_chat, generate_paper_summary

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Boot hook: seed landmark paper
    seed_sample_paper()
    yield

app = FastAPI(
    title="AI Research Paper Analyzer & Agentic RAG API",
    description="Production-grade asynchronous Python AI microservice powering research paper ingestion, semantic vector search, and Agentic RAG.",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS Configuration allowing seamless local development with React/Vite
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Guarantees both 'detail' and 'error' are always returned in all client error responses."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "error": exc.detail},
    )

# ==================== HEALTH ENDPOINTS ====================

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/health")
def api_health():
    return {
        "status": "ok",
        "engine": "Python FastAPI + Agentic RAG",
        "environment": "development",
        "hasGeminiKey": has_gemini_key(),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
    }

# ==================== AUTH ENDPOINTS ====================

@app.post("/api/auth/register")
def register(req: RegisterRequest):
    try:
        return register_user(req.name, req.email, req.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/auth/login")
def login(req: LoginRequest):
    try:
        return login_user(req.email, req.password)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

@app.get("/api/auth/me")
def get_me(authorization: Optional[str] = Header(None)):
    user = get_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return {"user": user.model_dump()}

@app.post("/api/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    logout_user(authorization)
    return {"success": True}

# ==================== PAPERS ENDPOINTS ====================

@app.get("/api/papers")
def list_papers():
    return {"papers": [p.model_dump() for p in PAPERS_STORE.values()]}

@app.get("/api/papers/{paper_id}")
def get_paper(paper_id: str):
    paper = PAPERS_STORE.get(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return {"paper": paper.model_dump()}

@app.get("/api/papers/{paper_id}/chunks")
def get_chunks(paper_id: str):
    paper = PAPERS_STORE.get(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    chunks = PAPER_CHUNKS_STORE.get(paper_id, [])
    sanitized = [
        IndexedChunk(
            id=c["id"],
            chunkIndex=c["chunkIndex"],
            pageNumber=c["pageNumber"],
            charLength=len(clean_surrogates(c.get("text", ""))),
            text=clean_surrogates(c.get("text", "")),
        ).model_dump()
        for c in chunks
    ]
    return {"paperId": paper_id, "totalChunks": len(sanitized), "chunks": sanitized}

@app.delete("/api/papers/{paper_id}")
def delete_paper(paper_id: str):
    if paper_id not in PAPERS_STORE:
        raise HTTPException(status_code=404, detail="Paper not found")
    PAPERS_STORE.pop(paper_id, None)
    PAPER_CHUNKS_STORE.pop(paper_id, None)
    return {"success": True, "message": "Paper removed successfully"}

@app.post("/api/papers/{paper_id}/analyze")
def analyze_paper(paper_id: str):
    summary = generate_paper_summary(paper_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Paper not found or extraction failed")
    return {"summary": summary.model_dump()}

# ==================== PDF UPLOAD & RAG INGESTION ====================

@app.post("/api/papers/upload")
async def upload_paper(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    stream: Optional[bool] = Query(False),
    authorization: Optional[str] = Header(None),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files (.pdf) are supported.")

    content = await file.read()
    file_size = len(content)
    if file_size > 75 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds the 75MB limit. Please upload a PDF under 75MB.")

    clean_title = (title or file.filename.rsplit(".", 1)[0]).strip()
    paper_id = f"paper_{int(time.time())}_{os.urandom(3).hex()}"
    user = get_user_from_token(authorization)
    user_id = user.id if user else "usr_demo_1"
    file_hash = hashlib.sha256(content).hexdigest()

    # Fast cache check: if paper was previously indexed, return instantly in <0.2s!
    if file_hash in PAPER_HASH_STORE:
        existing_id = PAPER_HASH_STORE[file_hash]
        if existing_id in PAPERS_STORE:
            existing_paper = PAPERS_STORE[existing_id]
            if stream:
                async def cached_stream():
                    yield json.dumps({
                        "stage": "completed",
                        "message": "Paper restored instantly from vector cache.",
                        "paper": existing_paper.model_dump(),
                        "isCached": True,
                    }) + "\n"
                return StreamingResponse(cached_stream(), media_type="application/x-ndjson")
            else:
                return {
                    "success": True,
                    "message": "Paper restored instantly from vector cache.",
                    "paper": existing_paper.model_dump(),
                    "isCached": True,
                }

    async def progress_stream():
        try:
            yield json.dumps({"stage": "upload_received", "message": "PDF uploaded to server successfully"}) + "\n"
            await asyncio.sleep(0.05)

            # 1. Extraction
            yield json.dumps({"stage": "extracting", "message": "Extracting text from PDF pages..."}) + "\n"
            pages = extract_pages_from_pdf_bytes(content)
            total_pages = len(pages)

            # Check if PDF is scanned or empty
            if not has_extractable_text(pages):
                yield json.dumps({
                    "stage": "error",
                    "message": "This PDF contains scanned images or no extractable digital text. Please upload a searchable PDF.",
                }) + "\n"
                return

            yield json.dumps({
                "stage": "extracted",
                "message": f"Extracted {total_pages} pages successfully",
                "totalPages": total_pages,
            }) + "\n"
            await asyncio.sleep(0.05)

            # 2. Chunking (Optimal 2000-char semantic windows for academic RAG)
            yield json.dumps({"stage": "chunking", "message": "Applying sliding-window semantic chunking with 200-char overlap..."}) + "\n"
            raw_chunks = chunk_document(pages, chunk_size=2000, overlap=200)
            total_chunks = len(raw_chunks)
            yield json.dumps({
                "stage": "chunked",
                "message": f"Generated {total_chunks} semantic chunks",
                "totalChunks": total_chunks,
            }) + "\n"
            await asyncio.sleep(0.05)

            # 3. Embedding with concurrent batch progress streaming (50 per batch, 3 parallel workers)
            chunk_texts = [c["text"] for c in raw_chunks]
            total_batches = max(1, math.ceil(total_chunks / 50))

            yield json.dumps({
                "stage": "embedding",
                "message": f"Computing dense vector embeddings for {total_chunks} chunks...",
                "totalChunks": total_chunks,
                "totalBatches": total_batches,
                "currentBatch": 1,
                "processedChunks": 0,
            }) + "\n"

            progress_queue: asyncio.Queue = asyncio.Queue()

            def on_batch_progress(completed: int, total: int, batch_num: int, batches: int):
                progress_queue.put_nowait({
                    "stage": "embedding",
                    "message": f"Generating embeddings (batch {batch_num}/{batches} • {completed}/{total} chunks)...",
                    "totalChunks": total,
                    "processedChunks": completed,
                    "currentBatch": batch_num,
                    "totalBatches": batches,
                })

            loop = asyncio.get_running_loop()
            embed_task = loop.run_in_executor(
                None,
                lambda: get_batch_embeddings(chunk_texts, batch_size=50, max_workers=3, on_batch_progress=on_batch_progress)
            )

            while not embed_task.done():
                try:
                    event = await asyncio.wait_for(progress_queue.get(), timeout=0.15)
                    yield json.dumps(event) + "\n"
                except asyncio.TimeoutError:
                    pass

            while not progress_queue.empty():
                event = progress_queue.get_nowait()
                yield json.dumps(event) + "\n"

            embeddings = await embed_task

            # 4. Indexing into Vector Store
            yield json.dumps({"stage": "indexing", "message": "Storing chunks into vector database..."}) + "\n"
            stored_chunks = []
            for idx, raw in enumerate(raw_chunks):
                stored_chunks.append({
                    **raw,
                    "paperId": paper_id,
                    "embedding": embeddings[idx] if idx < len(embeddings) else [],
                })
            PAPER_CHUNKS_STORE[paper_id] = stored_chunks

            # 5. Metadata & Summary
            metadata = PaperMetadata(
                id=paper_id,
                userId=user_id,
                title=clean_title,
                filename=file.filename,
                fileSize=file_size,
                pageCount=total_pages,
                chunkCount=total_chunks,
                createdAt=time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
            )
            PAPERS_STORE[paper_id] = metadata
            PAPER_HASH_STORE[file_hash] = paper_id

            # Generate summary in background/on-the-fly
            summary = generate_paper_summary(paper_id)
            metadata.summary = summary

            yield json.dumps({
                "stage": "completed",
                "message": "Research paper successfully processed and indexed into vector store.",
                "paper": metadata.model_dump(),
            }) + "\n"
        except Exception as err:
            yield json.dumps({"stage": "error", "message": f"Processing failed: {str(err)}"}) + "\n"

    if stream:
        return StreamingResponse(progress_stream(), media_type="application/x-ndjson")

    # Non-streaming processing
    pages = extract_pages_from_pdf_bytes(content)
    if not has_extractable_text(pages):
        raise HTTPException(
            status_code=400,
            detail="This PDF contains scanned images or no extractable digital text. Please upload a searchable PDF."
        )

    raw_chunks = chunk_document(pages, chunk_size=2000, overlap=200)
    chunk_texts = [c["text"] for c in raw_chunks]
    embeddings = get_batch_embeddings(chunk_texts, batch_size=50, max_workers=3)

    stored_chunks = []
    for idx, raw in enumerate(raw_chunks):
        stored_chunks.append({
            **raw,
            "paperId": paper_id,
            "embedding": embeddings[idx] if idx < len(embeddings) else [],
        })
    PAPER_CHUNKS_STORE[paper_id] = stored_chunks

    metadata = PaperMetadata(
        id=paper_id,
        userId=user_id,
        title=clean_title,
        filename=file.filename,
        fileSize=file_size,
        pageCount=len(pages),
        chunkCount=len(stored_chunks),
        createdAt=time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
    )
    PAPERS_STORE[paper_id] = metadata
    PAPER_HASH_STORE[file_hash] = paper_id
    metadata.summary = generate_paper_summary(paper_id)

    return {
        "success": True,
        "message": "Research paper successfully processed and indexed into vector store.",
        "paper": metadata.model_dump(),
    }

# ==================== AGENTIC RAG CHAT ====================

@app.post("/api/chat")
def chat(req: ChatRequest):
    if not req.paperId:
        raise HTTPException(status_code=400, detail="paperId is required")
    if not req.question or not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    
    response = execute_agentic_chat(
        paper_id=req.paperId,
        question=req.question.strip(),
        enable_search_grounding=bool(req.searchGrounding),
    )
    data = response.model_dump()
    # Populate both answer and text for seamless frontend compatibility
    if not data.get("answer"):
        data["answer"] = data.get("text", "")
    return data

# ==================== LIVE VOICE WEBSOCKET ====================

@app.websocket("/api/live-voice")
async def live_voice_endpoint(websocket: WebSocket, paperId: Optional[str] = Query(None)):
    await websocket.accept()
    paper = PAPERS_STORE.get(paperId) if paperId else None
    paper_title = paper.title if paper else "Indexed Research Paper"
    await websocket.send_json({
        "type": "ready",
        "paperTitle": paper_title,
    })
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            if "text" in payload and payload["text"]:
                user_q = payload["text"]
                resp = execute_agentic_chat(paperId or "", user_q)
                ans = resp.text or resp.answer or "I have reviewed your question regarding this paper."
                await websocket.send_json({
                    "type": "text",
                    "text": ans,
                })
                await websocket.send_json({"type": "turnComplete"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "error": str(e)})
            await websocket.close()
        except Exception:
            pass

# ==================== PRODUCTION SPA STATIC SERVING ====================

dist_dir = Path(__file__).resolve().parent.parent / "dist"
if dist_dir.exists():
    assets_dir = dist_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404, detail="API endpoint not found")
        file_path = dist_dir / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        index_file = dist_dir / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Not Found")
