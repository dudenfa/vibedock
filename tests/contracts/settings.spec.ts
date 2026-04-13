import { describe, expect, it } from "vitest";
import { appSettingsSchema, defaultSettings } from "../../src/shared/settings";

describe("settings schema", () => {
  it("accepts the default settings", () => {
    expect(() => appSettingsSchema.parse(defaultSettings)).not.toThrow();
  });

  it("rejects an opacity below the supported floor", () => {
    expect(() =>
      appSettingsSchema.parse({
        ...defaultSettings,
        opacity: 0.5
      })
    ).toThrow();
  });

  it("strips legacy browser-mode settings keys", () => {
    const parsed = appSettingsSchema.parse({
      ...defaultSettings,
      theme: "system",
      mode: "browser",
      xMobileEmulation: true
    });

    expect(parsed).not.toHaveProperty("theme");
    expect(parsed).not.toHaveProperty("mode");
    expect(parsed).not.toHaveProperty("xMobileEmulation");
  });
});
