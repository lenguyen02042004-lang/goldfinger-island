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
  const response = await page.goto("http://127.0.0.1:3000/island", {
    waitUntil: "domcontentloaded",
  });
  if (!response?.ok()) throw new Error(`Page returned HTTP ${response?.status() ?? "unknown"}.`);
  await page.waitForTimeout(1800);

  if (scenario.portrait) {
    await page.locator(".personal-rotate-device").waitFor();
  } else {
    await page.waitForFunction(() => {
      const image = document.querySelector(".personal-island-object > img");
      return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
    });
    const world = page.locator(".personal-game-world");
    await world.waitFor();
    const box = await world.boundingBox();
    if (!box || box.x < 0 || box.y < 0 || box.x + box.width > scenario.width || box.y + box.height > scenario.height) {
      throw new Error(`Personal island canvas overflows the ${scenario.name} viewport.`);
    }
    const buildingObjects = await page.locator(".personal-building-object").count();
    const dockSlots = await page.locator(".personal-dock-slot").count();
    if (buildingObjects !== 10 || dockSlots !== 10) {
      throw new Error(`Expected 10 scene objects and 10 dock slots, found ${buildingObjects} and ${dockSlots}.`);
    }
  }

  await page.screenshot({
    path: `artifacts/personal-island-${scenario.name}.png`,
    fullPage: true,
  });
  await context.close();
}

const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await context.newPage();
await page.goto("http://127.0.0.1:3000/island", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await page.locator("[data-testid='scene-building-1'] .personal-building-hitbox").evaluate((element) => element.click());
await page.locator("[data-testid='building-radial-menu']").waitFor();
const before = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
await page.locator("[data-testid='scene-build-1']").click();
await page.waitForTimeout(300);
const after = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
if (after.coin >= before.coin || !after.buildings.some((building) => building.status === "building")) {
  throw new Error("Radial build action did not start construction and spend coins.");
}
await page.screenshot({ path: "artifacts/personal-island-building.png", fullPage: true });
await context.close();

if (consoleErrors.length) {
  throw new Error(`Browser console errors:\n${consoleErrors.join("\n")}`);
}

console.log("Personal island scene, responsive layouts, and radial build action passed.");
await browser.close();
