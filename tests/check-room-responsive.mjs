import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});
const consoleErrors = [];
const scenarios = [
  { name: "full-hd", width: 1920, height: 1080, portrait: false },
  { name: "laptop", width: 1366, height: 768, portrait: false },
  { name: "portrait", width: 390, height: 844, portrait: true },
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

  if (scenario.portrait) {
    await page.locator(".rotate-device").waitFor();
  } else {
    const world = page.locator(".game-world");
    await world.waitFor();
    const box = await world.boundingBox();
    if (!box || box.x < 0 || box.y < 0 || box.x + box.width > scenario.width || box.y + box.height > scenario.height) {
      throw new Error(`Game canvas overflows the ${scenario.name} viewport.`);
    }
    const playerSlots = await page.locator(".scene-island").count();
    const dockSlots = await page.locator(".dock-building").count();
    if (playerSlots !== 12 || dockSlots !== 10) {
      throw new Error(`Expected 12 islands and 10 building slots, found ${playerSlots} and ${dockSlots}.`);
    }
  }

  await page.screenshot({
    path: `artifacts/premium-home-${scenario.name}.png`,
    fullPage: true,
  });
  await context.close();
}

if (consoleErrors.length) {
  throw new Error(`Browser console errors:\n${consoleErrors.join("\n")}`);
}

console.log("Full HD, laptop, and portrait game canvas UI passed.");
await browser.close();
