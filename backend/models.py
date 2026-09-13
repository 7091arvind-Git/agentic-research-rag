from typing import List, Optional
from pydantic import BaseModel, Field

class User(BaseModel):
    id: str
    name: str
    email: str
    createdAt: str

class PaperSummary(BaseModel):
    overview: str
    methodology: str
    keyFindings: List[str] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
    conclusion: Optional[str] = None

class PaperMetadata(BaseModel):
    id: str
    userId: str
    title: str
    filename: str
    fileSize: int
    pageCount: int
    chunkCount: int
    createdAt: str
    summary: Optional[PaperSummary] = None

class CitationSource(BaseModel):
    pageNumber: int
    chunkIndex: int
    textExcerpt: str
    similarityScore: float
    fullText: Optional[str] = None

class WebGroundingSource(BaseModel):
    title: str
    url: str

class AgentReasoning(BaseModel):
    retrievalRequired: bool
    intent: str
    decisionExplanation: str
    queryAnalyzed: str
    retrievedCount: int
    topScore: Optional[float] = None
    queryRefined: Optional[bool] = False
    refinedQuery: Optional[str] = None
    searchGroundingUsed: Optional[bool] = False
    groundingQueries: Optional[List[str]] = Field(default_factory=list)

class ChatMessage(BaseModel):
    id: str
    sender: str
    text: str
    answer: Optional[str] = None
    timestamp: str
    agentReasoning: Optional[AgentReasoning] = None
    sources: Optional[List[CitationSource]] = None
    webSources: Optional[List[WebGroundingSource]] = None

class IndexedChunk(BaseModel):
    id: str
    chunkIndex: int
    pageNumber: int
    charLength: int
    text: str

class ChatRequest(BaseModel):
    paperId: str
    question: str
    searchGrounding: Optional[bool] = False

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str
