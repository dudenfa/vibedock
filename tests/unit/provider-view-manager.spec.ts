import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderViewManager } from "../../src/main/provider-view-manager";
import { defaultSettings, type AppSettings } from "../../src/shared/settings";

class TestLogger {
  info = vi.fn();
  warn = vi.fn();
  error = vi.fn();
}

class TestSettingsService {
  constructor(private settings: AppSettings = defaultSettings) {}

  get(): AppSettings {
    return this.settings;
  }

  update(patch: Partial<AppSettings>): AppSettings {
    this.settings = {
      ...this.settings,
      ...patch,
      providerTabs: patch.providerTabs
        ? {
            ...this.settings.providerTabs,
            ...patch.providerTabs
          }
        : this.settings.providerTabs
    };
    return this.settings;
  }
}

class TestProviderRegistry {
  private providers = {
    x: {
      definition: {
        id: "x",
        label: "X",
        description: "X"
      },
      buildHomeUrl: () => "https://x.com/home",
      normalizeInput: (input: string) => ({
        providerId: "x" as const,
        input,
        resolvedUrl: input,
        title: "X Timeline"
      }),
      createSessionPartition: () => "persist:test:x",
      createView: vi.fn(),
      resolvePreferredSurface: vi.fn(),
      shouldAutoPromoteBootstrap: undefined
    },
    tiktok: {
      definition: {
        id: "tiktok",
        label: "TikTok",
        description: "TikTok"
      },
      buildHomeUrl: () => "https://www.tiktok.com/foryou",
      normalizeInput: (input: string) => ({
        providerId: "tiktok" as const,
        input,
        resolvedUrl: input,
        title: "TikTok Feed"
      }),
      createSessionPartition: () => "persist:test:tiktok",
      createView: vi.fn(),
      resolvePreferredSurface: undefined,
      shouldAutoPromoteBootstrap: undefined
    }
  };

  get(providerId: "x" | "tiktok") {
    return this.providers[providerId];
  }

  list() {
    return [this.providers.x.definition, this.providers.tiktok.definition];
  }
}

describe("ProviderViewManager", () => {
  let logger: TestLogger;
  let settings: TestSettingsService;
  let registry: TestProviderRegistry;
  let window: {
    setBrowserView: ReturnType<typeof vi.fn>;
    getBrowserView: ReturnType<typeof vi.fn>;
    setAlwaysOnTop: ReturnType<typeof vi.fn>;
    setOpacity: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    logger = new TestLogger();
    settings = new TestSettingsService();
    registry = new TestProviderRegistry();
    window = {
      setBrowserView: vi.fn(),
      getBrowserView: vi.fn(),
      setAlwaysOnTop: vi.fn(),
      setOpacity: vi.fn()
    };
  });

  it("ignores tiny content bounds updates", () => {
    const manager = new ProviderViewManager(
      window as never,
      registry as never,
      settings as never,
      logger as never
    );

    manager.setContentBounds({
      x: 25,
      y: 919,
      width: 457,
      height: 2
    });

    expect(logger.warn).toHaveBeenCalledWith("Ignoring tiny content bounds update", {
      bounds: {
        x: 25,
        y: 919,
        width: 457,
        height: 2
      }
    });
  });

  it("keeps a provider view alive when switching tabs", async () => {
    const manager = new ProviderViewManager(
      window as never,
      registry as never,
      settings as never,
      logger as never
    );
    const xView = {
      view: { webContents: { isDestroyed: () => false, executeJavaScript: vi.fn() } },
      surface: "mobile" as const,
      destroy: vi.fn(),
      setBounds: vi.fn()
    };
    const tikTokView = {
      view: { webContents: { isDestroyed: () => false, executeJavaScript: vi.fn() } },
      surface: "bootstrap" as const,
      destroy: vi.fn(),
      setBounds: vi.fn()
    };

    registry.get("x").createView.mockResolvedValueOnce(xView);
    registry.get("tiktok").createView.mockResolvedValueOnce(tikTokView);

    await manager.navigate({
      providerId: "x",
      input: "https://x.com/home"
    });

    await manager.activateProvider({
      providerId: "tiktok"
    });

    await manager.activateProvider({
      providerId: "x"
    });

    expect(xView.destroy).not.toHaveBeenCalled();
    expect(window.setBrowserView).toHaveBeenCalled();
  });

  it("reports desktop web status for the active tiktok provider", async () => {
    settings = new TestSettingsService({
      ...defaultSettings,
      activeProviderId: "tiktok",
      providerTabs: {
        ...defaultSettings.providerTabs,
        tiktok: {
          currentInput: "https://www.tiktok.com/foryou",
          bootstrapCompleted: false
        }
      }
    });
    const manager = new ProviderViewManager(
      window as never,
      registry as never,
      settings as never,
      logger as never
    );
    const bootstrapView = {
      view: { webContents: { on: vi.fn(), isDestroyed: () => false } },
      surface: "bootstrap" as const,
      destroy: vi.fn(),
      setBounds: vi.fn()
    };

    registry.get("tiktok").createView.mockResolvedValueOnce(bootstrapView);

    const state = await manager.navigate({
      providerId: "tiktok",
      input: "https://www.tiktok.com/foryou"
    });

    expect(state.activeProviderId).toBe("tiktok");
    expect(state.activeSurface).toBe("bootstrap");
    expect(state.statusMessage).toBe("TikTok desktop web");
  });

  it("downgrades X to desktop web on startup when no authenticated session is detected", async () => {
    settings = new TestSettingsService({
      ...defaultSettings,
      activeProviderId: "x",
      providerTabs: {
        ...defaultSettings.providerTabs,
        x: {
          currentInput: "https://x.com/home",
          bootstrapCompleted: true
        }
      }
    });

    const manager = new ProviderViewManager(
      window as never,
      registry as never,
      settings as never,
      logger as never
    );
    const bootstrapView = {
      view: { webContents: { on: vi.fn(), isDestroyed: () => false } },
      surface: "bootstrap" as const,
      destroy: vi.fn(),
      setBounds: vi.fn()
    };

    registry.get("x").resolvePreferredSurface.mockResolvedValueOnce("bootstrap");
    registry.get("x").createView.mockResolvedValueOnce(bootstrapView);

    const state = await manager.activateProvider({
      providerId: "x"
    });

    expect(registry.get("x").resolvePreferredSurface).toHaveBeenCalled();
    expect(registry.get("x").createView).toHaveBeenCalledWith(
      expect.objectContaining({
        surface: "bootstrap"
      })
    );
    expect(state.activeSurface).toBe("bootstrap");
    expect(state.statusMessage).toBe("Desktop login helper");
  });
});
