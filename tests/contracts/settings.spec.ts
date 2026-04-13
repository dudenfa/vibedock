import { describe, expect, it } from "vitest";
import { appSettingsSchema, defaultSettings, normalizeStoredSettings } from "../../src/shared/settings";

describe("settings schema", () => {
  it("accepts the default settings", () => {
    expect(() => appSettingsSchema.parse(defaultSettings)).not.toThrow();
    expect(defaultSettings.windowSizePreset).toBe("medium");
  });

  it("rejects an opacity below the supported floor", () => {
    expect(() =>
      appSettingsSchema.parse({
        ...defaultSettings,
        opacity: 0.5
      })
    ).toThrow();
  });

  it("migrates legacy v1 X-only settings into v2 provider tabs", () => {
    const parsed = normalizeStoredSettings({
      version: 1,
      windowBounds: {
        width: 420,
        height: 680
      },
      alwaysOnTop: true,
      opacity: 0.98,
      providerId: "x",
      currentInput: "https://x.com/home",
      xBootstrapCompleted: true,
      shortcut: "CommandOrControl+Shift+Space",
      restoreLastSession: true,
      startHidden: false,
      launchAtLogin: false
    });

    expect(parsed.version).toBe(2);
    expect(parsed.activeProviderId).toBe("x");
    expect(parsed.windowSizePreset).toBe("medium");
    expect(parsed.providerTabs.x).toEqual({
      currentInput: "https://x.com/home",
      bootstrapCompleted: true
    });
    expect(parsed.providerTabs.tiktok).toEqual({
      currentInput: "https://www.tiktok.com/foryou",
      bootstrapCompleted: false
    });
    expect(parsed.providerTabs.instagram).toEqual({
      currentInput: "https://www.instagram.com/",
      bootstrapCompleted: true
    });
  });

  it("preserves the inferred X bootstrap completion when legacy settings omit the flag", () => {
    const parsed = normalizeStoredSettings(
      {
        version: 1,
        windowBounds: {
          width: 420,
          height: 680
        },
        alwaysOnTop: true,
        opacity: 0.98,
        providerId: "x",
        currentInput: "https://x.com/home",
        shortcut: "CommandOrControl+Shift+Space",
        restoreLastSession: true,
        startHidden: false,
        launchAtLogin: false
      },
      {
        hasPersistedXSessionArtifacts: true
      }
    );

    expect(parsed.providerTabs.x.bootstrapCompleted).toBe(true);
    expect(parsed.providerTabs.x.currentInput).toBe("https://x.com/home");
    expect(parsed.windowSizePreset).toBe("medium");
    expect(parsed.providerTabs.instagram.currentInput).toBe("https://www.instagram.com/");
    expect(parsed.providerTabs.instagram.bootstrapCompleted).toBe(true);
  });

  it("preserves an explicit window size preset during migration", () => {
    const parsed = normalizeStoredSettings({
      version: 1,
      windowBounds: {
        width: 420,
        height: 680
      },
      alwaysOnTop: true,
      opacity: 0.98,
      windowSizePreset: "big",
      providerId: "x",
      currentInput: "https://x.com/home",
      xBootstrapCompleted: false,
      shortcut: "CommandOrControl+Shift+Space",
      restoreLastSession: true,
      startHidden: false,
      launchAtLogin: false
    });

    expect(parsed.windowSizePreset).toBe("big");
  });
});
