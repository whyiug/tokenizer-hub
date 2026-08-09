import fs from "node:fs";

import { MODELS } from "../src/data/models.ts";

const tokenizers = {};
for (const model of MODELS) {
  const tokenizer = model.tokenizer;
  tokenizers[tokenizer.key] = {
    type: tokenizer.type,
    ...(tokenizer.type === "tiktoken" ? { encoding: tokenizer.encoding } : { asset: tokenizer.asset, repo: tokenizer.repo }),
    label: tokenizer.type === "tiktoken" ? tokenizer.encoding : tokenizer.asset,
  };
}

const models = MODELS.map((model) => ({
  id: model.id,
  tokenizerKey: model.tokenizer.key,
  lifecycle: model.lifecycle,
  support: model.support,
  rendererKey: model.rendererKey ?? null,
}));

const catalog = {
  version: 2,
  source: "generated from src/data/models.ts by scripts/sync-backend-catalog.mjs",
  tokenizers,
  models,
};

fs.writeFileSync("backend/catalog.json", `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Wrote backend/catalog.json with ${models.length} models and ${Object.keys(tokenizers).length} tokenizers.`);
