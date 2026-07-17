import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const consoleErrors = [];

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});

await page.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

const targetIsland = page.locator(".scene-island[data-island-id='2'] .island-hitbox");
await targetIsland.evaluate((element) => element.click());
await page.waitForTimeout(300);
await page.locator(".scene-island[data-island-id='2'].selected").waitFor();
await page.locator(".target-toast").waitFor();

const before = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
await page.locator(".dock-building.ready").first().click({ force: true });
await page.waitForTimeout(300);
const after = JSON.parse(await page.evaluate(() => window.render_game_to_text()));

if (after.coin >= before.coin) {
  throw new Error(`Building action did not spend coins: ${before.coin} -> ${after.coin}.`);
}
if (!after.buildings.some((building) => building.status === "building")) {
  throw new Error("Building action did not start construction.");
}
if (consoleErrors.length) {
  throw new Error(`Browser console errors:\n${consoleErrors.join("\n")}`);
}

await page.screenshot({ path: "artifacts/scene-interactions.png", fullPage: true });
console.log("Polygon island selection and dock building action passed.");
await browser.close();
