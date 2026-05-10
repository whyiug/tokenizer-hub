import { spawn } from "node:child_process";
import { tokenizerAssets } from "./tokenizer-assets.mjs";

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

const headersFor = (url) =>
  new Promise((resolve, reject) => {
    const child = spawn("curl", ["-I", "-L", "--fail", "--max-time", "45", "-sS", url], { env: noProxyEnv });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`curl exited with ${code}: ${url}\n${stderr}`));
    });
  });

const tokenizerJsonSize = async (repo) => {
  const headers = await headersFor(`${endpoint}/${repo}/resolve/main/tokenizer.json`);
  const linkedSizes = [...headers.matchAll(/^x-linked-size:\s*(\d+)/gim)].map((match) => Number(match[1]));
  const contentLengths = [...headers.matchAll(/^content-length:\s*(\d+)/gim)].map((match) => Number(match[1]));
  const sizes = [...linkedSizes, ...contentLengths].filter((size) => Number.isFinite(size) && size > 4096);
  const size = sizes.at(-1);
  if (!size) throw new Error(`Could not determine tokenizer.json size for ${repo}`);
  return size;
};

for (const asset of tokenizerAssets) {
  const repos = [asset.repo, ...(asset.reuseRepos ?? [])];
  const sizes = await Promise.all(repos.map(async (repo) => ({ repo, size: await tokenizerJsonSize(repo) })));
  const expected = sizes[0].size;
  const mismatched = sizes.filter((item) => item.size !== expected);
  if (mismatched.length) {
    console.error(`Tokenizer reuse mismatch for ${asset.key}. Expected ${expected} bytes.`);
    for (const item of sizes) console.error(`- ${item.repo}: ${item.size}`);
    process.exitCode = 1;
  } else {
    console.log(`${asset.key}: ${repos.length} repo(s), tokenizer.json size ${expected}`);
  }
}
