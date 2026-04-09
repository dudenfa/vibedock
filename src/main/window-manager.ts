import path from "node:path";
import { BrowserWindow, screen } from "electron";
import type { AppSettings } from "../shared/settings";
import { Logger } from "./logger";
import { SettingsService } from "./settings";
import { resolveWindowBounds } from "./window-bounds";

export class WindowManager {
  private window?: BrowserWindow;
  private boundsSaveTimer?: NodeJS.Timeout;

  constructor(
    private readonly settings: SettingsService,
    private readonly logger: Logger
  ) {}

  create(): BrowserWindow {
    const appSettings = this.settings.get();
    const bounds = this.getInitialBounds(appSettings);

    const window = new BrowserWindow({
      ...bounds,
      minWidth: 360,
      minHeight: 420,
      frame: false,
      transparent: false,
      show: !appSettings.startHidden,
      backgroundColor: "#040915",
      alwaysOnTop: appSettings.alwaysOnTop,
      title: "VibeDock",
      trafficLightPosition: {
        x: 18,
        y: 18
      },
      webPreferences: {
        preload: this.getPreloadPath(),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    window.setAlwaysOnTop(appSettings.alwaysOnTop, "floating");
    window.setOpacity(appSettings.opacity);

    window.on("resize", () => {
      this.scheduleBoundsSave(window);
    });

    window.on("move", () => {
      this.scheduleBoundsSave(window);
    });

    window.on("ready-to-show", () => {
      if (!appSettings.startHidden) {
        window.show();
      }
    });

    this.window = window;
    return window;
  }

  getWindow(): BrowserWindow {
    if (!this.window) {
      throw new Error("Window has not been created yet");
    }

    return this.window;
  }

  toggleVisibility(): void {
    const window = this.getWindow();
    if (window.isVisible()) {
      window.hide();
      return;
    }

    window.show();
    window.focus();
  }

  private getInitialBounds(settings: AppSettings): AppSettings["windowBounds"] {
    const primaryWorkArea = screen.getPrimaryDisplay().workArea;
    const workAreas = screen.getAllDisplays().map((display) => display.workArea);
    const { bounds, recoveredFromOffscreen } = resolveWindowBounds({
      savedBounds: settings.windowBounds,
      primaryWorkArea,
      workAreas,
      minWidth: 360,
      minHeight: 420,
      edgePadding: 48
    });

    if (recoveredFromOffscreen) {
      this.logger.warn("Recovered saved window bounds onto a visible display", {
        savedBounds: settings.windowBounds,
        nextBounds: bounds
      });
    }

    return bounds;
  }

  private getPreloadPath(): string {
    return process.env.VITE_DEV_SERVER_URL
      ? path.join(process.cwd(), "dist-electron/preload/index.js")
      : path.join(__dirname, "../preload/index.js");
  }

  private scheduleBoundsSave(window: BrowserWindow): void {
    clearTimeout(this.boundsSaveTimer);
    this.boundsSaveTimer = setTimeout(() => {
      const [x, y] = window.getPosition();
      const [width, height] = window.getSize();
      this.settings.saveWindowBounds({ x, y, width, height });
      this.logger.info("Saved window bounds", { x, y, width, height });
    }, 180);
  }
}
