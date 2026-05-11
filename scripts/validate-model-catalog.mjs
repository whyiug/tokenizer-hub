import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync("src/data/models.ts", "utf8");
const tokenizerSource = fs.readFileSync("src/lib/tokenizer.ts", "utf8");

const requiredIds = [
  "openai/gpt-5",
  "openai/gpt-oss-120b",
  "openai/gpt-3.5-turbo",
  "openai/gpt-3.5-turbo-0301",
  "openai/gpt-4",
  "openai/gpt-4-0613",
  "openai/text-davinci-003",
  "openai/text-davinci-002",
  "openai/code-davinci-002",
  "qwen/qwen3-235b-a22b",
  "xiaomi/mimo-v2.5-pro",
  "z-ai/glm-5.1",
  "deepseek/deepseek-r1",
  "minimax/minimax-m2.7",
  "meta/llama-2-70b-chat",
  "deepseek/deepseek-v3.2",
  "deepseek/deepseek-v3-0324",
  "deepseek/deepseek-v4-pro",
  "deepseek/deepseek-v4-flash",
  "qwen/qwen3.6-35b-a3b",
  "qwen/qwen3-coder-30b-a3b-instruct",
  "xiaomi/mimo-v2-flash",
  "minimax/minimax-m2.1",
  "z-ai/glm-4.5",
  "moonshotai/kimi-k2.6",
  "moonshotai/kimi-k2.5",
  "moonshotai/kimi-k2-thinking",
  "moonshotai/kimi-k2-0905",
  "moonshotai/kimi-k2",
  "minimax/minimax-m1",
  "minimax/minimax-01",
  "z-ai/glm-4-32b",
];

const modelCount = (source.match(/model\(/g) ?? []).length;
const missing = requiredIds.filter((id) => !source.includes(`model("${id}"`));
const hfAssets = [...source.matchAll(/hf\("([^"]+)"/g)].map((match) => match[1]);
const hfTiktokenAssets = [...source.matchAll(/hfTiktoken\("([^"]+)"/g)].map((match) => match[1]);
const forbidden = [
  { file: "src/data/models.ts", label: "Estimated status", hit: source.includes("Estimated") },
  { file: "src/data/models.ts", label: "unverified GPT-5.5 ids", hit: source.includes('model("openai/gpt-5.5') },
  { file: "src/data/models.ts", label: "unverified GPT-5.4 ids", hit: source.includes('model("openai/gpt-5.4') },
  {
    file: "src/data/models.ts",
    label: "gpt-oss without o200k_harmony",
    hit: source.includes('model("openai/gpt-oss') && !source.includes('tiktoken("o200k_harmony")'),
  },
  { file: "src/lib/tokenizer.ts", label: "estimator function", hit: tokenizerSource.includes("estimateTokenize") },
  { file: "src/lib/tokenizer.ts", label: "fake 90000 token ids", hit: tokenizerSource.includes("90_000") || tokenizerSource.includes("90000") },
];

if (modelCount > 300) {
  console.error(`Expected <= 300 models, found ${modelCount}.`);
  process.exitCode = 1;
}

if (modelCount < 70) {
  console.error(`Expected at least 70 exact models after the China LLM refresh, found ${modelCount}.`);
  process.exitCode = 1;
}

if (missing.length) {
  console.error(`Missing required model ids:\n${missing.map((id) => `- ${id}`).join("\n")}`);
  process.exitCode = 1;
}

for (const item of forbidden) {
  if (item.hit) {
    console.error(`Forbidden ${item.label} found in ${item.file}.`);
    process.exitCode = 1;
  }
}

for (const asset of hfAssets) {
  for (const filename of ["tokenizer.json.gz", "tokenizer_config.json"]) {
    const assetPath = path.join("backend", "tokenizers", asset, filename);
    if (!fs.existsSync(assetPath)) {
      console.error(`Missing tokenizer asset: ${assetPath}`);
      process.exitCode = 1;
    }
  }
  const rawTokenizerPath = path.join("backend", "tokenizers", asset, "tokenizer.json");
  if (fs.existsSync(rawTokenizerPath)) {
    console.error(`Uncompressed tokenizer asset should not be committed: ${rawTokenizerPath}`);
    process.exitCode = 1;
  }
}

for (const asset of hfTiktokenAssets) {
  for (const filename of ["tiktoken.model", "tokenizer_config.json"]) {
    const assetPath = path.join("backend", "tokenizers", asset, filename);
    if (!fs.existsSync(assetPath)) {
      console.error(`Missing tokenizer asset: ${assetPath}`);
      process.exitCode = 1;
    }
  }
}

if (!process.exitCode) {
  console.log(`Model catalog ok: ${modelCount} exact models, ${new Set([...hfAssets, ...hfTiktokenAssets]).size} shared HF tokenizers.`);
}
