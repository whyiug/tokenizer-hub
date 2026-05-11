import type { BackendTokenizeResult } from "@/lib/tokenizer-api";

export const INITIAL_TOKEN_TEXT =
  "<|im_start|>system\nYou are a helpful assistant<|im_end|>\n<|im_start|>user\nTokens are the in-game currency of this world.<|im_end|>\n<|im_start|>assistant\n";

export const INITIAL_TOKEN_MODEL_IDS = ["openai/gpt-3.5-turbo", "openai/gpt-4.1", "openai/gpt-4"];

const segmentTexts = [
  "<",
  "|",
  "im",
  "_start",
  "|",
  ">",
  "system",
  "\n",
  "You",
  " are",
  " a",
  " helpful",
  " assistant",
  "<",
  "|",
  "im",
  "_end",
  "|",
  ">\n",
  "<",
  "|",
  "im",
  "_start",
  "|",
  ">",
  "user",
  "\n",
  "Tokens",
  " are",
  " the",
  " in",
  "-game",
  " currency",
  " of",
  " this",
  " world",
  ".<",
  "|",
  "im",
  "_end",
  "|",
  ">\n",
  "<",
  "|",
  "im",
  "_start",
  "|",
  ">",
  "assistant",
  "\n",
];

const cl100kTokens = [
  27, 91, 318, 5011, 91, 29, 9125, 198, 2675, 527, 264, 11190, 18328, 27, 91, 318, 6345, 91, 397, 27, 91,
  318, 5011, 91, 29, 882, 198, 30400, 527, 279, 304, 19959, 11667, 315, 420, 1917, 16134, 91, 318, 6345,
  91, 397, 27, 91, 318, 5011, 91, 29, 78191, 198,
];

const o200kTokens = [
  27, 91, 321, 10949, 91, 29, 17360, 198, 3575, 553, 261, 10297, 29186, 27, 91, 321, 13707, 91, 523, 27,
  91, 321, 10949, 91, 29, 1428, 198, 30325, 553, 290, 306, 42553, 18842, 328, 495, 2375, 30502, 91, 321,
  13707, 91, 523, 27, 91, 321, 10949, 91, 29, 173781, 198,
];

const buildInitialResult = (
  modelId: string,
  tokenizerKey: string,
  label: string,
  tokens: number[],
): BackendTokenizeResult => {
  let cursor = 0;

  return {
    modelId,
    tokenizerKey,
    label,
    count: tokens.length,
    tokens,
    segments: tokens.map((token, index) => {
      const text = segmentTexts[index] ?? "";
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
  buildInitialResult("openai/gpt-3.5-turbo", "tiktoken:cl100k_base", "cl100k_base", cl100kTokens),
  buildInitialResult("openai/gpt-4.1", "tiktoken:o200k_base", "o200k_base", o200kTokens),
  buildInitialResult("openai/gpt-4", "tiktoken:cl100k_base", "cl100k_base", cl100kTokens),
];
