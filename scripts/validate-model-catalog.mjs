import fs from "node:fs";

const source = fs.readFileSync("src/data/models.ts", "utf8");

const requiredIds = [
  "xiaomi/mimo-v2.5-pro",
  "xiaomi/mimo-v2.5",
  "xiaomi/mimo-v2-omni",
  "z-ai/glm-5.1",
  "z-ai/glm-5v-turbo",
  "moonshotai/kimi-k2.6",
  "moonshotai/kimi-k2-thinking",
  "moonshotai/kimi-k2-0905",
  "deepseek/deepseek-v4-pro",
  "deepseek/deepseek-v4-flash",
  "deepseek/deepseek-chat-v3.1",
  "deepseek/deepseek-r1-0528",
  "deepseek/deepseek-r1-distill-qwen-32b",
  "minimax/minimax-m2.7",
  "minimax/minimax-m2.5",
  "minimax/minimax-m1",
  "openai/gpt-3.5-turbo",
  "openai/gpt-4",
  "openai/text-davinci-003",
  "meta/llama-2-70b-chat",
  "meta/llama-2-7b-chat",
];

const modelCount = (source.match(/model\(/g) ?? []).length;
const missing = requiredIds.filter((id) => !source.includes(`model("${id}"`));

if (modelCount > 300) {
  console.error(`Expected <= 300 models, found ${modelCount}.`);
  process.exitCode = 1;
}

if (missing.length) {
  console.error(`Missing required model ids:\n${missing.map((id) => `- ${id}`).join("\n")}`);
  process.exitCode = 1;
}

if (!process.exitCode) {
  console.log(`Model catalog ok: ${modelCount} models.`);
}
