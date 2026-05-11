import { chromium } from "@playwright/test";

const targetUrl = process.argv[2] ?? "http://localhost:3001";
const expectedText = "Tokens are the in-game currency of this world.";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(20_000);

try {
  let interceptedTokenize = false;
  await page.route("**/v1/tokenize/batch", async (route) => {
    interceptedTokenize = true;
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    await route.abort("failed");
  });

  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

  await page.getByRole("button", { name: "Chat", exact: true }).click();
  const textareas = await page.locator("textarea").evaluateAll((nodes) => nodes.map((node) => node.value));
  if (!textareas.includes(expectedText)) {
    throw new Error(`Chat default text not found. Values: ${JSON.stringify(textareas)}`);
  }

  const tokenCount = await page.getByTestId("token-count").textContent();
  const bodyText = await page.locator("body").innerText();
  if (bodyText.includes("Loading exact tokenizer")) {
    throw new Error("Initial UI showed tokenizer loading even though the default state should be preseeded.");
  }
  if (tokenCount?.trim() !== "50") {
    throw new Error(`Expected preseeded token count "50", got ${JSON.stringify(tokenCount?.trim())}.`);
  }
  if (!bodyText.includes("30400") || !bodyText.includes("Tokens")) {
    throw new Error("Initial UI did not render preseeded token segments and ids.");
  }
  if (!interceptedTokenize) {
    throw new Error("The test did not intercept the background tokenizer request.");
  }

  console.log("Initial token state UI is preseeded.");
} finally {
  await browser.close();
}
