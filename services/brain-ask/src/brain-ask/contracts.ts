export type BrainNamespace = "public" | "private";

export interface QmdResult {
  uri?: string;
  url?: string;
  file?: string;
  id?: string;
  resource?: string;
  title?: string;
  excerpt?: string;
  snippet?: string;
  text?: string;
  content?: string;
  score?: number;
  [key: string]: unknown;
}

export interface QmdPayload {
  results?: QmdResult[];
  items?: QmdResult[];
  [key: string]: unknown;
}

export interface QmdSearchRequest {
  question: string;
  signal: AbortSignal;
}

export interface QmdClient {
  search(request: QmdSearchRequest): Promise<QmdPayload | QmdResult[]>;
}

export interface ModelAnswerRequest {
  question: string;
  context: string;
  signal: AbortSignal;
}

export interface ModelClient {
  answer(request: ModelAnswerRequest): Promise<string>;
}

export interface BrainSource {
  title: string;
  slug: string;
  namespace: BrainNamespace;
  score: number | null;
  excerpt: string;
  href: string;
}

export interface BrainAskSuccess {
  requestId: string;
  answer: string;
  sources: BrainSource[];
}

export type BrainAskErrorCode =
  | "invalid_question"
  | "busy"
  | "retrieval_unavailable"
  | "model_unavailable"
  | "model_timeout";
