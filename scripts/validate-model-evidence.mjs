import fs from "node:fs";

import { MODELS, MODEL_SNAPSHOT_DATE } from "../src/data/models.ts";

const evidence = JSON.parse(fs.readFileSync("data/model-evidence.json", "utf8"));
const errors = [];
const sha256Pattern = /^[a-f0-9]{64}$/;
const revisionPattern = /^[a-f0-9]{40}$/;

if (evidence.snapshotDate !== MODEL_SNAPSHOT_DATE) {
  errors.push(`Evidence snapshot ${evidence.snapshotDate} does not match catalog ${MODEL_SNAPSHOT_DATE}.`);
}

for (const model of MODELS) {
  const record = evidence.models?.[model.id];
  if (!record) {
    errors.push(`${model.id}: missing evidence record.`);
    continue;
  }

  for (const field of ["modelUrl", "contextUrl"]) {
    try {
      const url = new URL(record[field]);
      if (url.protocol !== "https:") throw new Error("not https");
    } catch {
      errors.push(`${model.id}: ${field} must be an HTTPS URL.`);
    }
  }

  if (record.verifiedAt !== MODEL_SNAPSHOT_DATE) {
    errors.push(`${model.id}: verifiedAt must equal the snapshot date.`);
  }

  const tokenizer = record.tokenizer;
  if (!tokenizer || !["huggingface", "tiktoken"].includes(tokenizer.type)) {
    errors.push(`${model.id}: tokenizer evidence type must be huggingface or tiktoken.`);
  } else if (tokenizer.type === "huggingface") {
    if (!tokenizer.repo || !revisionPattern.test(tokenizer.revision ?? "")) {
      errors.push(`${model.id}: Hugging Face evidence needs repo and pinned 40-character revision.`);
    }
    if (!Array.isArray(tokenizer.files) || tokenizer.files.length === 0) {
      errors.push(`${model.id}: Hugging Face evidence needs at least one artifact file.`);
    } else if (tokenizer.files.some((file) => !file.path || !sha256Pattern.test(file.sha256 ?? ""))) {
      errors.push(`${model.id}: tokenizer artifact paths and SHA-256 values are invalid.`);
    }
  } else if (!tokenizer.encoding || !tokenizer.sourceUrl || !tokenizer.packageVersion) {
    errors.push(`${model.id}: tiktoken evidence needs encoding, sourceUrl, and packageVersion.`);
  }

  const needsRenderer = Boolean(model.support?.chat || model.support?.tools);
  if (needsRenderer && (!record.renderer || record.renderer.key !== model.rendererKey)) {
    errors.push(`${model.id}: exact Chat/Tools support lacks matching renderer evidence.`);
  }
  if (!needsRenderer && record.renderer !== null) {
    errors.push(`${model.id}: Raw-only model must record renderer as null.`);
  }
}

const catalogIds = new Set(MODELS.map((model) => model.id));
for (const id of Object.keys(evidence.models ?? {})) {
  if (!catalogIds.has(id)) errors.push(`${id}: evidence record has no catalog model.`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Model evidence ok: ${MODELS.length} records.`);
}
