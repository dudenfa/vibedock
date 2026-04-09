import { describe, expect, it } from "vitest";
import { XProvider } from "../../src/main/providers/x";

describe("XProvider", () => {
  const provider = new XProvider();

  it("normalizes browser urls onto x.com", () => {
    const target = provider.normalizeInput("twitter.com/home", "browser");
    expect(target.resolvedUrl).toBe("https://x.com/home");
  });

  it("falls back to the timeline home target for unsupported urls", () => {
    const target = provider.normalizeInput("https://example.com", "browser");
    expect(target.resolvedUrl).toBe(provider.buildHomeUrl("browser"));
  });

  it("marks embed support as disabled", () => {
    expect(provider.definition.capabilities.embed).toBe(false);
  });

  it("reuses the browser session for mobile mode", () => {
    expect(
      provider.createSessionPartition("browser", {
        version: 1,
        windowBounds: {
          width: 420,
          height: 680
        },
        alwaysOnTop: true,
        opacity: 0.98,
        theme: "system",
        providerId: "x",
        mode: "browser",
        currentInput: "https://x.com/home",
        xMobileEmulation: true,
        shortcut: "CommandOrControl+Shift+Space",
        restoreLastSession: true,
        startHidden: false,
        launchAtLogin: false
      })
    ).toContain("/default");
  });
});
