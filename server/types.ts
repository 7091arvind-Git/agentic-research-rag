export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface PaperChunk {
  id: string;
  paperId: string;
  chunkIndex: number;
  pageNumber: number;
  text: string;
  embedding?: number[];
}

export interface PaperSummary {
  overview: string;
  methodology: string;
  keyFindings: string[];
  limitations: string[];
  conclusion?: string;
}

export interface PaperMetadata {
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

export interface ChatResponse {
  answer: string;
  agentReasoning: AgentReasoning;
  sources: CitationSource[];
  webSources?: WebGroundingSource[];
}
