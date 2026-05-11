import { chromium } from "@playwright/test";

const targetUrl = process.argv[2] ?? "http://localhost:3001";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.setDefaultTimeout(90_000);

try {
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.waitForFunction(() => {
    const tokenCount = document.querySelector('[data-testid="token-count"]')?.textContent?.trim();
    return tokenCount && tokenCount !== "..." && tokenCount !== "—";
  });

  const title = await page.title();
  if (title !== "Tokenizer Hub") {
    throw new Error(`Expected document title "Tokenizer Hub", got "${title}"`);
  }

  await page.getByRole("button", { name: "Raw", exact: true }).click();
  await page.getByTestId("raw-input").fill(" 这");
  await page.getByPlaceholder("Model").fill("qwen/qwen2.5-72b-instruct");
  await page.locator("aside").getByRole("button").filter({ hasText: "Qwen2.5 72B Instruct" }).first().click();

  await page.waitForFunction(() => {
    const tokenCount = document.querySelector('[data-testid="token-count"]')?.textContent?.trim();
    const body = document.body.innerText;
    return tokenCount === "2" && body.includes("32181") && body.includes("247");
  });

  const groupedToken = page.locator('span[title="32181, 247"]');
  if ((await groupedToken.count()) !== 1) {
    throw new Error("Expected a single rendered Qwen segment with title \"32181, 247\".");
  }

  const segmentText = await groupedToken.textContent();
  if (segmentText !== " 这") {
    throw new Error(`Expected grouped Qwen segment text " 这", got ${JSON.stringify(segmentText)}`);
  }

  await groupedToken.hover();
  await page.waitForFunction(() => document.body.innerText.includes("32181, 247 · #0-1"));

  console.log("Qwen multi-token segment UI ok.");
} finally {
  await browser.close();
}
