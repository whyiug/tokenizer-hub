import fs from "node:fs";
import { chromium } from "@playwright/test";

const targetUrl = process.argv[2] ?? "http://localhost:3001";
const sample = "五道口纳什";
const source = fs.readFileSync("src/data/models.ts", "utf8");
const models = [...source.matchAll(/model\("([^"]+)",\s*"([^"]+)"/g)].map((match) => ({
  id: match[1],
  name: match[2],
}));

if (!models.length) throw new Error("No models found in src/data/models.ts");

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
  await page.getByRole("button", { name: "Raw", exact: true }).click();
  await page.getByTestId("raw-input").fill(sample);
  const search = page.getByPlaceholder("Model");

  for (const model of models) {
    await search.fill(model.id);
    await page.locator("aside").getByRole("button").filter({ hasText: model.name }).first().click();
    await page.waitForFunction(() => {
      const tokenCount = document.querySelector('[data-testid="token-count"]')?.textContent?.trim();
      const body = document.body.innerText;
      return tokenCount && tokenCount !== "..." && tokenCount !== "—" && !body.includes("Loading exact tokenizer");
    });

    const bodyText = await page.locator("body").innerText();
    const tokenCountText = await page.getByTestId("token-count").innerText();
    const tokenCount = Number(tokenCountText.replaceAll(",", ""));

    if (!Number.isFinite(tokenCount) || tokenCount <= 0) {
      throw new Error(`${model.id} did not produce a positive token count. Got: ${tokenCountText}`);
    }
    if (/90000\s*90001|90000,\s*90001|90000/.test(bodyText)) {
      throw new Error(`${model.id} displayed fake 90000-series token ids.`);
    }
    if (/unavailable|estimated/i.test(bodyText)) {
      throw new Error(`${model.id} displayed unavailable or estimated output.`);
    }
  }

  console.log(`All model tokenizers rendered exact output for ${models.length} models.`);
} finally {
  await browser.close();
}
