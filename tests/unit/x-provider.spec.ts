import { describe, expect, it } from "vitest";
import { XProvider } from "../../src/main/providers/x";

describe("XProvider", () => {
  const provider = new XProvider();

  it("normalizes mobile web urls onto x.com", () => {
    const target = provider.normalizeInput("twitter.com/home");
    expect(target.resolvedUrl).toBe("https://x.com/home");
  });

  it("falls back to the timeline home target for unsupported urls", () => {
    const target = provider.normalizeInput("https://example.com");
    expect(target.resolvedUrl).toBe(provider.buildHomeUrl());
  });

  it("uses a stable isolated session partition", () => {
    expect(
      provider.createSessionPartition({
        version: 1,
        windowBounds: {
          width: 420,
          height: 680
        },
        alwaysOnTop: true,
        opacity: 0.98,
        providerId: "x",
        currentInput: "https://x.com/home",
        xBootstrapCompleted: false,
        shortcut: "CommandOrControl+Shift+Space",
        restoreLastSession: true,
        startHidden: false,
        launchAtLogin: false
      })
    ).toContain("/default");
  });
});
