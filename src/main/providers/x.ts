import type { ProviderDefinition, ProviderResolvedTarget } from "../../shared/providers";
import type { AppSettings } from "../../shared/settings";
import { BaseProvider, type ProviderCreateViewOptions, type ProviderViewInstance } from "./base";

const X_ALLOWED_HOSTS = [
  "x.com",
  "twitter.com",
  "mobile.twitter.com",
  "t.co",
  "video.twimg.com",
  "pbs.twimg.com",
  "abs.twimg.com",
  "platform.twitter.com"
];

const X_MOBILE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const X_TIMELINE_LAYOUT_CSS = `
  html, body {
    background: #000 !important;
    overscroll-behavior-y: contain;
  }

  header[role="banner"] {
    display: none !important;
  }

  [data-testid="sidebarColumn"] {
    display: none !important;
  }

  main[role="main"] > div {
    justify-content: flex-start !important;
  }

  [data-testid="primaryColumn"] {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 100% !important;
    border-right: none !important;
    border-left: none !important;
  }

  body {
    background: #000 !important;
  }
`;

const X_ABORT_ERROR_CODE = -3;
const X_LOAD_TIMEOUT_MS = 20000;
const X_MOBILE_MAX_WIDTH = 430;
const X_MOBILE_MIN_WIDTH = 390;
const X_MOBILE_MIN_HEIGHT = 664;
const X_MOBILE_MAX_HEIGHT = 932;
const X_MOBILE_DEVICE_SCALE_FACTOR = 3;

const X_DEFINITION: ProviderDefinition = {
  id: "x",
  label: "X",
  description: "Logged-in X mobile web timeline inside an isolated browser view."
};

export class XProvider extends BaseProvider {
  definition = X_DEFINITION;

  buildHomeUrl(): string {
    return "https://x.com/home";
  }

  normalizeInput(input: string): ProviderResolvedTarget {
    const trimmed = input.trim() || this.buildHomeUrl();

    try {
      const normalized = this.normalizeUrl(trimmed);
      return {
        providerId: "x",
        input: trimmed,
        resolvedUrl: normalized,
        title: "X Timeline"
      };
    } catch {
      const fallback = this.buildHomeUrl();
      return {
        providerId: "x",
        input: fallback,
        resolvedUrl: fallback,
        title: "X Timeline"
      };
    }
  }

  createSessionPartition(settings: AppSettings): string {
    void settings;
    return "persist:vibedock/provider/x/browser/default";
  }

  async createView(options: ProviderCreateViewOptions): Promise<ProviderViewInstance> {
    const partition = this.createSessionPartition(options.settings);
    const surface = options.settings.xBootstrapCompleted ? "mobile" : "bootstrap";
    options.logger.info("Creating X browser view", {
      partition,
      resolvedUrl: options.target.resolvedUrl,
      surface
    });

    const view = this.createIsolatedView(partition, options.logger, "x:browser");
    if (surface === "bootstrap") {
      options.logger.info("Starting X in desktop login helper mode");
      options.logger.info("Applying initial X view bounds", {
        bounds: options.initialBounds
      });
      view.setBounds(options.initialBounds);
      options.logger.info("Loading X URL", {
        resolvedUrl: options.target.resolvedUrl
      });
      await this.loadTimelineUrl(view, options);
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

    view.webContents.setUserAgent(X_MOBILE_USER_AGENT);

    view.webContents.on("did-finish-load", () => {
      hasFinishedFirstLoad = true;
      void this.applyMobileBrowserOverrides(view, options.logger, view.getBounds());
      this.applyLayoutCss(view, options);
    });

    options.logger.info("Applying initial X view bounds", {
      bounds: options.initialBounds
    });
    applyBounds(options.initialBounds);

    options.logger.info("Loading X URL", {
      resolvedUrl: options.target.resolvedUrl
    });
    await this.loadTimelineUrl(view, options);
    this.applyLayoutCss(view, options);

    return {
      view,
      surface,
      setBounds: applyBounds,
      destroy: () => {
        if (view.webContents.debugger.isAttached()) {
          try {
            view.webContents.debugger.detach();
          } catch {
            options.logger.warn("Unable to detach X debugger session");
          }
        }

        if (!view.webContents.isDestroyed()) {
          view.webContents.close({ waitForBeforeUnload: false });
        }
      }
    };
  }

  private applyLayoutCss(view: ProviderViewInstance["view"], options: ProviderCreateViewOptions): void {
    if (view.webContents.isDestroyed()) {
      return;
    }

    void view.webContents.insertCSS(X_TIMELINE_LAYOUT_CSS).catch(() => {
      options.logger.warn("Unable to apply X timeline layout");
    });
  }

  private async loadTimelineUrl(
    view: ProviderViewInstance["view"],
    options: ProviderCreateViewOptions
  ): Promise<void> {
    const waitForMainFrameLoad = this.waitForMainFrameLoad(view, options);
    const loadUrl = view.webContents.loadURL(options.target.resolvedUrl).catch((error: Error) => {
      if (this.isAbortError(error)) {
        options.logger.warn("X navigation was interrupted during handoff; waiting for the final page load", {
          resolvedUrl: options.target.resolvedUrl,
          message: error.message
        });
        return;
      }

      throw error;
    });

    await Promise.all([waitForMainFrameLoad, loadUrl]);
    options.logger.info("X timeline finished loading", {
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

      const onFinish = () => {
        finish();
      };

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

        if (errorCode === X_ABORT_ERROR_CODE) {
          options.logger.warn("X reported a provisional navigation abort; waiting for follow-up navigation", {
            errorCode,
            errorDescription,
            validatedURL
          });
          return;
        }

        fail(`${errorDescription} (${errorCode}) loading '${validatedURL}'`);
      };

      const onDestroyed = () => {
        fail("X view was destroyed before navigation completed");
      };

      const timeout = setTimeout(() => {
        fail(`Timed out after ${X_LOAD_TIMEOUT_MS}ms waiting for X to finish loading`);
      }, X_LOAD_TIMEOUT_MS);

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
      logger.info("Applying X mobile browser overrides");
      if (!devtools.isAttached()) {
        devtools.attach("1.3");
      }

      await devtools.sendCommand("Emulation.setUserAgentOverride", {
        userAgent: X_MOBILE_USER_AGENT,
        acceptLanguage: "en-US,en;q=0.9",
        platform: "iPhone"
      });
      await devtools.sendCommand("Emulation.setDeviceMetricsOverride", {
        width: metrics.width,
        height: metrics.height,
        deviceScaleFactor: X_MOBILE_DEVICE_SCALE_FACTOR,
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
      logger.info("Applied X mobile browser overrides", {
        userAgent: X_MOBILE_USER_AGENT
      });
    } catch (error) {
      logger.warn("Unable to apply X mobile browser overrides", {
        message: error instanceof Error ? error.message : "unknown"
      });
    }
  }

  private getMobileMetrics(bounds: Electron.Rectangle): { width: number; height: number } {
    const safeWidth = Math.max(1, bounds.width);
    const safeHeight = Math.max(1, bounds.height);
    const width = Math.max(X_MOBILE_MIN_WIDTH, Math.min(safeWidth, X_MOBILE_MAX_WIDTH));
    const proportionalHeight = Math.round((safeHeight / safeWidth) * width);
    const height = Math.max(X_MOBILE_MIN_HEIGHT, Math.min(proportionalHeight, X_MOBILE_MAX_HEIGHT));
    return { width, height };
  }

  private normalizeUrl(input: string): string {
    const candidate = input.startsWith("http") ? input : `https://${input}`;
    const parsed = new URL(candidate);

    if (!X_ALLOWED_HOSTS.includes(parsed.hostname)) {
      return this.buildHomeUrl();
    }

    const pathname = !parsed.pathname || parsed.pathname === "/" ? "/home" : parsed.pathname;
    return `https://x.com${pathname}${parsed.search}${parsed.hash}`;
  }
}
