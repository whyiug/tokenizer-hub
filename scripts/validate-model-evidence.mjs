import { createHash } from "node:crypto";
import fs from "node:fs";

import { MODELS, MODEL_SNAPSHOT_DATE } from "../src/data/models.ts";

const evidence = JSON.parse(fs.readFileSync("data/model-evidence.json", "utf8"));
const manifest = JSON.parse(fs.readFileSync("backend/tokenizers/manifest.json", "utf8"));
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
  if (!tokenizer || !["huggingface", "tiktoken", "unavailable"].includes(tokenizer.type)) {
    errors.push(`${model.id}: tokenizer evidence type must be huggingface, tiktoken, or unavailable.`);
  } else if (tokenizer.type === "huggingface") {
    if (!tokenizer.repo || !revisionPattern.test(tokenizer.revision ?? "")) {
      errors.push(`${model.id}: Hugging Face evidence needs repo and pinned 40-character revision.`);
    }
    if (!Array.isArray(tokenizer.files) || tokenizer.files.length === 0) {
      errors.push(`${model.id}: Hugging Face evidence needs at least one artifact file.`);
    } else if (tokenizer.files.some((file) => !file.path || !sha256Pattern.test(file.sha256 ?? ""))) {
      errors.push(`${model.id}: tokenizer artifact paths and SHA-256 values are invalid.`);
    }
    const asset = manifest.assets?.[model.tokenizer.asset];
    if (!asset || tokenizer.repo !== asset.repo || tokenizer.revision !== asset.revision) {
      errors.push(`${model.id}: tokenizer evidence does not match the checked-in asset manifest.`);
    } else {
      const expectedFiles = asset.files.map((file) => `${file.sourcePath}:${file.sourceSha256}`).sort();
      const evidenceFiles = tokenizer.files.map((file) => `${file.path}:${file.sha256}`).sort();
      if (JSON.stringify(expectedFiles) !== JSON.stringify(evidenceFiles)) {
        errors.push(`${model.id}: tokenizer evidence files do not match the checked-in asset manifest.`);
      }
    }
    if (tokenizer.officialIdentity) {
      const identity = tokenizer.officialIdentity;
      if (
        !identity.repo
        || !revisionPattern.test(identity.revision ?? "")
        || !identity.path
        || !/^[a-f0-9]{40}$/.test(identity.gitBlobSha1 ?? "")
      ) {
        errors.push(`${model.id}: official-to-mirror identity evidence is invalid.`);
      }
    }
  } else if (tokenizer.type === "tiktoken" && (!tokenizer.encoding || !tokenizer.sourceUrl || !tokenizer.packageVersion)) {
    errors.push(`${model.id}: tiktoken evidence needs encoding, sourceUrl, and packageVersion.`);
  } else if (tokenizer.type === "tiktoken" && tokenizer.encoding !== model.tokenizer.encoding) {
    errors.push(`${model.id}: tiktoken evidence encoding does not match the catalog.`);
  } else if (tokenizer.type === "unavailable") {
    if (model.support.raw || model.support.chat || model.support.tools) {
      errors.push(`${model.id}: unavailable tokenizer evidence cannot back an exact mode.`);
    }
    if (!tokenizer.reason) errors.push(`${model.id}: unavailable tokenizer evidence needs a reason.`);
  }

  const needsRenderer = Boolean(model.support?.chat || model.support?.tools);
  if (needsRenderer && (!record.renderer || record.renderer.key !== model.rendererKey)) {
    errors.push(`${model.id}: exact Chat/Tools support lacks matching renderer evidence.`);
  }
  if (!needsRenderer && record.renderer !== null) {
    errors.push(`${model.id}: Raw-only model must record renderer as null.`);
  }
  if (record.renderer) {
    if (!revisionPattern.test(record.renderer.revision ?? "") || !sha256Pattern.test(record.renderer.sha256 ?? "")) {
      errors.push(`${model.id}: renderer evidence needs a pinned revision and SHA-256.`);
    }
    try {
      const url = new URL(record.renderer.sourceUrl);
      if (url.protocol !== "https:") throw new Error("not https");
    } catch {
      errors.push(`${model.id}: renderer sourceUrl must be an HTTPS URL.`);
    }
    const templatePath = `backend/prompt_templates/${record.renderer.key}.jinja`;
    if (!fs.existsSync(templatePath)) {
      errors.push(`${model.id}: renderer template is missing: ${templatePath}.`);
    } else {
      const actualSha256 = createHash("sha256").update(fs.readFileSync(templatePath)).digest("hex");
      if (actualSha256 !== record.renderer.sha256) {
        errors.push(`${model.id}: renderer evidence SHA-256 does not match the checked-in template.`);
      }
    }
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
