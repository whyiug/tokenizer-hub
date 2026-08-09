export type BackendTokenSegment = {
  index: number;
  id: number;
  ids?: number[];
  text: string;
  textStart?: number;
  textEnd?: number;
  tokenStart?: number;
  tokenEnd?: number;
  piece?: string;
  pieces?: string[];
};

export type BackendTokenizeResult = {
  modelId: string;
  mode: "raw" | "chat" | "tools";
  serializedText: string;
  tokenizerKey: string;
  label: string;
  count: number;
  tokens: number[];
  segments: BackendTokenSegment[];
};

export type BackendUnavailableResult = {
  modelId: string;
  error: {
    code: "unknown_model" | "unsupported_mode" | "renderer_failed" | "tokenizer_unavailable" | "registry_not_ready";
    message: string;
  };
  unavailable: true;
};

export type BackendBatchResult = {
  results: Array<BackendTokenizeResult | BackendUnavailableResult>;
};

export type StructuredMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type TokenizeContent =
  | { mode: "raw"; text: string }
  | { mode: "chat"; messages: StructuredMessage[] }
  | { mode: "tools"; messages: StructuredMessage[]; tools: Record<string, unknown>[] };

export type TokenizeInput = TokenizeContent & { modelId: string };
export type BatchTokenizeInput = TokenizeContent & { modelIds: string[] };

export const DEFAULT_TOKENIZER_API_BASE =
  process.env.NODE_ENV === "production" ? "/api" : "http://127.0.0.1:8000";

const postJson = async <T>(path: string, body: unknown, signal?: AbortSignal, apiBase = DEFAULT_TOKENIZER_API_BASE): Promise<T> => {
  const normalizedBase = apiBase.replace(/\/$/, "");
  const response = await fetch(`${normalizedBase}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<T>;
};

export const tokenizeModel = (input: TokenizeInput, signal?: AbortSignal) =>
  postJson<BackendTokenizeResult>("/v1/tokenize", input, signal);

export const tokenizeModels = (input: BatchTokenizeInput, signal?: AbortSignal, apiBase?: string) =>
  postJson<BackendBatchResult>("/v1/tokenize/batch", input, signal, apiBase);

export const isUnavailableResult = (
  result: BackendTokenizeResult | BackendUnavailableResult,
): result is BackendUnavailableResult => "unavailable" in result;
