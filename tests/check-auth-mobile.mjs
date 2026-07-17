import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const consoleErrors = [];

page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push(message.text());
  }
});

await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.getByTestId("auth-open").click();
await page.getByTestId("auth-mode-register").click();

await page.getByLabel("Tên hiển thị").waitFor();
await page.getByLabel("Email").waitFor();
await page.getByPlaceholder("Tối thiểu 6 ký tự").waitFor();

const modal = page.getByTestId("auth-modal");
const modalBox = await modal.boundingBox();
if (!modalBox || modalBox.x < 0 || modalBox.x + modalBox.width > 390) {
  throw new Error("Auth modal overflows the mobile viewport.");
}

await mkdir("artifacts", { recursive: true });
await page.screenshot({
  path: "artifacts/auth-register-mobile.png",
  fullPage: true,
});

if (consoleErrors.length > 0) {
  throw new Error(`Browser console errors:\n${consoleErrors.join("\n")}`);
}

console.log("Mobile email registration UI passed.");
await browser.close();
