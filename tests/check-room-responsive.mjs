import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});
const consoleErrors = [];
const scenarios = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
];

await mkdir("artifacts", { recursive: true });

for (const scenario of scenarios) {
  const context = await browser.newContext({
    viewport: { width: scenario.width, height: scenario.height },
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`${scenario.name}: ${message.text()}`);
  });
  const response = await page.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });
  if (!response?.ok()) throw new Error(`Page returned HTTP ${response?.status() ?? "unknown"}.`);
  await page.waitForTimeout(1200);

  const hub = page.locator(".room-hub").first();
  if (await hub.count() === 0) {
    throw new Error(`Room hub missing on ${scenario.name}: ${(await page.locator("body").innerText()).slice(0, 500)}`);
  }
  const box = await hub.boundingBox();
  if (!box || box.x < 0 || box.x + box.width > scenario.width) {
    throw new Error(`Room hub overflows the ${scenario.name} viewport.`);
  }

  await page.screenshot({
    path: `artifacts/room-hub-${scenario.name}.png`,
    fullPage: true,
  });
  await context.close();
}

if (consoleErrors.length) {
  throw new Error(`Browser console errors:\n${consoleErrors.join("\n")}`);
}

console.log("Desktop and mobile room hub UI passed.");
await browser.close();
