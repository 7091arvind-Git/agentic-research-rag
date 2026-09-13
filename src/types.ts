export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface PaperSummary {
  overview: string;
  methodology: string;
  keyFindings: string[];
  limitations: string[];
  conclusion?: string;
}

export interface Paper {
  id: string;
  userId: string;
  title: string;
  filename: string;
  fileSize: number;
  pageCount: number;
  chunkCount: number;
  createdAt: string;
  summary?: PaperSummary;
}

export interface CitationSource {
  pageNumber: number;
  chunkIndex: number;
  textExcerpt: string;
  similarityScore: number;
}

export interface WebGroundingSource {
  title: string;
  url: string;
}

export interface AgentReasoning {
  retrievalRequired: boolean;
  intent: string;
  decisionExplanation: string;
  queryAnalyzed: string;
  retrievedCount: number;
  topScore?: number;
  queryRefined?: boolean;
  refinedQuery?: string;
  searchGroundingUsed?: boolean;
  groundingQueries?: string[];
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  agentReasoning?: AgentReasoning;
  sources?: CitationSource[];
  webSources?: WebGroundingSource[];
}

export interface IndexedChunk {
  id: string;
  chunkIndex: number;
  pageNumber: number;
  charLength: number;
  text: string;
}
