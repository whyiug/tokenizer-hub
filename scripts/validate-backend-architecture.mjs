import fs from "node:fs";

const requiredFiles = [
  "api/index.py",
  "backend/app/main.py",
  "backend/app/tokenizer_registry.py",
  "backend/catalog.json",
  "backend/requirements.txt",
  "requirements.txt",
  "vercel.json",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error(`Missing backend file: ${file}`);
    process.exitCode = 1;
  }
}

const pageSource = fs.readFileSync("src/app/page.tsx", "utf8");
const clientTokenizerSource = fs.existsSync("src/lib/exact-tokenizer.ts")
  ? fs.readFileSync("src/lib/exact-tokenizer.ts", "utf8")
  : "";

const forbiddenPageSnippets = [
  "@/lib/exact-tokenizer",
  "loadEncoding(",
  "@huggingface/tokenizers",
  "js-tiktoken/ranks",
  "/tokenizers/",
];

for (const snippet of forbiddenPageSnippets) {
  if (pageSource.includes(snippet)) {
    console.error(`Frontend still contains client tokenizer loading snippet: ${snippet}`);
    process.exitCode = 1;
  }
}

if (!pageSource.includes("NEXT_PUBLIC_TOKENIZER_API_BASE") && !pageSource.includes("/v1/tokenize")) {
  console.error("Frontend does not appear to call the tokenizer backend API.");
  process.exitCode = 1;
}

if (clientTokenizerSource.includes("fetchJson") && clientTokenizerSource.includes("/tokenizers/")) {
  console.error("Client exact-tokenizer module still fetches tokenizer assets.");
  process.exitCode = 1;
}

if (!process.exitCode) {
  console.log("Backend architecture validation ok.");
}
