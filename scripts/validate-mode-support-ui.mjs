import { chromium } from "@playwright/test";

const targetUrl = process.argv[2] ?? "http://localhost:3001";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.setDefaultTimeout(60_000);

const requests = [];
page.on("request", (request) => {
  if (!request.url().includes("/tokenize/batch")) return;
  try {
    requests.push(request.postDataJSON());
  } catch {
    // A malformed body will fail the assertions below.
  }
});

try {
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});

  const support = page.getByTestId("mode-support");
  if ((await support.innerText()).trim() !== "Exact Raw") {
    throw new Error(`Expected default Exact Raw status, got ${JSON.stringify(await support.innerText())}.`);
  }
  if (!(await page.getByRole("button", { name: "Chat", exact: true }).isDisabled())) {
    throw new Error("Chat should be disabled for a Raw-only model.");
  }

  const search = page.getByPlaceholder("Model");
  await search.fill("qwen/qwen3-8b");
  await page.locator("aside").getByRole("button").filter({ hasText: "Qwen3 8B" }).first().click();
  const chatButton = page.getByRole("button", { name: "Chat", exact: true });
  if (await chatButton.isDisabled()) throw new Error("Chat should be enabled for Qwen3 8B.");
  await chatButton.click();
  await page.waitForFunction(() => document.querySelector('[data-testid="mode-support"]')?.textContent?.includes("Exact Chat"));
  await page.waitForFunction(() => {
    const count = document.querySelector('[data-testid="token-count"]')?.textContent?.trim();
    return count && count !== "..." && count !== "—";
  });

  const chatRequest = requests.findLast((request) => request.mode === "chat");
  if (!chatRequest || !Array.isArray(chatRequest.messages) || "text" in chatRequest) {
    throw new Error(`Chat request was not structured: ${JSON.stringify(chatRequest)}.`);
  }
  const previews = await page.locator("textarea[readonly]").evaluateAll((nodes) => nodes.map((node) => node.value));
  if (!previews.some((value) => value.includes("<|im_start|>system"))) {
    throw new Error("Prompt preview did not display the backend-authoritative Qwen3 serialization.");
  }

  const toolsButton = page.getByRole("button", { name: "Tools", exact: true });
  await toolsButton.click();
  await page.waitForFunction(() => document.querySelector('[data-testid="mode-support"]')?.textContent?.includes("Exact Tools"));
  await page.waitForFunction(() => {
    const count = document.querySelector('[data-testid="token-count"]')?.textContent?.trim();
    return count && count !== "..." && count !== "—";
  });
  const toolsRequest = requests.findLast((request) => request.mode === "tools");
  if (!toolsRequest || !Array.isArray(toolsRequest.messages) || !Array.isArray(toolsRequest.tools) || "text" in toolsRequest) {
    throw new Error(`Tools request was not structured: ${JSON.stringify(toolsRequest)}.`);
  }

  await page.getByRole("button", { name: "Raw", exact: true }).click();
  await search.fill("deepseek/deepseek-v4-pro");
  await page.locator("aside").getByRole("button").filter({ hasText: "DeepSeek V4 Pro" }).first().click();
  if ((await support.innerText()).trim() !== "Unavailable Raw") {
    throw new Error("Unverified preview did not fail closed in Raw mode.");
  }
  if ((await page.getByTestId("token-count").innerText()).trim() !== "—") {
    throw new Error("Unverified preview displayed a token count.");
  }

  console.log("Mode-specific UI support and structured requests validated.");
} finally {
  await browser.close();
}
