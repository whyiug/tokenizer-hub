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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const curlOnce = (args, url) =>
  new Promise((resolve, reject) => {
    const child = spawn("curl", [...args, url], { env: noProxyEnv });
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

const retryCurl = async (args, url) => {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      return await curlOnce(args, url);
    } catch (error) {
      lastError = error;
      if (attempt < 6) await sleep(2_000 * attempt);
    }
  }
  throw lastError;
};

const headersOnce = (url) =>
  curlOnce(
    [
      "--http1.1",
      "-I",
      "-L",
      "--fail",
      "--retry",
      "6",
      "--retry-delay",
      "2",
      "--connect-timeout",
      "20",
      "--max-time",
      "90",
      "-sS",
    ],
    url,
  );

const headersFor = async (url) => {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      return await headersOnce(url);
    } catch (error) {
      lastError = error;
      if (attempt < 6) await sleep(2_000 * attempt);
    }
  }
  throw lastError;
};

const metadataFor = (repo) =>
  retryCurl(
    [
      "--http1.1",
      "--fail",
      "--retry",
      "6",
      "--retry-delay",
      "2",
      "--connect-timeout",
      "20",
      "--max-time",
      "90",
      "-sS",
    ],
    `${endpoint}/api/models/${repo}?blobs=true`,
  );

const tokenizerJsonSize = async (repo) => {
  const metadata = JSON.parse(await metadataFor(repo));
  const tokenizerJson = metadata.siblings?.find((item) => item.rfilename === "tokenizer.json");
  const metadataSizes = [tokenizerJson?.size, tokenizerJson?.lfs?.size].filter(
    (size) => Number.isFinite(size) && size > 4096,
  );
  const metadataSize = metadataSizes.at(-1);
  if (metadataSize) return metadataSize;

  const headers = await headersFor(`${endpoint}/${repo}/resolve/main/tokenizer.json`);
  const linkedSizes = [...headers.matchAll(/^x-linked-size:\s*(\d+)/gim)].map((match) => Number(match[1]));
  const contentLengths = [...headers.matchAll(/^content-length:\s*(\d+)/gim)].map((match) => Number(match[1]));
  const headerSizes = [...linkedSizes, ...contentLengths].filter((size) => Number.isFinite(size) && size > 4096);
  const headerSize = headerSizes.at(-1);
  if (!headerSize) throw new Error(`Could not determine tokenizer.json size for ${repo}`);
  return headerSize;
};

const sizesByAsset = new Map();

for (const asset of tokenizerAssets) {
  if (!Number.isFinite(asset.tokenizerJsonSize) || asset.tokenizerJsonSize <= 4096) {
    console.error(`Missing tokenizerJsonSize for ${asset.key}.`);
    process.exitCode = 1;
    continue;
  }

  const duplicate = sizesByAsset.get(asset.tokenizerJsonSize);
  if (duplicate) {
    console.error(
      `Duplicate tokenizerJsonSize ${asset.tokenizerJsonSize} for ${duplicate} and ${asset.key}; merge repos into one asset.`,
    );
    process.exitCode = 1;
  } else {
    sizesByAsset.set(asset.tokenizerJsonSize, asset.key);
  }
}

for (const asset of tokenizerAssets) {
  const repos = [asset.repo, ...(asset.reuseRepos ?? [])];
  const sizes = await Promise.all(repos.map(async (repo) => ({ repo, size: await tokenizerJsonSize(repo) })));
  const expected = asset.tokenizerJsonSize;
  const mismatched = sizes.filter((item) => item.size !== expected);
  if (mismatched.length) {
    console.error(`Tokenizer reuse mismatch for ${asset.key}. Expected ${expected} bytes.`);
    for (const item of sizes) console.error(`- ${item.repo}: ${item.size}`);
    process.exitCode = 1;
  } else {
    console.log(`${asset.key}: ${repos.length} repo(s), tokenizer.json size ${expected}`);
  }
}
