import { chromium } from "@playwright/test";

const targetUrl = process.argv[2] ?? "http://localhost:3001";
const sample = "五道口纳什";
const expectedIds = ["76208", "45893", "40526"];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

try {
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.waitForFunction(
    () => Object.keys(document.querySelector("main") ?? {}).some((key) => key.startsWith("__react")),
    { timeout: 30_000 },
  );
  await page.getByRole("button", { name: /Raw/ }).click();
  await page.locator("textarea").first().fill(sample);
  await page.waitForTimeout(8_000);

  const bodyText = await page.locator("body").innerText();
  const hasEstimatedIds = /90000\\s*90001|90000,\\s*90001/.test(bodyText);
  const hasExpectedIds = expectedIds.every((id) => bodyText.includes(id));

  if (hasEstimatedIds || !hasExpectedIds) {
    throw new Error(`Expected exact cl100k ids for ${sample}, got estimated output. Body excerpt: ${bodyText.slice(-800)}`);
  }

  console.log(`Exact tokenizer UI ok for ${sample}`);
} finally {
  await browser.close();
}
