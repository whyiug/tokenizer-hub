import { createHash } from "node:crypto";
import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import { spawn } from "node:child_process";

import { tokenizerAssets } from "./tokenizer-assets.mjs";

const endpoint = (process.env.HF_ENDPOINT || "https://huggingface.co").replace(/\/$/, "");
const manifest = JSON.parse(fs.readFileSync("backend/tokenizers/manifest.json", "utf8"));
const evidence = JSON.parse(fs.readFileSync("data/model-evidence.json", "utf8"));
const digest = (contents) => createHash("sha256").update(contents).digest("hex");
const sha256Pattern = /^[a-f0-9]{64}$/;
const revisionPattern = /^[a-f0-9]{40}$/;

for (const asset of tokenizerAssets) {
  const record = manifest.assets?.[asset.key];
  if (!record || record.repo !== asset.repo || record.revision !== asset.revision) {
    console.error(`${asset.key}: manifest source does not match pinned tokenizer asset.`);
    process.exitCode = 1;
    continue;
  }
  if (!revisionPattern.test(asset.revision ?? "")) {
    console.error(`${asset.key}: missing pinned 40-character revision.`);
    process.exitCode = 1;
  }
  for (const reuse of asset.reuseRepos ?? []) {
    if (!reuse.repo || !revisionPattern.test(reuse.revision ?? "")) {
      console.error(`${asset.key}: reused repository lacks a pinned revision.`);
      process.exitCode = 1;
    }
  }
  for (const file of record.files ?? []) {
    const local = fs.readFileSync(`backend/tokenizers/${file.path}`);
    const source = file.path.endsWith(".gz") ? gunzipSync(local) : local;
    if (digest(local) !== file.sha256) {
      console.error(`${file.path}: local SHA-256 does not match manifest.`);
      process.exitCode = 1;
    }
    if (!sha256Pattern.test(file.sourceSha256 ?? "") || digest(source) !== file.sourceSha256) {
      console.error(`${file.path}: source SHA-256 does not match manifest.`);
      process.exitCode = 1;
    }
  }
}

if (process.argv.includes("--local-only")) {
  if (!process.exitCode) console.log(`Local tokenizer manifest ok: ${tokenizerAssets.length} assets.`);
  process.exit();
}

const noProxyEnv = {
  ...process.env,
  HTTP_PROXY: "",
  HTTPS_PROXY: "",
  ALL_PROXY: "",
  http_proxy: "",
  https_proxy: "",
  all_proxy: "",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const curlBufferOnce = (url) =>
  new Promise((resolve, reject) => {
    const child = spawn(
      "curl",
      ["--http1.1", "-L", "--fail", "--connect-timeout", "20", "--max-time", "180", "-sS", url],
      { env: noProxyEnv },
    );
    const chunks = [];
    let stderr = "";
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`curl exited with ${code}: ${url}\n${stderr}`));
    });
  });

const retryCurl = async (url) => {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await curlBufferOnce(url);
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(1_000 * attempt);
    }
  }
  throw lastError;
};

const metadataCache = new Map();
const metadataFor = async (repo, revision) => {
  const key = `${repo}@${revision}`;
  if (!metadataCache.has(key)) {
    const url = `${endpoint}/api/models/${repo}/revision/${revision}?blobs=true`;
    metadataCache.set(key, retryCurl(url).then((contents) => JSON.parse(contents.toString("utf8"))));
  }
  return metadataCache.get(key);
};

for (const [modelId, record] of Object.entries(evidence.models ?? {})) {
  const identity = record.tokenizer?.officialIdentity;
  if (!identity) continue;
  try {
    const metadata = await metadataFor(identity.repo, identity.revision);
    const remoteFile = metadata.siblings?.find((item) => item.rfilename === identity.path);
    const actualGitBlobSha1 = remoteFile?.blobId;
    if (actualGitBlobSha1 !== identity.gitBlobSha1) {
      console.error(
        `${modelId}: official tokenizer blob identity mismatch: expected ${identity.gitBlobSha1}, got ${actualGitBlobSha1}.`,
      );
      process.exitCode = 1;
    } else {
      console.log(`${modelId}: official gated tokenizer identity matches the documented public mirror.`);
    }
  } catch (error) {
    console.error(`${modelId}: failed to verify official tokenizer identity: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}

const remoteFileSha256 = async (repo, revision, filename) => {
  const metadata = await metadataFor(repo, revision);
  if (metadata.sha !== revision) {
    throw new Error(`${repo}: API resolved ${metadata.sha}, expected ${revision}`);
  }
  const remoteFile = metadata.siblings?.find((item) => item.rfilename === filename);
  if (!remoteFile) throw new Error(`${repo}@${revision}: missing ${filename}`);
  const oid = remoteFile.lfs?.oid?.replace(/^sha256:/, "");
  if (sha256Pattern.test(oid ?? "")) return oid;
  const contents = await retryCurl(`${endpoint}/${repo}/resolve/${revision}/${filename}`);
  return digest(contents);
};

const signatures = new Map();
const identityFilesFor = (asset) => {
  const files = manifest.assets[asset.key].files;
  return asset.type === "hf_tiktoken"
    ? files.filter((file) => ["tiktoken.model", "tokenizer_config.json"].includes(file.sourcePath))
    : files.filter((file) => file.sourcePath === "tokenizer.json");
};

for (const asset of tokenizerAssets) {
  const files = identityFilesFor(asset);
  const signature = files.map((file) => `${file.sourcePath}:${file.sourceSha256}`).join("|");
  const duplicate = signatures.get(signature);
  if (duplicate) {
    console.error(`Duplicate tokenizer SHA-256 signature for ${duplicate} and ${asset.key}; merge them into one asset.`);
    process.exitCode = 1;
  } else {
    signatures.set(signature, asset.key);
  }
}

for (const asset of tokenizerAssets) {
  const sources = [{ repo: asset.repo, revision: asset.revision }, ...(asset.reuseRepos ?? [])];
  const files = identityFilesFor(asset);
  const results = await Promise.all(
    sources.flatMap((source) =>
      files.map(async (file) => ({
        ...source,
        filename: file.sourcePath,
        expected: file.sourceSha256,
        actual: await remoteFileSha256(source.repo, source.revision, file.sourcePath),
      })),
    ),
  );
  const mismatches = results.filter((result) => result.actual !== result.expected);
  if (mismatches.length) {
    console.error(`Tokenizer SHA-256 reuse mismatch for ${asset.key}.`);
    for (const result of results) {
      console.error(`- ${result.repo}@${result.revision}/${result.filename}: ${result.actual} (expected ${result.expected})`);
    }
    process.exitCode = 1;
  } else {
    console.log(`${asset.key}: ${sources.length} pinned repo(s), ${files.length} verified file(s)`);
  }
}
