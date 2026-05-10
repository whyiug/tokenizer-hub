export type BackendTokenSegment = {
  index: number;
  id: number;
  text: string;
  piece?: string;
};

export type BackendTokenizeResult = {
  modelId: string;
  tokenizerKey: string;
  label: string;
  count: number;
  tokens: number[];
  segments: BackendTokenSegment[];
};

export type BackendUnavailableResult = {
  modelId: string;
  error: string;
  unavailable: true;
};

export type BackendBatchResult = {
  results: Array<BackendTokenizeResult | BackendUnavailableResult>;
};

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

export const tokenizeModel = (modelId: string, text: string, signal?: AbortSignal) =>
  postJson<BackendTokenizeResult>("/v1/tokenize", { modelId, text }, signal);

export const tokenizeModels = (modelIds: string[], text: string, signal?: AbortSignal, apiBase?: string) =>
  postJson<BackendBatchResult>("/v1/tokenize/batch", { modelIds, text }, signal, apiBase);

export const isUnavailableResult = (
  result: BackendTokenizeResult | BackendUnavailableResult,
): result is BackendUnavailableResult => "unavailable" in result;
