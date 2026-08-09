import { createHash } from "node:crypto";
import fs from "node:fs";

import { MODELS, MODEL_SNAPSHOT_DATE } from "../src/data/models.ts";

const manifest = JSON.parse(fs.readFileSync("backend/tokenizers/manifest.json", "utf8"));

const currentModelUrls = {
  "openai/gpt-5.6-sol": "https://developers.openai.com/api/docs/models/gpt-5.6-sol",
  "openai/gpt-5.6-terra": "https://developers.openai.com/api/docs/models/gpt-5.6-terra",
  "openai/gpt-5.6-luna": "https://developers.openai.com/api/docs/models/gpt-5.6-luna",
  "deepseek/deepseek-v4-flash-0731": "https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash-0731",
  "z-ai/glm-5.2": "https://huggingface.co/zai-org/GLM-5.2",
  "moonshotai/kimi-k3": "https://huggingface.co/moonshotai/Kimi-K3",
  "moonshotai/kimi-k2.7-code": "https://huggingface.co/moonshotai/Kimi-K2.7-Code",
  "minimax/minimax-m3": "https://huggingface.co/MiniMaxAI/MiniMax-M3",
  "google/gemma-4-e2b-it": "https://huggingface.co/google/gemma-4-E2B-it",
  "google/gemma-4-e4b-it": "https://huggingface.co/google/gemma-4-E4B-it",
  "google/gemma-4-12b-it": "https://huggingface.co/google/gemma-4-12B-it",
  "google/gemma-4-26b-a4b-it": "https://huggingface.co/google/gemma-4-26B-A4B-it",
  "google/gemma-4-31b-it": "https://huggingface.co/google/gemma-4-31B-it",
  "meta/llama-4-scout-17b-16e-instruct": "https://huggingface.co/meta-llama/Llama-4-Scout-17B-16E-Instruct",
  "meta/llama-4-maverick-17b-128e-instruct": "https://huggingface.co/meta-llama/Llama-4-Maverick-17B-128E-Instruct",
  "mistralai/mistral-small-4-119b-2603": "https://huggingface.co/mistralai/Mistral-Small-4-119B-2603",
  "mistralai/mistral-medium-3.5-128b": "https://huggingface.co/mistralai/Mistral-Medium-3.5-128B",
};

const specialModelUrls = {
  "meta/llama-3.1-8b-instruct": "https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct",
  "meta/llama-2-70b-chat": "https://huggingface.co/meta-llama/Llama-2-70b-chat-hf",
  "meta/llama-2-7b-chat": "https://huggingface.co/meta-llama/Llama-2-7b-chat-hf",
  "deepseek/deepseek-v4-pro": "https://huggingface.co/deepseek-ai",
  "deepseek/deepseek-v4-flash": "https://huggingface.co/deepseek-ai",
};

const sha256File = (filePath) => createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

const modelUrlFor = (model) => {
  if (currentModelUrls[model.id]) return currentModelUrls[model.id];
  if (specialModelUrls[model.id]) return specialModelUrls[model.id];
  if (model.provider === "OpenAI") return "https://developers.openai.com/api/docs/models";
  return `https://huggingface.co/${model.tokenizer.repo}`;
};

const tokenizerEvidenceFor = (model) => {
  if (!model.support.raw) {
    return {
      type: "unavailable",
      reason: "No official released tokenizer artifact exists for this preview identifier.",
    };
  }
  if (model.tokenizer.type === "tiktoken") {
    return {
      type: "tiktoken",
      encoding: model.tokenizer.encoding,
      sourceUrl: "https://github.com/openai/tiktoken",
      packageVersion: "0.12.0",
    };
  }

  const asset = manifest.assets[model.tokenizer.asset];
  if (!asset) throw new Error(`Missing tokenizer manifest asset: ${model.tokenizer.asset}`);
  const evidence = {
    type: "huggingface",
    repo: asset.repo,
    revision: asset.revision,
    files: asset.files.map((file) => ({
      path: file.sourcePath,
      sha256: file.sourceSha256,
    })),
  };
  if (model.id === "meta/llama-4-scout-17b-16e-instruct") {
    evidence.officialIdentity = {
      repo: "meta-llama/Llama-4-Scout-17B-16E-Instruct",
      revision: "92f3b1597a195b523d8d9e5700e57e4fbb8f20d3",
      path: "tokenizer.json",
      gitBlobSha1: "b1fde397c877f796b68ca425082644bb07a20535",
    };
  }
  if (model.id === "meta/llama-4-maverick-17b-128e-instruct") {
    evidence.officialIdentity = {
      repo: "meta-llama/Llama-4-Maverick-17B-128E-Instruct",
      revision: "73d14711bcc77c16df3470856949c3764056b617",
      path: "tokenizer.json",
      gitBlobSha1: "b1fde397c877f796b68ca425082644bb07a20535",
    };
  }
  return evidence;
};

const rendererEvidenceFor = (model) => {
  if (!model.rendererKey) return null;
  if (model.rendererKey !== "qwen3") throw new Error(`Unknown renderer evidence: ${model.rendererKey}`);
  return {
    key: "qwen3",
    sourceUrl: "https://huggingface.co/Qwen/Qwen3-8B/blob/b968826d9c46dd6066d109eabc6255188de91218/tokenizer_config.json",
    revision: "b968826d9c46dd6066d109eabc6255188de91218",
    sha256: sha256File("backend/prompt_templates/qwen3.jinja"),
  };
};

const evidence = {
  snapshotDate: MODEL_SNAPSHOT_DATE,
  models: Object.fromEntries(
    MODELS.map((model) => {
      const modelUrl = modelUrlFor(model);
      return [
        model.id,
        {
          modelUrl,
          contextUrl: modelUrl,
          tokenizer: tokenizerEvidenceFor(model),
          renderer: rendererEvidenceFor(model),
          verifiedAt: MODEL_SNAPSHOT_DATE,
        },
      ];
    }),
  ),
};

fs.writeFileSync("data/model-evidence.json", `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`Wrote data/model-evidence.json with ${Object.keys(evidence.models).length} records.`);
