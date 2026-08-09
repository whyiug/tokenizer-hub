import { chromium } from "@playwright/test";

const targetUrl = process.argv[2] ?? "http://localhost:3001";
const expectedText = "Tokens are the in-game currency of this world.";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(20_000);

try {
  let interceptedTokenize = false;
  await page.route("**/*tokenize/batch", async (route) => {
    interceptedTokenize = true;
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    await route.abort("failed");
  });

  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});

  const rawInput = await page.getByTestId("raw-input").inputValue();
  if (rawInput !== expectedText) {
    throw new Error(`Raw default text not found. Got: ${JSON.stringify(rawInput)}`);
  }

  const tokenCount = await page.getByTestId("token-count").textContent();
  const bodyText = await page.locator("body").innerText();
  if (bodyText.includes("Loading exact tokenizer")) {
    throw new Error("Initial UI showed tokenizer loading even though the default state should be preseeded.");
  }
  if (tokenCount?.trim() !== "10") {
    throw new Error(`Expected preseeded token count "10", got ${JSON.stringify(tokenCount?.trim())}.`);
  }
  if (!bodyText.includes("30325") || !bodyText.includes("Tokens")) {
    throw new Error("Initial UI did not render preseeded token segments and ids.");
  }
  console.log(`Initial token state UI is preseeded.${interceptedTokenize ? " Background request was delayed." : ""}`);
} finally {
  await browser.close();
}
