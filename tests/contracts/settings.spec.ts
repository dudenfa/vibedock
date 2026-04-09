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

  it("accepts the mobile emulation toggle", () => {
    expect(() =>
      appSettingsSchema.parse({
        ...defaultSettings,
        xMobileEmulation: true
      })
    ).not.toThrow();
  });
});
