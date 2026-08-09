import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import { tokenizerAssets } from "./tokenizer-assets.mjs";

const filesFor = (asset) =>
  asset.type === "hf_tiktoken"
    ? ["tiktoken.model", "tokenizer_config.json"]
    : ["tokenizer.json.gz", "tokenizer_config.json"];

const assets = {};
for (const asset of tokenizerAssets) {
  const files = [];
  for (const filename of filesFor(asset)) {
    const relativePath = path.posix.join(asset.key, filename);
    const contents = await fs.readFile(path.join("backend", "tokenizers", relativePath));
    const sourceContents = filename.endsWith(".gz") ? gunzipSync(contents) : contents;
    files.push({
      path: relativePath,
      sourcePath: filename === "tokenizer.json.gz" ? "tokenizer.json" : filename,
      size: contents.byteLength,
      sha256: createHash("sha256").update(contents).digest("hex"),
      sourceSize: sourceContents.byteLength,
      sourceSha256: createHash("sha256").update(sourceContents).digest("hex"),
    });
  }
  assets[asset.key] = {
    repo: asset.repo,
    revision: asset.revision,
    files,
  };
}

const manifest = {
  version: 1,
  generatedBy: "scripts/sync-tokenizer-manifest.mjs",
  assets,
};

await fs.writeFile("backend/tokenizers/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote backend/tokenizers/manifest.json with ${Object.keys(assets).length} assets.`);
