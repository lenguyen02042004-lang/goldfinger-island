import * as playwright from "../node_modules/playwright/index.mjs";

export const chromium = {
  launch(options = {}) {
    return playwright.chromium.launch({
      ...options,
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    });
  },
};
