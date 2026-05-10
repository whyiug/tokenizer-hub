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

const curl = (url, targetPath) =>
  new Promise((resolve, reject) => {
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
      if (code === 0) resolve();
      else reject(new Error(`curl exited with ${code}: ${url}`));
    });
  });

const download = async (asset, filename) => {
  const targetDir = path.join("public", "tokenizers", asset.key);
  const targetPath = path.join(targetDir, filename);
  const tmpPath = `${targetPath}.tmp`;
  await fs.mkdir(targetDir, { recursive: true });

  if (!force) {
    try {
      await fs.access(targetPath);
      console.log(`skip ${targetPath}`);
      return;
    } catch {
      // Continue to download.
    }
  }

  const url = `${endpoint}/${asset.repo}/resolve/main/${filename}`;
  await curl(url, tmpPath);
  await fs.rename(tmpPath, targetPath);
  const stats = await fs.stat(targetPath);
  console.log(`wrote ${targetPath} (${stats.size.toLocaleString()} bytes)`);
};

for (const asset of tokenizerAssets) {
  for (const filename of files) {
    await download(asset, filename);
  }
}
