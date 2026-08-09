import { chromium } from "@playwright/test";
import { MODELS } from "../src/data/models.ts";

const targetUrl = process.argv[2] ?? "http://localhost:3001";
const sample = "五道口纳什";
const models = MODELS;

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
    await page.waitForFunction((expectsRaw) => {
      const tokenCount = document.querySelector('[data-testid="token-count"]')?.textContent?.trim();
      const body = document.body.innerText;
      return expectsRaw
        ? tokenCount && tokenCount !== "..." && tokenCount !== "—" && !body.includes("Loading exact tokenizer")
        : tokenCount === "—" && body.includes("Unavailable Raw");
    }, model.support.raw);

    const bodyText = await page.locator("body").innerText();
    const tokenCountText = await page.getByTestId("token-count").innerText();
    const tokenCount = Number(tokenCountText.replaceAll(",", ""));

    if (!model.support.raw) {
      if (tokenCountText.trim() !== "—" || !bodyText.includes("Unavailable Raw")) {
        throw new Error(`${model.id} should fail closed for unverified Raw mode. Got: ${tokenCountText}`);
      }
      continue;
    }
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

  console.log(`All ${models.length} catalog entries respected their exact Raw support flags.`);
} finally {
  await browser.close();
}
