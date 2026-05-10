export type TokenizerFamily =
  | "o200k"
  | "cl100k"
  | "p50k"
  | "gpt2"
  | "qwen"
  | "deepseek"
  | "minimax"
  | "mimo"
  | "glm"
  | "llama";

export type TiktokenEncodingName = "o200k_base" | "cl100k_base" | "p50k_base" | "gpt2";

export type HfTokenizerKey =
  | "qwen3"
  | "deepseek-v31"
  | "deepseek-r1"
  | "minimax-m27"
  | "mimo-v25-pro"
  | "mimo-v25"
  | "glm5"
  | "llama2"
  | "llama2-70b"
  | "llama3";

export type TokenizerSpec =
  | {
      type: "tiktoken";
      key: `tiktoken:${TiktokenEncodingName}`;
      encoding: TiktokenEncodingName;
    }
  | {
      type: "hf";
      key: `hf:${HfTokenizerKey}`;
      asset: HfTokenizerKey;
      repo: string;
    };

export type ModelEntry = {
  id: string;
  name: string;
  provider: string;
  family: TokenizerFamily;
  tokenizer: TokenizerSpec;
  context: number;
  open: boolean;
  region: "Global" | "China";
  tags: string[];
};

const model = (
  id: string,
  name: string,
  provider: string,
  family: TokenizerFamily,
  tokenizer: TokenizerSpec,
  context: number,
  open: boolean,
  region: "Global" | "China",
  tags: string[] = [],
): ModelEntry => ({
  id,
  name,
  provider,
  family,
  tokenizer,
  context,
  open,
  region,
  tags,
});

export const MODEL_SNAPSHOT_DATE = "2026-05-10";

const tiktoken = (encoding: TiktokenEncodingName): TokenizerSpec => ({
  type: "tiktoken",
  key: `tiktoken:${encoding}`,
  encoding,
});

const hf = (asset: HfTokenizerKey, repo: string): TokenizerSpec => ({
  type: "hf",
  key: `hf:${asset}`,
  asset,
  repo,
});

const TOKENIZERS = {
  o200k: tiktoken("o200k_base"),
  cl100k: tiktoken("cl100k_base"),
  p50k: tiktoken("p50k_base"),
  gpt2: tiktoken("gpt2"),
  qwen3: hf("qwen3", "Qwen/Qwen3-8B"),
  deepseekV31: hf("deepseek-v31", "deepseek-ai/DeepSeek-V3.1-Base"),
  deepseekR1: hf("deepseek-r1", "deepseek-ai/DeepSeek-R1"),
  minimaxM27: hf("minimax-m27", "MiniMaxAI/MiniMax-M2.7"),
  mimoV25Pro: hf("mimo-v25-pro", "XiaomiMiMo/MiMo-V2.5-Pro"),
  mimoV25: hf("mimo-v25", "XiaomiMiMo/MiMo-V2.5"),
  glm5: hf("glm5", "zai-org/GLM-5.1"),
  llama2: hf("llama2", "NousResearch/Llama-2-7b-chat-hf"),
  llama2_70b: hf("llama2-70b", "TheBloke/Llama-2-70B-Chat-GPTQ"),
  llama3: hf("llama3", "NousResearch/Meta-Llama-3-8B-Instruct"),
} as const;

export const MODELS: ModelEntry[] = [
  model("openai/gpt-5.5", "GPT-5.5", "OpenAI", "o200k", TOKENIZERS.o200k, 1_050_000, false, "Global", ["reasoning"]),
  model("openai/gpt-5.5-pro", "GPT-5.5 pro", "OpenAI", "o200k", TOKENIZERS.o200k, 1_050_000, false, "Global", ["reasoning"]),
  model("openai/gpt-5.4", "GPT-5.4", "OpenAI", "o200k", TOKENIZERS.o200k, 1_050_000, false, "Global", ["reasoning"]),
  model("openai/gpt-5.4-mini", "GPT-5.4 mini", "OpenAI", "o200k", TOKENIZERS.o200k, 400_000, false, "Global"),
  model("openai/gpt-5.4-nano", "GPT-5.4 nano", "OpenAI", "o200k", TOKENIZERS.o200k, 400_000, false, "Global"),
  model("openai/gpt-5", "GPT-5", "OpenAI", "o200k", TOKENIZERS.o200k, 400_000, false, "Global", ["reasoning"]),
  model("openai/gpt-5-mini", "GPT-5 mini", "OpenAI", "o200k", TOKENIZERS.o200k, 400_000, false, "Global"),
  model("openai/gpt-5-nano", "GPT-5 nano", "OpenAI", "o200k", TOKENIZERS.o200k, 400_000, false, "Global"),
  model("openai/gpt-4.1", "GPT-4.1", "OpenAI", "o200k", TOKENIZERS.o200k, 1_047_576, false, "Global"),
  model("openai/gpt-4.1-mini", "GPT-4.1 mini", "OpenAI", "o200k", TOKENIZERS.o200k, 1_047_576, false, "Global"),
  model("openai/gpt-4o", "GPT-4o", "OpenAI", "o200k", TOKENIZERS.o200k, 128_000, false, "Global"),
  model("openai/gpt-4o-mini", "GPT-4o mini", "OpenAI", "o200k", TOKENIZERS.o200k, 128_000, false, "Global"),
  model("openai/o4-mini", "o4 mini", "OpenAI", "o200k", TOKENIZERS.o200k, 200_000, false, "Global", ["reasoning"]),
  model("openai/o3", "o3", "OpenAI", "o200k", TOKENIZERS.o200k, 200_000, false, "Global", ["reasoning"]),
  model("openai/o3-mini", "o3 mini", "OpenAI", "o200k", TOKENIZERS.o200k, 200_000, false, "Global", ["reasoning"]),
  model("openai/gpt-oss-120b", "gpt-oss 120B", "OpenAI", "o200k", TOKENIZERS.o200k, 128_000, true, "Global"),
  model("openai/gpt-oss-20b", "gpt-oss 20B", "OpenAI", "o200k", TOKENIZERS.o200k, 128_000, true, "Global"),
  model("openai/gpt-4", "GPT-4", "OpenAI", "cl100k", TOKENIZERS.cl100k, 8_192, false, "Global", ["legacy"]),
  model("openai/gpt-4-turbo", "GPT-4 Turbo", "OpenAI", "cl100k", TOKENIZERS.cl100k, 128_000, false, "Global", ["legacy"]),
  model("openai/gpt-3.5-turbo", "GPT-3.5 Turbo", "OpenAI", "cl100k", TOKENIZERS.cl100k, 16_385, false, "Global", ["legacy"]),
  model("openai/text-davinci-003", "text-davinci-003", "OpenAI", "p50k", TOKENIZERS.p50k, 4_097, false, "Global", ["legacy"]),
  model("openai/code-davinci-002", "code-davinci-002", "OpenAI", "p50k", TOKENIZERS.p50k, 8_001, false, "Global", ["legacy", "code"]),

  model("qwen/qwen3-235b-a22b", "Qwen3 235B A22B", "Qwen", "qwen", TOKENIZERS.qwen3, 262_144, true, "China"),
  model("qwen/qwen3-32b", "Qwen3 32B", "Qwen", "qwen", TOKENIZERS.qwen3, 131_072, true, "China"),
  model("qwen/qwen3-14b", "Qwen3 14B", "Qwen", "qwen", TOKENIZERS.qwen3, 131_072, true, "China"),
  model("qwen/qwen3-8b", "Qwen3 8B", "Qwen", "qwen", TOKENIZERS.qwen3, 131_072, true, "China"),

  model("deepseek/deepseek-v3.1", "DeepSeek V3.1", "DeepSeek", "deepseek", TOKENIZERS.deepseekV31, 163_840, true, "China"),
  model("deepseek/deepseek-r1", "DeepSeek R1", "DeepSeek", "deepseek", TOKENIZERS.deepseekR1, 128_000, true, "China", ["reasoning"]),
  model("deepseek/deepseek-r1-0528", "DeepSeek R1 0528", "DeepSeek", "deepseek", TOKENIZERS.deepseekR1, 163_840, true, "China", ["reasoning"]),

  model("minimax/minimax-m2.7", "MiniMax M2.7", "MiniMax", "minimax", TOKENIZERS.minimaxM27, 196_608, true, "China"),
  model("minimax/minimax-m2.5", "MiniMax M2.5", "MiniMax", "minimax", TOKENIZERS.minimaxM27, 196_608, true, "China"),

  model("xiaomi/mimo-v2.5-pro", "MiMo V2.5 Pro", "Xiaomi", "mimo", TOKENIZERS.mimoV25Pro, 1_048_576, true, "China"),
  model("xiaomi/mimo-v2.5", "MiMo V2.5", "Xiaomi", "mimo", TOKENIZERS.mimoV25, 1_048_576, true, "China"),

  model("z-ai/glm-5.1", "GLM 5.1", "Z.ai", "glm", TOKENIZERS.glm5, 202_752, true, "China"),
  model("z-ai/glm-5", "GLM 5", "Z.ai", "glm", TOKENIZERS.glm5, 202_752, true, "China"),
  model("z-ai/glm-4.7-flash", "GLM 4.7 Flash", "Z.ai", "glm", TOKENIZERS.glm5, 202_752, true, "China"),

  model("meta/llama-3.1-8b-instruct", "Llama 3.1 8B Instruct", "Meta", "llama", TOKENIZERS.llama3, 131_072, true, "Global"),
  model("meta/llama-2-70b-chat", "Llama 2 70B Chat", "Meta", "llama", TOKENIZERS.llama2_70b, 4_096, true, "Global", ["legacy"]),
  model("meta/llama-2-7b-chat", "Llama 2 7B Chat", "Meta", "llama", TOKENIZERS.llama2, 4_096, true, "Global", ["legacy"]),
];

export const DEFAULT_MODEL = MODELS.find((model) => model.id === "openai/gpt-3.5-turbo") ?? MODELS[0];
