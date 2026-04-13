import { describe, expect, it } from "vitest";
import { XProvider } from "../../src/main/providers/x";
import { defaultSettings } from "../../src/shared/settings";

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

  it("auto-promotes only authenticated X destinations", () => {
    expect(provider.shouldAutoPromoteBootstrap?.("https://x.com/home")).toBe(true);
    expect(provider.shouldAutoPromoteBootstrap?.("https://x.com/notifications")).toBe(true);
    expect(provider.shouldAutoPromoteBootstrap?.("https://x.com/i/flow/login")).toBe(false);
    expect(provider.shouldAutoPromoteBootstrap?.("https://x.com/OpenAI")).toBe(false);
  });

  it("uses a stable isolated session partition", () => {
    expect(provider.createSessionPartition(defaultSettings)).toContain("/default");
  });
});
