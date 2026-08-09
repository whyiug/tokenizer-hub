import type { BackendTokenizeResult } from "@/lib/tokenizer-api";

export const INITIAL_TOKEN_TEXT = "Tokens are the in-game currency of this world.";

export const INITIAL_TOKEN_MODEL_IDS = ["openai/gpt-5.6-sol", "openai/gpt-5", "qwen/qwen3-8b"];

const segmentTexts = ["Tokens", " are", " the", " in", "-game", " currency", " of", " this", " world", "."];
const o200kTokens = [30325, 553, 290, 306, 42553, 18842, 328, 495, 2375, 13];
const qwen3Tokens = [29300, 525, 279, 304, 19395, 11413, 315, 419, 1879, 13];

const buildInitialResult = (
  modelId: string,
  tokenizerKey: string,
  label: string,
  tokens: number[],
): BackendTokenizeResult => {
  let cursor = 0;

  return {
    modelId,
    mode: "raw",
    serializedText: INITIAL_TOKEN_TEXT,
    tokenizerKey,
    label,
    count: tokens.length,
    tokens,
    segments: tokens.map((token, index) => {
      const text = segmentTexts[index];
      const textStart = cursor;
      cursor += text.length;
      return {
        index,
        id: token,
        ids: [token],
        text,
        textStart,
        textEnd: cursor,
        tokenStart: index,
        tokenEnd: index + 1,
      };
    }),
  };
};

export const INITIAL_TOKEN_RESULTS: BackendTokenizeResult[] = [
  buildInitialResult("openai/gpt-5.6-sol", "tiktoken:o200k_base", "o200k_base", o200kTokens),
  buildInitialResult("openai/gpt-5", "tiktoken:o200k_base", "o200k_base", o200kTokens),
  buildInitialResult("qwen/qwen3-8b", "hf:qwen3", "Qwen/Qwen3-8B", qwen3Tokens),
];
