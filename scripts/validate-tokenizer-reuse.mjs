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

const remoteFileSize = async (repo, filename) => {
  const metadata = JSON.parse(await metadataFor(repo));
  const remoteFile = metadata.siblings?.find((item) => item.rfilename === filename);
  const metadataSizes = [remoteFile?.size, remoteFile?.lfs?.size].filter((size) => Number.isFinite(size) && size > 0);
  const metadataSize = metadataSizes.at(-1);
  if (metadataSize) return metadataSize;

  const headers = await headersFor(`${endpoint}/${repo}/resolve/main/${filename}`);
  const linkedSizes = [...headers.matchAll(/^x-linked-size:\s*(\d+)/gim)].map((match) => Number(match[1]));
  const contentLengths = [...headers.matchAll(/^content-length:\s*(\d+)/gim)].map((match) => Number(match[1]));
  const headerSizes = [...linkedSizes, ...contentLengths].filter((size) => Number.isFinite(size) && size > 0);
  const headerSize = headerSizes.at(-1);
  if (!headerSize) throw new Error(`Could not determine ${filename} size for ${repo}`);
  return headerSize;
};

const requiredFilesFor = (asset) => {
  if (asset.type === "hf_tiktoken") {
    return [
      { filename: "tiktoken.model", expected: asset.tiktokenModelSize },
      { filename: "tokenizer_config.json", expected: asset.tokenizerConfigSize },
    ];
  }
  return [{ filename: "tokenizer.json", expected: asset.tokenizerJsonSize }];
};

const assetSignature = (asset) =>
  requiredFilesFor(asset)
    .map((file) => `${file.filename}:${file.expected}`)
    .join("|");

const sizesByAsset = new Map();

for (const asset of tokenizerAssets) {
  for (const file of requiredFilesFor(asset)) {
    if (!Number.isFinite(file.expected) || file.expected <= 0) {
      console.error(`Missing ${file.filename} size for ${asset.key}.`);
      process.exitCode = 1;
      continue;
    }
  }

  const signature = assetSignature(asset);
  const duplicate = sizesByAsset.get(signature);
  if (duplicate) {
    console.error(`Duplicate tokenizer signature ${signature} for ${duplicate} and ${asset.key}; merge repos into one asset.`);
    process.exitCode = 1;
  } else {
    sizesByAsset.set(signature, asset.key);
  }
}

for (const asset of tokenizerAssets) {
  const repos = [asset.repo, ...(asset.reuseRepos ?? [])];
  const files = requiredFilesFor(asset);
  const sizes = await Promise.all(
    repos.flatMap((repo) =>
      files.map(async (file) => ({
        repo,
        filename: file.filename,
        expected: file.expected,
        size: await remoteFileSize(repo, file.filename),
      })),
    ),
  );
  const mismatched = sizes.filter((item) => item.size !== item.expected);
  if (mismatched.length) {
    console.error(`Tokenizer reuse mismatch for ${asset.key}.`);
    for (const item of sizes) console.error(`- ${item.repo}/${item.filename}: ${item.size} (expected ${item.expected})`);
    process.exitCode = 1;
  } else {
    console.log(`${asset.key}: ${repos.length} repo(s), ${assetSignature(asset)}`);
  }
}
