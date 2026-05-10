const baseUrl = (process.argv[2] ?? "http://127.0.0.1:8000").replace(/\/$/, "");
const sample = "五道口纳什";
const expectedIds = [76208, 45893, 40526];

const postJson = async (path, body) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${await response.text()}`);
  }
  return response.json();
};

const health = await fetch(`${baseUrl}/healthz`);
if (!health.ok) {
  throw new Error(`/healthz failed with ${health.status}: ${await health.text()}`);
}
const healthJson = await health.json();
if (!healthJson.ready) {
  throw new Error(`Backend is not ready: ${JSON.stringify(healthJson)}`);
}

const result = await postJson("/v1/tokenize", {
  modelId: "openai/gpt-3.5-turbo",
  text: sample,
});

const tokens = result.tokens ?? [];
const hasExpectedIds = expectedIds.every((id) => tokens.includes(id));
const hasFakeIds = tokens.some((id) => id >= 90000 && id <= 90099);

if (!hasExpectedIds || hasFakeIds || result.count !== 7) {
  throw new Error(`Expected exact cl100k ids for ${sample}, got ${JSON.stringify(result)}`);
}

const batch = await postJson("/v1/tokenize/batch", {
  modelIds: ["openai/gpt-3.5-turbo", "qwen/qwen3-8b"],
  text: sample,
});

if (!Array.isArray(batch.results) || batch.results.length !== 2) {
  throw new Error(`Expected 2 batch results, got ${JSON.stringify(batch)}`);
}

console.log(`Backend tokenizer API ok for ${sample}`);
