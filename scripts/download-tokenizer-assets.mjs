import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { tokenizerAssets } from "./tokenizer-assets.mjs";

const force = process.argv.includes("--force");
const files = ["tokenizer.json", "tokenizer_config.json"];
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
  const targetPath = path.join(targetDir, filename);
  const tmpPath = `${targetPath}.tmp`;
  await fs.mkdir(targetDir, { recursive: true });

  if (!force) {
    try {
      await fs.access(targetPath);
      const stats = await fs.stat(targetPath);
      console.log(`skip ${targetPath} (${stats.size.toLocaleString()} bytes)`);
      return { status: "skipped", asset: asset.key, filename, path: targetPath, size: stats.size };
    } catch {
      // Continue to download.
    }
  }

  const url = `${endpoint}/${asset.repo}/resolve/main/${filename}`;
  const { elapsedMs } = await curl(url, tmpPath);
  await fs.rename(tmpPath, targetPath);
  const stats = await fs.stat(targetPath);
  console.log(
    `wrote ${targetPath} (${stats.size.toLocaleString()} bytes in ${formatDuration(elapsedMs)}, ${formatRate(stats.size, elapsedMs)})`,
  );
  return { status: "downloaded", asset: asset.key, filename, path: targetPath, size: stats.size, elapsedMs };
};

const results = [];

for (const asset of tokenizerAssets) {
  for (const filename of files) {
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
