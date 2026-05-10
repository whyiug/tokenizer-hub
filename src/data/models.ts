export type Exactness = "Exact" | "Estimated";

export type TokenizerFamily =
  | "o200k"
  | "cl100k"
  | "p50k"
  | "gpt2"
  | "qwen"
  | "deepseek"
  | "llama"
  | "mistral"
  | "gemma"
  | "claude"
  | "gemini"
  | "kimi"
  | "grok"
  | "other";

export type ModelEntry = {
  id: string;
  name: string;
  provider: string;
  family: TokenizerFamily;
  context: number;
  open: boolean;
  exactness: Exactness;
  region: "Global" | "China";
  tags: string[];
};

const model = (
  id: string,
  name: string,
  provider: string,
  family: TokenizerFamily,
  context: number,
  open: boolean,
  exactness: Exactness,
  region: "Global" | "China",
  tags: string[] = [],
): ModelEntry => ({
  id,
  name,
  provider,
  family,
  context,
  open,
  exactness,
  region,
  tags,
});

export const MODEL_SNAPSHOT_DATE = "2026-05-10";

export const MODELS: ModelEntry[] = [
  model("openai/gpt-5.5", "GPT-5.5", "OpenAI", "o200k", 1_048_576, false, "Exact", "Global", ["reasoning"]),
  model("openai/gpt-5.5-mini", "GPT-5.5 mini", "OpenAI", "o200k", 1_048_576, false, "Exact", "Global"),
  model("openai/gpt-5", "GPT-5", "OpenAI", "o200k", 1_048_576, false, "Exact", "Global", ["reasoning"]),
  model("openai/gpt-5-mini", "GPT-5 mini", "OpenAI", "o200k", 400_000, false, "Exact", "Global"),
  model("openai/gpt-5-nano", "GPT-5 nano", "OpenAI", "o200k", 400_000, false, "Exact", "Global"),
  model("openai/gpt-4.1", "GPT-4.1", "OpenAI", "o200k", 1_047_576, false, "Exact", "Global"),
  model("openai/gpt-4.1-mini", "GPT-4.1 mini", "OpenAI", "o200k", 1_047_576, false, "Exact", "Global"),
  model("openai/gpt-4o", "GPT-4o", "OpenAI", "o200k", 128_000, false, "Exact", "Global"),
  model("openai/gpt-4o-mini", "GPT-4o mini", "OpenAI", "o200k", 128_000, false, "Exact", "Global"),
  model("openai/o4-mini", "o4 mini", "OpenAI", "o200k", 200_000, false, "Exact", "Global", ["reasoning"]),
  model("openai/o3", "o3", "OpenAI", "o200k", 200_000, false, "Exact", "Global", ["reasoning"]),
  model("openai/o3-mini", "o3 mini", "OpenAI", "o200k", 200_000, false, "Exact", "Global", ["reasoning"]),
  model("openai/gpt-oss-120b", "gpt-oss 120B", "OpenAI", "o200k", 128_000, true, "Exact", "Global"),
  model("openai/gpt-oss-20b", "gpt-oss 20B", "OpenAI", "o200k", 128_000, true, "Exact", "Global"),
  model("openai/gpt-4", "GPT-4", "OpenAI", "cl100k", 8_192, false, "Exact", "Global", ["legacy"]),
  model("openai/gpt-4-turbo", "GPT-4 Turbo", "OpenAI", "cl100k", 128_000, false, "Exact", "Global", ["legacy"]),
  model("openai/gpt-3.5-turbo", "GPT-3.5 Turbo", "OpenAI", "cl100k", 16_385, false, "Exact", "Global", ["legacy"]),
  model("openai/text-davinci-003", "text-davinci-003", "OpenAI", "p50k", 4_097, false, "Estimated", "Global", ["legacy"]),
  model("openai/code-davinci-002", "code-davinci-002", "OpenAI", "p50k", 8_001, false, "Estimated", "Global", ["legacy", "code"]),

  model("anthropic/claude-opus-4.1", "Claude Opus 4.1", "Anthropic", "claude", 200_000, false, "Estimated", "Global", ["reasoning"]),
  model("anthropic/claude-sonnet-4.5", "Claude Sonnet 4.5", "Anthropic", "claude", 1_000_000, false, "Estimated", "Global"),
  model("anthropic/claude-haiku-4.5", "Claude Haiku 4.5", "Anthropic", "claude", 200_000, false, "Estimated", "Global"),
  model("anthropic/claude-3.7-sonnet", "Claude 3.7 Sonnet", "Anthropic", "claude", 200_000, false, "Estimated", "Global"),
  model("anthropic/claude-3.5-haiku", "Claude 3.5 Haiku", "Anthropic", "claude", 200_000, false, "Estimated", "Global"),

  model("google/gemini-3.1-pro", "Gemini 3.1 Pro", "Google", "gemini", 1_048_576, false, "Estimated", "Global"),
  model("google/gemini-3.1-flash", "Gemini 3.1 Flash", "Google", "gemini", 1_048_576, false, "Estimated", "Global"),
  model("google/gemini-3.1-flash-lite", "Gemini 3.1 Flash Lite", "Google", "gemini", 1_048_576, false, "Estimated", "Global"),
  model("google/gemini-2.5-pro", "Gemini 2.5 Pro", "Google", "gemini", 1_048_576, false, "Estimated", "Global"),
  model("google/gemini-2.5-flash", "Gemini 2.5 Flash", "Google", "gemini", 1_048_576, false, "Estimated", "Global"),
  model("google/gemma-3-27b-it", "Gemma 3 27B IT", "Google", "gemma", 128_000, true, "Estimated", "Global"),
  model("google/gemma-3-12b-it", "Gemma 3 12B IT", "Google", "gemma", 128_000, true, "Estimated", "Global"),
  model("google/gemma-2-27b-it", "Gemma 2 27B IT", "Google", "gemma", 8_192, true, "Estimated", "Global"),

  model("qwen/qwen3.6-flash", "Qwen3.6 Flash", "Qwen", "qwen", 1_000_000, false, "Estimated", "China"),
  model("qwen/qwen3.5-plus", "Qwen3.5 Plus", "Qwen", "qwen", 1_000_000, false, "Estimated", "China"),
  model("qwen/qwen3-max", "Qwen3 Max", "Qwen", "qwen", 262_144, false, "Estimated", "China"),
  model("qwen/qwen3-235b-a22b", "Qwen3 235B A22B", "Qwen", "qwen", 262_144, true, "Estimated", "China"),
  model("qwen/qwen3-72b", "Qwen3 72B", "Qwen", "qwen", 131_072, true, "Estimated", "China"),
  model("qwen/qwen3-32b", "Qwen3 32B", "Qwen", "qwen", 131_072, true, "Estimated", "China"),
  model("qwen/qwen3-14b", "Qwen3 14B", "Qwen", "qwen", 131_072, true, "Estimated", "China"),
  model("qwen/qwen3-8b", "Qwen3 8B", "Qwen", "qwen", 131_072, true, "Estimated", "China"),
  model("qwen/qwen2.5-72b-instruct", "Qwen2.5 72B Instruct", "Qwen", "qwen", 131_072, true, "Estimated", "China"),
  model("qwen/qwen2.5-coder-32b-instruct", "Qwen2.5 Coder 32B", "Qwen", "qwen", 131_072, true, "Estimated", "China", ["code"]),
  model("qwen/qwen3-embedding-8b", "Qwen3 Embedding 8B", "Qwen", "qwen", 32_768, true, "Estimated", "China", ["embedding"]),

  model("xiaomi/mimo-v2.5-pro", "MiMo V2.5 Pro", "Xiaomi", "other", 1_048_576, false, "Estimated", "China"),
  model("xiaomi/mimo-v2.5", "MiMo V2.5", "Xiaomi", "other", 1_048_576, false, "Estimated", "China"),
  model("xiaomi/mimo-v2-omni", "MiMo V2 Omni", "Xiaomi", "other", 262_144, false, "Estimated", "China"),
  model("xiaomi/mimo-v2-pro", "MiMo V2 Pro", "Xiaomi", "other", 1_048_576, false, "Estimated", "China"),
  model("xiaomi/mimo-v2-flash", "MiMo V2 Flash", "Xiaomi", "other", 262_144, false, "Estimated", "China"),

  model("deepseek/deepseek-v4-pro", "DeepSeek V4 Pro", "DeepSeek", "deepseek", 1_048_576, false, "Estimated", "China"),
  model("deepseek/deepseek-v4-flash", "DeepSeek V4 Flash", "DeepSeek", "deepseek", 1_048_576, false, "Estimated", "China"),
  model("deepseek/deepseek-v3.2-speciale", "DeepSeek V3.2 Speciale", "DeepSeek", "deepseek", 163_840, true, "Estimated", "China"),
  model("deepseek/deepseek-v3.2", "DeepSeek V3.2", "DeepSeek", "deepseek", 128_000, true, "Estimated", "China"),
  model("deepseek/deepseek-v3.1-terminus", "DeepSeek V3.1 Terminus", "DeepSeek", "deepseek", 163_840, true, "Estimated", "China"),
  model("deepseek/deepseek-chat-v3.1", "DeepSeek V3.1", "DeepSeek", "deepseek", 32_768, true, "Estimated", "China"),
  model("deepseek/deepseek-r1", "DeepSeek R1", "DeepSeek", "deepseek", 128_000, true, "Estimated", "China", ["reasoning"]),
  model("deepseek/deepseek-r1-0528", "DeepSeek R1 0528", "DeepSeek", "deepseek", 163_840, true, "Estimated", "China", ["reasoning"]),
  model("deepseek/deepseek-v3", "DeepSeek V3", "DeepSeek", "deepseek", 128_000, true, "Estimated", "China"),
  model("deepseek/deepseek-coder-v2", "DeepSeek Coder V2", "DeepSeek", "deepseek", 128_000, true, "Estimated", "China", ["code"]),
  model("deepseek/deepseek-r1-distill-qwen-32b", "DeepSeek R1 Distill Qwen 32B", "DeepSeek", "qwen", 32_768, true, "Estimated", "China", ["reasoning"]),
  model("deepseek/deepseek-r1-distill-llama-70b", "DeepSeek R1 Distill Llama 70B", "DeepSeek", "llama", 131_072, true, "Estimated", "China", ["reasoning"]),

  model("moonshotai/kimi-k2.6", "Kimi K2.6", "Moonshot", "kimi", 262_144, false, "Estimated", "China"),
  model("moonshotai/kimi-k2.5", "Kimi K2.5", "Moonshot", "kimi", 262_144, false, "Estimated", "China"),
  model("moonshotai/kimi-k2-thinking", "Kimi K2 Thinking", "Moonshot", "kimi", 262_144, false, "Estimated", "China", ["reasoning"]),
  model("moonshotai/kimi-k2-0905", "Kimi K2 0905", "Moonshot", "kimi", 262_144, false, "Estimated", "China"),
  model("moonshotai/kimi-k2", "Kimi K2 0711", "Moonshot", "kimi", 131_072, false, "Estimated", "China"),
  model("moonshot/kimi-k2", "Kimi K2", "Moonshot", "kimi", 262_144, false, "Estimated", "China"),
  model("moonshot/kimi-latest", "Kimi Latest", "Moonshot", "kimi", 262_144, false, "Estimated", "China"),
  model("moonshot/moonlight-16b-a3b", "Moonlight 16B A3B", "Moonshot", "kimi", 128_000, true, "Estimated", "China"),
  model("z-ai/glm-5.1", "GLM 5.1", "Z.ai", "other", 202_752, false, "Estimated", "China"),
  model("z-ai/glm-5v-turbo", "GLM 5V Turbo", "Z.ai", "other", 202_752, false, "Estimated", "China"),
  model("z-ai/glm-5-turbo", "GLM 5 Turbo", "Z.ai", "other", 202_752, false, "Estimated", "China"),
  model("z-ai/glm-5", "GLM 5", "Z.ai", "other", 202_752, false, "Estimated", "China"),
  model("z-ai/glm-4.7-flash", "GLM 4.7 Flash", "Z.ai", "other", 202_752, false, "Estimated", "China"),
  model("z-ai/glm-4.7", "GLM 4.7", "Z.ai", "other", 202_752, false, "Estimated", "China"),
  model("z-ai/glm-4.6", "GLM-4.6", "Z.ai", "other", 200_000, false, "Estimated", "China"),
  model("z-ai/glm-4.6v", "GLM-4.6V", "Z.ai", "other", 131_072, false, "Estimated", "China"),
  model("z-ai/glm-4.5", "GLM-4.5", "Z.ai", "other", 128_000, false, "Estimated", "China"),
  model("z-ai/glm-4.5-air", "GLM-4.5 Air", "Z.ai", "other", 128_000, false, "Estimated", "China"),
  model("baidu/ernie-4.5", "ERNIE 4.5", "Baidu", "other", 128_000, false, "Estimated", "China"),
  model("baidu/ernie-x1", "ERNIE X1", "Baidu", "other", 128_000, false, "Estimated", "China", ["reasoning"]),
  model("minimax/minimax-m2.7", "MiniMax M2.7", "MiniMax", "other", 196_608, false, "Estimated", "China"),
  model("minimax/minimax-m2.5", "MiniMax M2.5", "MiniMax", "other", 196_608, false, "Estimated", "China"),
  model("minimax/minimax-m2-her", "MiniMax M2-her", "MiniMax", "other", 65_536, false, "Estimated", "China"),
  model("minimax/minimax-m2.1", "MiniMax M2.1", "MiniMax", "other", 196_608, false, "Estimated", "China"),
  model("minimax/minimax-m2", "MiniMax M2", "MiniMax", "other", 196_608, false, "Estimated", "China"),
  model("minimax/minimax-m1", "MiniMax M1", "MiniMax", "other", 1_000_000, false, "Estimated", "China", ["reasoning"]),
  model("minimax/minimax-01", "MiniMax 01", "MiniMax", "other", 1_000_000, false, "Estimated", "China"),
  model("bytedance/seed-1.6", "Seed 1.6", "ByteDance", "other", 256_000, false, "Estimated", "China"),
  model("tencent/hunyuan-t1", "Hunyuan T1", "Tencent", "other", 256_000, false, "Estimated", "China"),
  model("internlm/internlm3-8b-instruct", "InternLM3 8B", "InternLM", "other", 32_768, true, "Estimated", "China"),
  model("baichuan/baichuan4-turbo", "Baichuan4 Turbo", "Baichuan", "other", 128_000, false, "Estimated", "China"),
  model("01-ai/yi-large", "Yi Large", "01.AI", "other", 200_000, false, "Estimated", "China"),
  model("01-ai/yi-1.5-34b-chat", "Yi 1.5 34B Chat", "01.AI", "other", 32_768, true, "Estimated", "China"),

  model("meta/llama-4-maverick", "Llama 4 Maverick", "Meta", "llama", 1_000_000, true, "Estimated", "Global"),
  model("meta/llama-4-scout", "Llama 4 Scout", "Meta", "llama", 10_000_000, true, "Estimated", "Global"),
  model("meta/llama-3.3-70b-instruct", "Llama 3.3 70B Instruct", "Meta", "llama", 131_072, true, "Estimated", "Global"),
  model("meta/llama-3.1-405b-instruct", "Llama 3.1 405B Instruct", "Meta", "llama", 131_072, true, "Estimated", "Global"),
  model("meta/llama-3.1-8b-instruct", "Llama 3.1 8B Instruct", "Meta", "llama", 131_072, true, "Estimated", "Global"),
  model("meta/llama-2-70b-chat", "Llama 2 70B Chat", "Meta", "llama", 4_096, true, "Estimated", "Global", ["legacy"]),
  model("meta/llama-2-13b-chat", "Llama 2 13B Chat", "Meta", "llama", 4_096, true, "Estimated", "Global", ["legacy"]),
  model("meta/llama-2-7b-chat", "Llama 2 7B Chat", "Meta", "llama", 4_096, true, "Estimated", "Global", ["legacy"]),
  model("meta/llama-65b", "LLaMA 65B", "Meta", "llama", 2_048, true, "Estimated", "Global", ["legacy"]),
  model("mistral/mistral-medium-3.5", "Mistral Medium 3.5", "Mistral", "mistral", 262_144, false, "Estimated", "Global"),
  model("mistral/mistral-large-2", "Mistral Large 2", "Mistral", "mistral", 128_000, false, "Estimated", "Global"),
  model("mistral/codestral", "Codestral", "Mistral", "mistral", 256_000, false, "Estimated", "Global", ["code"]),
  model("mistral/mixtral-8x22b", "Mixtral 8x22B", "Mistral", "mistral", 65_536, true, "Estimated", "Global"),
  model("xai/grok-4.3", "Grok 4.3", "xAI", "grok", 1_000_000, false, "Estimated", "Global"),
  model("xai/grok-4", "Grok 4", "xAI", "grok", 256_000, false, "Estimated", "Global"),
  model("cohere/command-a", "Command A", "Cohere", "other", 256_000, false, "Estimated", "Global"),
  model("cohere/command-r-plus", "Command R+", "Cohere", "other", 128_000, false, "Estimated", "Global"),
  model("nvidia/nemotron-ultra-253b", "Nemotron Ultra 253B", "NVIDIA", "llama", 128_000, true, "Estimated", "Global"),
  model("microsoft/phi-4", "Phi-4", "Microsoft", "other", 16_384, true, "Estimated", "Global"),
  model("amazon/nova-pro", "Nova Pro", "Amazon", "other", 300_000, false, "Estimated", "Global"),
  model("perplexity/sonar-pro", "Sonar Pro", "Perplexity", "llama", 200_000, false, "Estimated", "Global"),
  model("jina/jina-embeddings-v4", "Jina Embeddings v4", "Jina", "other", 32_768, true, "Estimated", "Global", ["embedding"]),
  model("baai/bge-m3", "BGE-M3", "BAAI", "other", 8_192, true, "Estimated", "China", ["embedding"]),
  model("voyage/voyage-3.5", "Voyage 3.5", "Voyage", "other", 32_000, false, "Estimated", "Global", ["embedding"]),
];

export const DEFAULT_MODEL = MODELS.find((model) => model.id === "openai/gpt-3.5-turbo") ?? MODELS[0];
