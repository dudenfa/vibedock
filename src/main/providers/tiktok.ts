import type { ProviderDefinition, ProviderResolvedTarget } from "../../shared/providers";
import type { AppSettings } from "../../shared/settings";
import { BaseProvider, type ProviderCreateViewOptions, type ProviderViewInstance } from "./base";

const TIKTOK_ALLOWED_HOSTS = [
  "www.tiktok.com",
  "tiktok.com",
  "m.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com"
];

const TIKTOK_MOBILE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const TIKTOK_ABORT_ERROR_CODE = -3;
const TIKTOK_LOAD_TIMEOUT_MS = 20000;
const TIKTOK_MOBILE_MAX_WIDTH = 430;
const TIKTOK_MOBILE_MIN_WIDTH = 390;
const TIKTOK_MOBILE_MIN_HEIGHT = 664;
const TIKTOK_MOBILE_MAX_HEIGHT = 932;
const TIKTOK_MOBILE_DEVICE_SCALE_FACTOR = 3;
const TIKTOK_DEFINITION: ProviderDefinition = {
  id: "tiktok",
  label: "TikTok",
  description: "Logged-in TikTok mobile web feed inside an isolated browser view."
};

export class TikTokProvider extends BaseProvider {
  definition = TIKTOK_DEFINITION;

  buildHomeUrl(): string {
    return "https://www.tiktok.com/foryou";
  }

  normalizeInput(input: string): ProviderResolvedTarget {
    const trimmed = input.trim() || this.buildHomeUrl();

    try {
      const normalized = this.normalizeUrl(trimmed);
      return {
        providerId: "tiktok",
        input: trimmed,
        resolvedUrl: normalized,
        title: "TikTok Feed"
      };
    } catch {
      const fallback = this.buildHomeUrl();
      return {
        providerId: "tiktok",
        input: fallback,
        resolvedUrl: fallback,
        title: "TikTok Feed"
      };
    }
  }

  createSessionPartition(settings: AppSettings): string {
    void settings;
    return "persist:vibedock/provider/tiktok/browser/default";
  }

  async createView(options: ProviderCreateViewOptions): Promise<ProviderViewInstance> {
    const partition = this.createSessionPartition(options.settings);
    const surface = options.surface;
    options.logger.info("Creating TikTok browser view", {
      partition,
      resolvedUrl: options.target.resolvedUrl,
      surface
    });

    const view = this.createIsolatedView(partition, options.logger, "tiktok:browser");
    if (surface === "bootstrap") {
      options.logger.info("Starting TikTok in desktop login helper mode");
      options.logger.info("Applying initial TikTok view bounds", {
        bounds: options.initialBounds
      });
      view.setBounds(options.initialBounds);
      options.logger.info("Loading TikTok URL", {
        resolvedUrl: options.target.resolvedUrl
      });
      await this.loadUrl(view, options);
      return {
        view,
        surface,
        destroy: () => {
          if (!view.webContents.isDestroyed()) {
            view.webContents.close({ waitForBeforeUnload: false });
          }
        }
      };
    }

    let hasFinishedFirstLoad = false;
    const applyBounds = (bounds: Electron.Rectangle) => {
      view.setBounds(bounds);
      if (hasFinishedFirstLoad) {
        void this.applyMobileBrowserOverrides(view, options.logger, bounds);
      }
    };

    view.webContents.setUserAgent(TIKTOK_MOBILE_USER_AGENT);
    view.webContents.on("did-finish-load", () => {
      hasFinishedFirstLoad = true;
      void this.applyMobileBrowserOverrides(view, options.logger, view.getBounds());
    });

    options.logger.info("Applying initial TikTok view bounds", {
      bounds: options.initialBounds
    });
    applyBounds(options.initialBounds);

    options.logger.info("Loading TikTok URL", {
      resolvedUrl: options.target.resolvedUrl
    });
    await this.loadUrl(view, options);

    return {
      view,
      surface,
      setBounds: applyBounds,
      destroy: () => {
        if (view.webContents.debugger.isAttached()) {
          try {
            view.webContents.debugger.detach();
          } catch {
            options.logger.warn("Unable to detach TikTok debugger session");
          }
        }

        if (!view.webContents.isDestroyed()) {
          view.webContents.close({ waitForBeforeUnload: false });
        }
      }
    };
  }

  private async loadUrl(
    view: ProviderViewInstance["view"],
    options: ProviderCreateViewOptions
  ): Promise<void> {
    const waitForMainFrameLoad = this.waitForMainFrameLoad(view, options);
    const loadUrl = view.webContents.loadURL(options.target.resolvedUrl).catch((error: Error) => {
      if (this.isAbortError(error)) {
        options.logger.warn("TikTok navigation was interrupted during handoff; waiting for the final page load", {
          resolvedUrl: options.target.resolvedUrl,
          message: error.message
        });
        return;
      }

      throw error;
    });

    await Promise.all([waitForMainFrameLoad, loadUrl]);
    options.logger.info("TikTok timeline finished loading", {
      resolvedUrl: view.webContents.getURL() || options.target.resolvedUrl
    });
  }

  private waitForMainFrameLoad(
    view: ProviderViewInstance["view"],
    options: ProviderCreateViewOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const finish = () => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        resolve();
      };

      const fail = (message: string) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        reject(new Error(message));
      };

      const onFinish = () => finish();
      const onFail = (
        _event: Electron.Event,
        errorCode: number,
        errorDescription: string,
        validatedURL: string,
        isMainFrame: boolean
      ) => {
        if (!isMainFrame) {
          return;
        }

        if (errorCode === TIKTOK_ABORT_ERROR_CODE) {
          options.logger.warn("TikTok reported a provisional navigation abort; waiting for follow-up navigation", {
            errorCode,
            errorDescription,
            validatedURL
          });
          return;
        }

        fail(`${errorDescription} (${errorCode}) loading '${validatedURL}'`);
      };

      const onDestroyed = () => fail("TikTok view was destroyed before navigation completed");
      const timeout = setTimeout(() => {
        fail(`Timed out after ${TIKTOK_LOAD_TIMEOUT_MS}ms waiting for TikTok to finish loading`);
      }, TIKTOK_LOAD_TIMEOUT_MS);

      const cleanup = () => {
        clearTimeout(timeout);
        view.webContents.removeListener("did-finish-load", onFinish);
        view.webContents.removeListener("did-fail-load", onFail);
        view.webContents.removeListener("did-fail-provisional-load", onFail);
        view.webContents.removeListener("destroyed", onDestroyed);
      };

      view.webContents.on("did-finish-load", onFinish);
      view.webContents.on("did-fail-load", onFail);
      view.webContents.on("did-fail-provisional-load", onFail);
      view.webContents.on("destroyed", onDestroyed);
    });
  }

  private isAbortError(error: Error): boolean {
    return error.message.includes("ERR_ABORTED");
  }

  private async applyMobileBrowserOverrides(
    view: ProviderViewInstance["view"],
    logger: ProviderCreateViewOptions["logger"],
    bounds: Electron.Rectangle
  ): Promise<void> {
    const devtools = view.webContents.debugger;
    const metrics = this.getMobileMetrics(bounds);

    try {
      logger.info("Applying TikTok mobile browser overrides");
      if (!devtools.isAttached()) {
        devtools.attach("1.3");
      }

      await devtools.sendCommand("Emulation.setUserAgentOverride", {
        userAgent: TIKTOK_MOBILE_USER_AGENT,
        acceptLanguage: "en-US,en;q=0.9",
        platform: "iPhone"
      });
      await devtools.sendCommand("Emulation.setDeviceMetricsOverride", {
        width: metrics.width,
        height: metrics.height,
        deviceScaleFactor: TIKTOK_MOBILE_DEVICE_SCALE_FACTOR,
        mobile: true,
        screenWidth: metrics.width,
        screenHeight: metrics.height,
        positionX: 0,
        positionY: 0,
        dontSetVisibleSize: false,
        screenOrientation: {
          type: "portraitPrimary",
          angle: 0
        }
      });
      await devtools.sendCommand("Emulation.setTouchEmulationEnabled", {
        enabled: true,
        maxTouchPoints: 5
      });
      await devtools.sendCommand("Emulation.setEmitTouchEventsForMouse", {
        enabled: true,
        configuration: "mobile"
      });
      logger.info("Applied TikTok mobile browser overrides", {
        userAgent: TIKTOK_MOBILE_USER_AGENT
      });
    } catch (error) {
      logger.warn("Unable to apply TikTok mobile browser overrides", {
        message: error instanceof Error ? error.message : "unknown"
      });
    }
  }

  private getMobileMetrics(bounds: Electron.Rectangle): { width: number; height: number } {
    const safeWidth = Math.max(1, bounds.width);
    const safeHeight = Math.max(1, bounds.height);
    const width = Math.max(TIKTOK_MOBILE_MIN_WIDTH, Math.min(safeWidth, TIKTOK_MOBILE_MAX_WIDTH));
    const proportionalHeight = Math.round((safeHeight / safeWidth) * width);
    const height = Math.max(TIKTOK_MOBILE_MIN_HEIGHT, Math.min(proportionalHeight, TIKTOK_MOBILE_MAX_HEIGHT));
    return { width, height };
  }

  private normalizeUrl(input: string): string {
    const candidate = input.startsWith("http") ? input : `https://${input}`;
    const parsed = new URL(candidate);

    if (!TIKTOK_ALLOWED_HOSTS.includes(parsed.hostname)) {
      return this.buildHomeUrl();
    }

    const pathname = !parsed.pathname || parsed.pathname === "/" ? "/foryou" : parsed.pathname;
    return `https://www.tiktok.com${pathname}${parsed.search}${parsed.hash}`;
  }
}
