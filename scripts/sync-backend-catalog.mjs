import fs from "node:fs";

const source = fs.readFileSync("src/data/models.ts", "utf8");
const tokenizers = {};
const tokenizerKeysByName = new Map();

for (const match of source.matchAll(/(\w+):\s*tiktoken\("([^"]+)"\)/g)) {
  const [, name, encoding] = match;
  const key = `tiktoken:${encoding}`;
  tokenizerKeysByName.set(name, key);
  tokenizers[key] = { type: "tiktoken", encoding, label: encoding };
}

for (const match of source.matchAll(/(\w+):\s*hf\("([^"]+)",\s*"([^"]+)"\)/g)) {
  const [, name, asset, repo] = match;
  const key = `hf:${asset}`;
  tokenizerKeysByName.set(name, key);
  tokenizers[key] = { type: "hf", asset, repo, label: asset };
}

const models = [];
for (const match of source.matchAll(/model\("([^"]+)",[^\n]*TOKENIZERS\.(\w+)/g)) {
  const [, id, tokenizerName] = match;
  const tokenizerKey = tokenizerKeysByName.get(tokenizerName);
  if (!tokenizerKey) {
    throw new Error(`Could not resolve tokenizer ${tokenizerName} for ${id}`);
  }
  models.push({ id, tokenizerKey });
}

if (!models.length) throw new Error("No models found in src/data/models.ts");

const catalog = {
  version: 1,
  source: "generated from src/data/models.ts by scripts/sync-backend-catalog.mjs",
  tokenizers,
  models,
};

fs.mkdirSync("backend", { recursive: true });
fs.writeFileSync("backend/catalog.json", `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Wrote backend/catalog.json with ${models.length} models and ${Object.keys(tokenizers).length} tokenizers.`);
