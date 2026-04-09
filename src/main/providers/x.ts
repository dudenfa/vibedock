import type { ProviderDefinition, ProviderMode, ProviderResolvedTarget } from "../../shared/providers";
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

const X_COMPACT_LAYOUT_CSS = `
  @media (min-width: 720px) {
    header[role="banner"],
    [data-testid="sidebarColumn"] {
      display: none !important;
    }

    main[role="main"] > div {
      justify-content: center !important;
    }

    [data-testid="primaryColumn"] {
      width: min(100vw, 680px) !important;
      max-width: min(100vw, 680px) !important;
      border-right: none !important;
    }
  }

  body {
    background: #000 !important;
  }
`;

const CHROME_VERSION = process.versions.chrome || "136.0.0.0";
const CHROME_MAJOR_VERSION = CHROME_VERSION.split(".")[0] || "136";
const X_MOBILE_USER_AGENT =
  `Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 ` +
  `(KHTML, like Gecko) Chrome/${CHROME_VERSION} Mobile Safari/537.36`;

const X_MOBILE_USER_AGENT_METADATA = {
  brands: [
    { brand: "Chromium", version: CHROME_MAJOR_VERSION },
    { brand: "Google Chrome", version: CHROME_MAJOR_VERSION },
    { brand: "Not.A/Brand", version: "24" }
  ],
  fullVersionList: [
    { brand: "Chromium", version: CHROME_VERSION },
    { brand: "Google Chrome", version: CHROME_VERSION },
    { brand: "Not.A/Brand", version: "24.0.0.0" }
  ],
  platform: "Android",
  platformVersion: "14.0.0",
  architecture: "arm",
  model: "Pixel 7",
  mobile: true,
  bitness: "64",
  wow64: false,
  formFactors: ["Mobile"]
} as const;

const X_MOBILE_LAYOUT_CSS = `
  body {
    background: #000 !important;
  }
`;

const X_DEFINITION: ProviderDefinition = {
  id: "x",
  label: "X",
  description: "Logged-in X timeline browsing inside an isolated browser view.",
  capabilities: {
    browser: true,
    embed: false,
    browserExperimental: true
  }
};

export class XProvider extends BaseProvider {
  definition = X_DEFINITION;

  buildHomeUrl(mode: ProviderMode): string {
    void mode;
    return "https://x.com/home";
  }

  normalizeInput(input: string, mode: ProviderMode): ProviderResolvedTarget {
    const trimmed = input.trim() || this.buildHomeUrl(mode);

    try {
      const normalized = this.normalizeUrl(trimmed, mode);
      return {
        providerId: "x",
        mode,
        input: trimmed,
        resolvedUrl: normalized,
        title: "X Timeline"
      };
    } catch {
      const fallback = this.buildHomeUrl(mode);
      return {
        providerId: "x",
        mode,
        input: fallback,
        resolvedUrl: fallback,
        title: "X Timeline"
      };
    }
  }

  createSessionPartition(mode: ProviderMode, settings: AppSettings): string {
    void mode;
    void settings;
    return "persist:vibedock/provider/x/browser/default";
  }

  async createView(options: ProviderCreateViewOptions): Promise<ProviderViewInstance> {
    const partition = this.createSessionPartition(options.mode, options.settings);
    options.logger.info("Creating X browser view", {
      partition,
      resolvedUrl: options.target.resolvedUrl,
      mobileEmulation: options.settings.xMobileEmulation
    });
    const { view } = this.createIsolatedView(partition, options.logger, `x:${options.mode}`);
    const applyBounds = (bounds: Electron.Rectangle) => {
      view.setBounds(bounds);
    };

    if (options.settings.xMobileEmulation) {
      await this.applyMobileBrowserOverrides(view, options.logger);
    }

    view.webContents.on("did-finish-load", () => {
      this.applyLayoutCss(view, options);
    });

    options.logger.info("Applying initial X view bounds", {
      bounds: options.initialBounds
    });
    applyBounds(options.initialBounds);

    options.logger.info("Loading X URL", {
      resolvedUrl: options.target.resolvedUrl
    });
    await view.webContents.loadURL(options.target.resolvedUrl);
    this.applyLayoutCss(view, options);

    return {
      view,
      title: options.target.title,
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

  isInternalNavigation(url: string, mode: ProviderMode): boolean {
    void mode;
    try {
      const parsed = new URL(url);

      if (!X_ALLOWED_HOSTS.includes(parsed.hostname)) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private applyLayoutCss(view: ProviderViewInstance["view"], options: ProviderCreateViewOptions): void {
    if (view.webContents.isDestroyed()) {
      return;
    }

    const css = options.settings.xMobileEmulation ? X_MOBILE_LAYOUT_CSS : X_COMPACT_LAYOUT_CSS;

    void view.webContents.insertCSS(css).catch(() => {
      options.logger.warn("Unable to apply compact X layout");
    });
  }

  private async applyMobileBrowserOverrides(
    view: ProviderViewInstance["view"],
    logger: ProviderCreateViewOptions["logger"]
  ): Promise<void> {
    const devtools = view.webContents.debugger;

    try {
      if (!devtools.isAttached()) {
        devtools.attach("1.3");
      }

      await devtools.sendCommand("Emulation.setUserAgentOverride", {
        userAgent: X_MOBILE_USER_AGENT,
        acceptLanguage: "en-US,en;q=0.9",
        platform: "Android",
        userAgentMetadata: X_MOBILE_USER_AGENT_METADATA
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

  private normalizeUrl(input: string, mode: ProviderMode): string {
    const candidate = input.startsWith("http") ? input : `https://${input}`;
    const parsed = new URL(candidate);

    if (!["x.com", "twitter.com", "www.x.com", "www.twitter.com"].includes(parsed.hostname)) {
      return this.buildHomeUrl(mode);
    }

    const pathname = !parsed.pathname || parsed.pathname === "/" ? "/home" : parsed.pathname;
    return `https://x.com${pathname}${parsed.search}${parsed.hash}`;
  }
}
