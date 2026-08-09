import fs from "node:fs";
import path from "node:path";

import { DEFAULT_MODEL, MODELS, MODEL_SNAPSHOT_DATE } from "../src/data/models.ts";

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

const errors = [];
const ids = MODELS.map((model) => model.id);
const idSet = new Set(ids);

if (MODELS.length !== 88) {
  errors.push(`Expected exactly 88 models for v0.2.0, found ${MODELS.length}.`);
}

if (MODEL_SNAPSHOT_DATE !== "2026-08-09") {
  errors.push(`Expected snapshot date 2026-08-09, found ${MODEL_SNAPSHOT_DATE}.`);
}

if (idSet.size !== ids.length) {
  errors.push("Duplicate model ids found.");
}

for (const id of requiredIds) {
  if (!idSet.has(id)) errors.push(`Missing required model id: ${id}`);
}

for (const model of MODELS) {
  if (!["active", "preview", "legacy"].includes(model.lifecycle)) {
    errors.push(`${model.id}: invalid or missing lifecycle.`);
  }
  if (
    !model.support
    || typeof model.support.raw !== "boolean"
    || typeof model.support.chat !== "boolean"
    || typeof model.support.tools !== "boolean"
  ) {
    errors.push(`${model.id}: invalid or missing mode support.`);
  } else {
    if (!model.support.raw) errors.push(`${model.id}: v0.2 catalog entries must have exact Raw support.`);
    if ((model.support.chat || model.support.tools) && !model.rendererKey) {
      errors.push(`${model.id}: exact Chat/Tools support requires rendererKey.`);
    }
  }

  const tokenizer = model.tokenizer;
  if (tokenizer.type === "hf") {
    for (const filename of ["tokenizer.json.gz", "tokenizer_config.json"]) {
      const assetPath = path.join("backend", "tokenizers", tokenizer.asset, filename);
      if (!fs.existsSync(assetPath)) errors.push(`Missing tokenizer asset: ${assetPath}`);
    }
    const rawTokenizerPath = path.join("backend", "tokenizers", tokenizer.asset, "tokenizer.json");
    if (fs.existsSync(rawTokenizerPath)) {
      errors.push(`Uncompressed tokenizer asset should not be committed: ${rawTokenizerPath}`);
    }
  }
  if (tokenizer.type === "hf_tiktoken") {
    for (const filename of ["tiktoken.model", "tokenizer_config.json"]) {
      const assetPath = path.join("backend", "tokenizers", tokenizer.asset, filename);
      if (!fs.existsSync(assetPath)) errors.push(`Missing tokenizer asset: ${assetPath}`);
    }
  }
}

if (!DEFAULT_MODEL || DEFAULT_MODEL.lifecycle !== "active") {
  errors.push("DEFAULT_MODEL must resolve to an active catalog entry.");
}

if (MODELS.length > 300) errors.push(`Expected <= 300 models, found ${MODELS.length}.`);
if (tokenizerSource.includes("estimateTokenize")) errors.push("Forbidden estimator function found in src/lib/tokenizer.ts.");
if (tokenizerSource.includes("90_000") || tokenizerSource.includes("90000")) {
  errors.push("Forbidden fake 90000 token ids found in src/lib/tokenizer.ts.");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  const sharedTokenizers = new Set(
    MODELS.filter((model) => model.tokenizer.type !== "tiktoken").map((model) => model.tokenizer.key),
  );
  console.log(`Model catalog ok: ${MODELS.length} exact models, ${sharedTokenizers.size} shared HF tokenizers.`);
}
