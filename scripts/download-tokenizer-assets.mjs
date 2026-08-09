import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createGzip } from "node:zlib";
import { createReadStream, createWriteStream } from "node:fs";
import { tokenizerAssets } from "./tokenizer-assets.mjs";

const force = process.argv.includes("--force");
const bootstrapNewAssets = process.argv.includes("--bootstrap-new-assets");
const manifest = JSON.parse(await fs.readFile("backend/tokenizers/manifest.json", "utf8"));
const filesFor = (asset) => (asset.type === "hf_tiktoken" ? ["tiktoken.model", "tokenizer_config.json"] : ["tokenizer.json", "tokenizer_config.json"]);
const endpoint = (process.env.HF_ENDPOINT || "https://hf-mirror.com").replace(/\/$/, "");
const noProxyEnv = {
  ...process.env,
  HF_ENDPOINT: endpoint,
  HTTP_PROXY: "",
  HTTPS_PROXY: "",
  ALL_PROXY: "",
  http_proxy: "",
  https_proxy: "",
  all_proxy: "",
};

const formatDuration = (ms) => `${(ms / 1000).toFixed(1)}s`;

const formatRate = (bytes, ms) => {
  if (!ms) return "n/a";
  return `${(bytes / 1024 / 1024 / (ms / 1000)).toFixed(2)} MiB/s`;
};

const gzipFile = (sourcePath, targetPath) =>
  new Promise((resolve, reject) => {
    const source = createReadStream(sourcePath);
    const target = createWriteStream(targetPath);
    source.on("error", reject);
    target.on("error", reject);
    target.on("close", resolve);
    source.pipe(createGzip({ level: 9, mtime: 0 })).pipe(target);
  });

const sha256File = async (filePath) => {
  const contents = await fs.readFile(filePath);
  return createHash("sha256").update(contents).digest("hex");
};

const curl = (url, targetPath) =>
  new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn("curl", [
      "--http1.1",
      "-L",
      "--fail",
      "--continue-at",
      "-",
      "--retry",
      "10",
      "--retry-delay",
      "2",
      "--connect-timeout",
      "20",
      "--speed-limit",
      "1024",
      "--speed-time",
      "45",
      "--max-time",
      "600",
      "-o",
      targetPath,
      url,
    ], { env: noProxyEnv });
    child.stderr.pipe(process.stderr);
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ elapsedMs: Date.now() - startedAt });
      else reject(new Error(`curl exited with ${code}: ${url}`));
    });
  });

const download = async (asset, filename) => {
  const targetDir = path.join("backend", "tokenizers", asset.key);
  const storedFilename = filename === "tokenizer.json" ? "tokenizer.json.gz" : filename;
  const targetPath = path.join(targetDir, storedFilename);
  const sourceTmpPath = path.join(targetDir, `${filename}.source.tmp`);
  const storedTmpPath = path.join(targetDir, `${storedFilename}.stored.tmp`);
  const fileRecord = manifest.assets?.[asset.key]?.files?.find((file) => file.sourcePath === filename);
  await fs.mkdir(targetDir, { recursive: true });

  const expectedSourceSize = filename === "tokenizer.json"
    ? asset.tokenizerJsonSize
    : filename === "tiktoken.model"
      ? asset.tiktokenModelSize
      : asset.tokenizerConfigSize;
  if (!fileRecord && !bootstrapNewAssets) {
    throw new Error(
      `Missing manifest record for ${asset.key}/${filename}; use --bootstrap-new-assets only for a pinned new asset.`,
    );
  }

  if (!force) {
    try {
      await fs.access(targetPath);
      const stats = await fs.stat(targetPath);
      if (!fileRecord) throw new Error(`Unverified bootstrap target already exists: ${targetPath}`);
      const actualSha256 = await sha256File(targetPath);
      if (actualSha256 !== fileRecord.sha256) {
        throw new Error(`Local SHA-256 mismatch for ${targetPath}: ${actualSha256}`);
      }
      console.log(`skip ${targetPath} (${stats.size.toLocaleString()} bytes)`);
      return { status: "skipped", asset: asset.key, filename, path: targetPath, size: stats.size };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Local SHA-256 mismatch")) throw error;
      // Continue to download.
    }
  }

  await fs.rm(sourceTmpPath, { force: true });
  await fs.rm(storedTmpPath, { force: true });
  const url = `${endpoint}/${asset.repo}/resolve/${asset.revision}/${filename}`;
  const { elapsedMs } = await curl(url, sourceTmpPath);
  const sourceStats = await fs.stat(sourceTmpPath);
  if (expectedSourceSize && sourceStats.size !== expectedSourceSize) {
    await fs.rm(sourceTmpPath, { force: true });
    throw new Error(
      `Source size mismatch for ${asset.key}/${filename}: expected ${expectedSourceSize}, got ${sourceStats.size}`,
    );
  }
  const sourceSha256 = await sha256File(sourceTmpPath);
  if (fileRecord && sourceSha256 !== fileRecord.sourceSha256) {
    await fs.rm(sourceTmpPath, { force: true });
    throw new Error(
      `Source SHA-256 mismatch for ${asset.key}/${filename}: expected ${fileRecord.sourceSha256}, got ${sourceSha256}`,
    );
  }

  if (filename === "tokenizer.json") {
    await gzipFile(sourceTmpPath, storedTmpPath);
    await fs.rm(sourceTmpPath, { force: true });
  } else {
    await fs.rename(sourceTmpPath, storedTmpPath);
  }
  const storedSha256 = await sha256File(storedTmpPath);
  if (fileRecord && filename !== "tokenizer.json" && storedSha256 !== fileRecord.sha256) {
    await fs.rm(storedTmpPath, { force: true });
    throw new Error(
      `Stored SHA-256 mismatch for ${asset.key}/${storedFilename}: expected ${fileRecord.sha256}, got ${storedSha256}`,
    );
  }
  await fs.rename(storedTmpPath, targetPath);
  if (fileRecord && storedSha256 !== fileRecord.sha256) {
    console.warn(`${targetPath}: compressed bytes changed; run pnpm sync:tokenizer-manifest before starting the backend.`);
  }
  const stats = await fs.stat(targetPath);
  console.log(
    `wrote ${targetPath} (${stats.size.toLocaleString()} bytes in ${formatDuration(elapsedMs)}, ${formatRate(stats.size, elapsedMs)})`,
  );
  if (!fileRecord) console.log(`  bootstrap source sha256 ${sourceSha256}`);
  return { status: "downloaded", asset: asset.key, filename, path: targetPath, size: stats.size, elapsedMs };
};

const results = [];

for (const asset of tokenizerAssets) {
  for (const filename of filesFor(asset)) {
    try {
      results.push(await download(asset, filename));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`failed ${asset.key}/${filename}: ${message}`);
      results.push({ status: "failed", asset: asset.key, filename, error: message });
      process.exitCode = 1;
    }
  }
}

const downloaded = results.filter((result) => result?.status === "downloaded");
const failed = results.filter((result) => result?.status === "failed");

if (downloaded.length) {
  console.log("Download speed summary:");
  for (const result of [...downloaded].sort((a, b) => b.elapsedMs - a.elapsedMs).slice(0, 10)) {
    console.log(
      `- ${result.asset}/${result.filename}: ${result.size.toLocaleString()} bytes, ${formatDuration(result.elapsedMs)}, ${formatRate(
        result.size,
        result.elapsedMs,
      )}`,
    );
  }
}

if (failed.length) {
  console.error("Download failures:");
  for (const result of failed) console.error(`- ${result.asset}/${result.filename}: ${result.error}`);
}
