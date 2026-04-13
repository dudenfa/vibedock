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
      ...patch
    };
    return this.settings;
  }
}

class TestProviderRegistry {
  private provider = {
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
    createSessionPartition: () => "persist:test",
    createView: vi.fn()
  };

  get() {
    return this.provider;
  }

  list() {
    return [this.provider.definition];
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

  it("keeps the current provider view mounted when the next navigation fails", async () => {
    const manager = new ProviderViewManager(
      window as never,
      registry as never,
      settings as never,
      logger as never
    );
    const currentView = {
      view: { id: "current" },
      surface: "mobile" as const,
      destroy: vi.fn(),
      setBounds: vi.fn()
    };

    registry.get().createView.mockResolvedValueOnce(currentView);
    window.getBrowserView.mockReturnValue(currentView.view);

    await manager.navigate({
      input: "https://x.com/home"
    });

    registry.get().createView.mockRejectedValueOnce(new Error("boom"));

    await manager.navigate({
      input: "https://x.com/mobile"
    });

    expect(window.setBrowserView).toHaveBeenCalledTimes(1);
    expect(currentView.destroy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("Failed to navigate provider", {
      message: "boom"
    });
  });

  it("reports bootstrap surface when the desktop login helper is active", async () => {
    settings = new TestSettingsService({
      ...defaultSettings,
      xBootstrapCompleted: false
    });
    const manager = new ProviderViewManager(
      window as never,
      registry as never,
      settings as never,
      logger as never
    );
    const bootstrapView = {
      view: { id: "bootstrap" },
      surface: "bootstrap" as const,
      destroy: vi.fn(),
      setBounds: vi.fn()
    };

    registry.get().createView.mockResolvedValueOnce(bootstrapView);

    const state = await manager.navigate({
      input: "https://x.com/home"
    });

    expect(state.activeSurface).toBe("bootstrap");
    expect(state.statusMessage).toBe("Desktop login helper");
  });
});
