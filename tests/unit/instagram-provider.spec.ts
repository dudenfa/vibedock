import { describe, expect, it } from "vitest";
import { ProviderRegistry } from "../../src/main/provider-registry";
import { InstagramProvider } from "../../src/main/providers/instagram";
import { defaultSettings } from "../../src/shared/settings";

describe("InstagramProvider", () => {
  const provider = new InstagramProvider();

  it("normalizes supported instagram web urls onto www.instagram.com", () => {
    const target = provider.normalizeInput("instagram.com/reel/abc123/");
    expect(target.providerId).toBe("instagram");
    expect(target.resolvedUrl).toBe("https://www.instagram.com/reel/abc123/");
  });

  it("falls back to the home target for unsupported urls", () => {
    const target = provider.normalizeInput("https://example.com");
    expect(target.resolvedUrl).toBe(provider.buildHomeUrl());
  });

  it("does not expose an auto-promotion hook", () => {
    expect(provider.shouldAutoPromoteBootstrap).toBeUndefined();
  });

  it("uses a stable isolated session partition", () => {
    expect(provider.createSessionPartition(defaultSettings)).toContain("/instagram/browser/default");
  });

  it("is registered with the provider registry", () => {
    const registry = new ProviderRegistry();
    const registered = registry.get("instagram");

    expect(registered.definition.id).toBe("instagram");
    expect(registry.list().map((definition) => definition.id)).toContain("instagram");
  });
});
