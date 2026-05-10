import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync("src/data/models.ts", "utf8");
const tokenizerSource = fs.readFileSync("src/lib/tokenizer.ts", "utf8");

const requiredIds = [
  "openai/gpt-5.5",
  "openai/gpt-3.5-turbo",
  "openai/gpt-4",
  "openai/text-davinci-003",
  "openai/code-davinci-002",
  "qwen/qwen3-235b-a22b",
  "xiaomi/mimo-v2.5-pro",
  "z-ai/glm-5.1",
  "deepseek/deepseek-r1",
  "minimax/minimax-m2.7",
  "meta/llama-2-70b-chat",
];

const modelCount = (source.match(/model\(/g) ?? []).length;
const missing = requiredIds.filter((id) => !source.includes(`model("${id}"`));
const hfAssets = [...source.matchAll(/hf\("([^"]+)"/g)].map((match) => match[1]);
const forbidden = [
  { file: "src/data/models.ts", label: "Estimated status", hit: source.includes("Estimated") },
  { file: "src/lib/tokenizer.ts", label: "estimator function", hit: tokenizerSource.includes("estimateTokenize") },
  { file: "src/lib/tokenizer.ts", label: "fake 90000 token ids", hit: tokenizerSource.includes("90_000") || tokenizerSource.includes("90000") },
];

if (modelCount > 300) {
  console.error(`Expected <= 300 models, found ${modelCount}.`);
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
  for (const filename of ["tokenizer.json", "tokenizer_config.json"]) {
    const assetPath = path.join("public", "tokenizers", asset, filename);
    if (!fs.existsSync(assetPath)) {
      console.error(`Missing tokenizer asset: ${assetPath}`);
      process.exitCode = 1;
    }
  }
}

if (!process.exitCode) {
  console.log(`Model catalog ok: ${modelCount} exact models, ${new Set(hfAssets).size} shared HF tokenizers.`);
}
