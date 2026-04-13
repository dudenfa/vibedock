import type { ProviderDefinition, ProviderResolvedTarget } from "../../shared/providers";
import type { AppSettings } from "../../shared/settings";
import { BaseProvider, type ProviderCreateViewOptions, type ProviderViewInstance } from "./base";

const INSTAGRAM_ALLOWED_HOSTS = [
  "www.instagram.com",
  "instagram.com"
];

const INSTAGRAM_MOBILE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const INSTAGRAM_ABORT_ERROR_CODE = -3;
const INSTAGRAM_LOAD_TIMEOUT_MS = 20000;
const INSTAGRAM_MOBILE_MAX_WIDTH = 430;
const INSTAGRAM_MOBILE_MIN_WIDTH = 390;
const INSTAGRAM_MOBILE_MIN_HEIGHT = 664;
const INSTAGRAM_MOBILE_MAX_HEIGHT = 932;
const INSTAGRAM_MOBILE_DEVICE_SCALE_FACTOR = 3;
const INSTAGRAM_PULL_TO_REFRESH_SCRIPT = `
  (() => {
    if ((window).__vibedockInstagramPullToRefreshInstalled) {
      return;
    }

    (window).__vibedockInstagramPullToRefreshInstalled = true;

    const PULL_THRESHOLD = 108;
    const WHEEL_PULL_THRESHOLD = 220;
    let startY = null;
    let lastY = null;
    let armed = false;
    let isPointerActive = false;
    let wheelPullDistance = 0;
    let wheelResetTimer = null;

    const findScrollParent = (node) => {
      let current = node;
      while (current && current !== document.body && current !== document.documentElement) {
        if (current instanceof HTMLElement) {
          const style = window.getComputedStyle(current);
          const canScroll =
            (style.overflowY === "auto" || style.overflowY === "scroll") &&
            current.scrollHeight > current.clientHeight + 24;
          if (canScroll) {
            return current;
          }
        }
        current = current.parentElement;
      }
      return null;
    };

    const getPrimaryScrollElement = () => {
      const probePoints = [
        [window.innerWidth / 2, Math.min(120, Math.max(24, window.innerHeight * 0.15))],
        [window.innerWidth / 2, Math.min(220, Math.max(40, window.innerHeight * 0.3))]
      ];

      for (const [x, y] of probePoints) {
        const node = document.elementFromPoint(x, y);
        const scrollParent = findScrollParent(node);
        if (scrollParent) {
          return scrollParent;
        }
      }

      const scrollingElement = document.scrollingElement;
      let best = scrollingElement instanceof HTMLElement ? scrollingElement : null;
      let bestScore = best ? best.clientHeight : 0;

      for (const element of Array.from(document.querySelectorAll("*"))) {
        if (!(element instanceof HTMLElement)) {
          continue;
        }

        const style = window.getComputedStyle(element);
        const canScroll =
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          element.scrollHeight > element.clientHeight + 24 &&
          element.clientHeight > 160;

        if (!canScroll) {
          continue;
        }

        const rect = element.getBoundingClientRect();
        if (rect.width < 120 || rect.height < 160) {
          continue;
        }

        const score = rect.height;
        if (score > bestScore) {
          best = element;
          bestScore = score;
        }
      }

      return best;
    };

    const getScrollTop = () => {
      const primary = getPrimaryScrollElement();
      if (primary instanceof HTMLElement) {
        return primary.scrollTop;
      }

      return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    };

    const isAtTop = () => getScrollTop() <= 2;

    const scheduleWheelReset = () => {
      if (wheelResetTimer) {
        window.clearTimeout(wheelResetTimer);
      }

      wheelResetTimer = window.setTimeout(() => {
        wheelPullDistance = 0;
      }, 180);
    };

    const begin = (y) => {
      startY = y;
      lastY = y;
      armed = isAtTop();
      isPointerActive = true;
    };

    const move = (y) => {
      if (!isPointerActive || startY === null) {
        return;
      }

      lastY = y;
      if (!isAtTop()) {
        armed = false;
      }
    };

    const end = () => {
      if (!isPointerActive || startY === null || lastY === null) {
        startY = null;
        lastY = null;
        armed = false;
        isPointerActive = false;
        return;
      }

      const deltaY = lastY - startY;
      const shouldRefresh = armed && deltaY >= PULL_THRESHOLD;

      startY = null;
      lastY = null;
      armed = false;
      isPointerActive = false;

      if (shouldRefresh) {
        window.location.reload();
      }
    };

    const onWheel = (event) => {
      if (!isAtTop()) {
        wheelPullDistance = 0;
        scheduleWheelReset();
        return;
      }

      if (event.deltaY < 0) {
        wheelPullDistance += Math.abs(event.deltaY);
        scheduleWheelReset();
        if (wheelPullDistance >= WHEEL_PULL_THRESHOLD) {
          wheelPullDistance = 0;
          if (wheelResetTimer) {
            window.clearTimeout(wheelResetTimer);
            wheelResetTimer = null;
          }
          window.location.reload();
        }
        return;
      }

      wheelPullDistance = 0;
      scheduleWheelReset();
    };

    document.addEventListener("touchstart", (event) => {
      const touch = event.touches[0];
      if (!touch) {
        return;
      }
      begin(touch.clientY);
    }, { passive: true, capture: true });

    document.addEventListener("touchmove", (event) => {
      const touch = event.touches[0];
      if (!touch) {
        return;
      }
      move(touch.clientY);
    }, { passive: true, capture: true });

    document.addEventListener("touchend", () => {
      end();
    }, { passive: true, capture: true });

    document.addEventListener("mousedown", (event) => {
      begin(event.clientY);
    }, true);

    document.addEventListener("mousemove", (event) => {
      move(event.clientY);
    }, true);

    document.addEventListener("mouseup", () => {
      end();
    }, true);

    document.addEventListener("pointerdown", (event) => {
      begin(event.clientY);
    }, true);

    document.addEventListener("pointermove", (event) => {
      move(event.clientY);
    }, true);

    document.addEventListener("pointerup", () => {
      end();
    }, true);

    document.addEventListener("wheel", onWheel, { passive: true, capture: true });
  })();
`;

const INSTAGRAM_DEFINITION: ProviderDefinition = {
  id: "instagram",
  label: "Instagram",
  description: "Best-effort Instagram desktop web shell inside an isolated browser view."
};

export class InstagramProvider extends BaseProvider {
  definition = INSTAGRAM_DEFINITION;

  buildHomeUrl(): string {
    return "https://www.instagram.com/";
  }

  normalizeInput(input: string): ProviderResolvedTarget {
    const trimmed = input.trim() || this.buildHomeUrl();

    try {
      const normalized = this.normalizeUrl(trimmed);
      return {
        providerId: "instagram",
        input: trimmed,
        resolvedUrl: normalized,
        title: "Instagram"
      };
    } catch {
      const fallback = this.buildHomeUrl();
      return {
        providerId: "instagram",
        input: fallback,
        resolvedUrl: fallback,
        title: "Instagram"
      };
    }
  }

  createSessionPartition(settings: AppSettings): string {
    void settings;
    return "persist:vibedock/provider/instagram/browser/default";
  }

  async createView(options: ProviderCreateViewOptions): Promise<ProviderViewInstance> {
    const partition = this.createSessionPartition(options.settings);
    const surface = options.surface;
    options.logger.info("Creating Instagram browser view", {
      partition,
      resolvedUrl: options.target.resolvedUrl,
      surface
    });

    const view = this.createIsolatedView(partition, options.logger, "instagram:browser");

    if (surface === "bootstrap") {
      options.logger.info("Starting Instagram in desktop web mode");
      view.setBounds(options.initialBounds);
      options.logger.info("Loading Instagram URL", {
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

    view.webContents.setUserAgent(INSTAGRAM_MOBILE_USER_AGENT);
    view.webContents.on("did-finish-load", () => {
      hasFinishedFirstLoad = true;
      void this.applyMobileBrowserOverrides(view, options.logger, view.getBounds());
      this.installPullToRefreshFallback(view, options.logger);
    });

    applyBounds(options.initialBounds);
    options.logger.info("Loading Instagram URL", {
      resolvedUrl: options.target.resolvedUrl
    });
    await this.loadUrl(view, options);
    this.installPullToRefreshFallback(view, options.logger);

    return {
      view,
      surface,
      setBounds: applyBounds,
      destroy: () => {
        if (view.webContents.debugger.isAttached()) {
          try {
            view.webContents.debugger.detach();
          } catch {
            options.logger.warn("Unable to detach Instagram debugger session");
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
        options.logger.warn("Instagram navigation was interrupted during handoff; waiting for the final page load", {
          resolvedUrl: options.target.resolvedUrl,
          message: error.message
        });
        return;
      }

      throw error;
    });

    await Promise.all([waitForMainFrameLoad, loadUrl]);
    options.logger.info("Instagram view finished loading", {
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

        if (errorCode === INSTAGRAM_ABORT_ERROR_CODE) {
          options.logger.warn("Instagram reported a provisional navigation abort; waiting for follow-up navigation", {
            errorCode,
            errorDescription,
            validatedURL
          });
          return;
        }

        fail(`${errorDescription} (${errorCode}) loading '${validatedURL}'`);
      };

      const onDestroyed = () => fail("Instagram view was destroyed before navigation completed");
      const timeout = setTimeout(() => {
        fail(`Timed out after ${INSTAGRAM_LOAD_TIMEOUT_MS}ms waiting for Instagram to finish loading`);
      }, INSTAGRAM_LOAD_TIMEOUT_MS);

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
      logger.info("Applying Instagram mobile browser overrides");
      if (!devtools.isAttached()) {
        devtools.attach("1.3");
      }

      await devtools.sendCommand("Emulation.setUserAgentOverride", {
        userAgent: INSTAGRAM_MOBILE_USER_AGENT,
        acceptLanguage: "en-US,en;q=0.9",
        platform: "iPhone"
      });
      await devtools.sendCommand("Emulation.setDeviceMetricsOverride", {
        width: metrics.width,
        height: metrics.height,
        deviceScaleFactor: INSTAGRAM_MOBILE_DEVICE_SCALE_FACTOR,
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
      logger.info("Applied Instagram mobile browser overrides", {
        userAgent: INSTAGRAM_MOBILE_USER_AGENT
      });
    } catch (error) {
      logger.warn("Unable to apply Instagram mobile browser overrides", {
        message: error instanceof Error ? error.message : "unknown"
      });
    }
  }

  private installPullToRefreshFallback(
    view: ProviderViewInstance["view"],
    logger: ProviderCreateViewOptions["logger"]
  ): void {
    if (view.webContents.isDestroyed()) {
      return;
    }

    void view.webContents.executeJavaScript(INSTAGRAM_PULL_TO_REFRESH_SCRIPT, true).catch((error) => {
      logger.warn("Unable to install Instagram pull-to-refresh fallback", {
        message: error instanceof Error ? error.message : "unknown"
      });
    });
  }

  private getMobileMetrics(bounds: Electron.Rectangle): { width: number; height: number } {
    const safeWidth = Math.max(1, bounds.width);
    const safeHeight = Math.max(1, bounds.height);
    const width = Math.max(INSTAGRAM_MOBILE_MIN_WIDTH, Math.min(safeWidth, INSTAGRAM_MOBILE_MAX_WIDTH));
    const proportionalHeight = Math.round((safeHeight / safeWidth) * width);
    const height = Math.max(INSTAGRAM_MOBILE_MIN_HEIGHT, Math.min(proportionalHeight, INSTAGRAM_MOBILE_MAX_HEIGHT));
    return { width, height };
  }

  private normalizeUrl(input: string): string {
    const candidate = input.startsWith("http") ? input : `https://${input}`;
    const parsed = new URL(candidate);

    if (!INSTAGRAM_ALLOWED_HOSTS.includes(parsed.hostname)) {
      return this.buildHomeUrl();
    }

    const pathname = parsed.pathname || "/";
    return `https://www.instagram.com${pathname}${parsed.search}${parsed.hash}`;
  }
}
