import { describe, expect, it } from "vitest";
import { defaultSettings } from "../../src/shared/settings";
import { TikTokProvider } from "../../src/main/providers/tiktok";

describe("TikTokProvider", () => {
  const provider = new TikTokProvider();

  it("normalizes mobile web urls onto www.tiktok.com", () => {
    const target = provider.normalizeInput("tiktok.com/foryou");
    expect(target.resolvedUrl).toBe("https://www.tiktok.com/foryou");
  });

  it("falls back to the feed home target for unsupported urls", () => {
    const target = provider.normalizeInput("https://example.com");
    expect(target.resolvedUrl).toBe(provider.buildHomeUrl());
  });

  it("does not auto-promote out of desktop web", () => {
    expect(provider.shouldAutoPromoteBootstrap).toBeUndefined();
  });

  it("uses a stable isolated session partition", () => {
    expect(provider.createSessionPartition(defaultSettings)).toContain("/tiktok/browser/default");
  });
});
