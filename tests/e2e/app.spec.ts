import path from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

test("renders the dock shell", async () => {
  const app = await electron.launch({
    args: [path.join(process.cwd(), "dist-electron/main/index.js")],
    env: {
      ...process.env,
      NODE_ENV: "test"
    }
  });

  const window = await app.firstWindow();
  await expect
    .poll(async () => {
      return app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
    })
    .toBeGreaterThan(0);
  await expect(window).toHaveTitle(/VibeDock/);
  await app.close();
});
