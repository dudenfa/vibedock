import path from "node:path";
import { BrowserWindow, screen } from "electron";
import type { AppSettings } from "../shared/settings";
import {
  DEFAULT_WINDOW_SIZE_PRESET,
  WINDOW_SIZE_PRESETS,
  type WindowSizePreset
} from "../shared/window-size";
import { Logger } from "./logger";
import { SettingsService } from "./settings";
import { resolveWindowBounds } from "./window-bounds";

export class WindowManager {
  private window?: BrowserWindow;
  private settingsWindow?: BrowserWindow;
  private boundsSaveTimer?: NodeJS.Timeout;
  private screenshotModeTimer?: NodeJS.Timeout;
  private screenshotModeActive = false;
  private screenshotModeWasVisible = false;
  private screenshotSettingsWindowWasVisible = false;

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
      resizable: false,
      maximizable: false,
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

    window.on("focus", () => {
      this.restoreAfterScreenshotMode();
    });

    window.on("closed", () => {
      clearTimeout(this.boundsSaveTimer);
      clearTimeout(this.screenshotModeTimer);
      if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
        this.settingsWindow.close();
      }
      this.settingsWindow = undefined;
      this.window = undefined;
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
    if (this.screenshotModeActive) {
      this.restoreAfterScreenshotMode();
      window.focus();
      return;
    }

    if (window.isVisible()) {
      window.hide();
      return;
    }

    window.show();
    window.focus();
  }

  beginScreenshotMode(durationMs = 8000): void {
    const window = this.window;
    if (!window) {
      return;
    }

    clearTimeout(this.screenshotModeTimer);
    this.screenshotModeWasVisible = window.isVisible();
    this.screenshotSettingsWindowWasVisible = Boolean(
      this.settingsWindow && !this.settingsWindow.isDestroyed() && this.settingsWindow.isVisible()
    );
    this.screenshotModeActive = true;

    this.logger.info("Entering screenshot mode", {
      durationMs
    });
    window.setAlwaysOnTop(false);
    window.hide();
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.hide();
    }

    this.screenshotModeTimer = setTimeout(() => {
      this.restoreAfterScreenshotMode();
    }, durationMs);
  }

  openSettingsPanel(): BrowserWindow {
    const parentWindow = this.getWindow();
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.show();
      this.settingsWindow.focus();
      return this.settingsWindow;
    }

    const settingsWindow = new BrowserWindow({
      width: 420,
      height: 660,
      minWidth: 360,
      minHeight: 520,
      resizable: false,
      maximizable: false,
      minimizable: false,
      frame: false,
      transparent: false,
      show: false,
      title: "VibeDock Settings",
      backgroundColor: "#050a16",
      parent: parentWindow,
      alwaysOnTop: true,
      webPreferences: {
        preload: this.getPreloadPath(),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    settingsWindow.setAlwaysOnTop(true, "floating");
    settingsWindow.on("ready-to-show", () => {
      settingsWindow.show();
      settingsWindow.focus();
    });
    settingsWindow.on("closed", () => {
      this.settingsWindow = undefined;
    });

    this.settingsWindow = settingsWindow;
    return settingsWindow;
  }

  applyWindowSizePreset(preset: WindowSizePreset): void {
    const window = this.window;
    if (!window) {
      return;
    }

    const targetPreset = WINDOW_SIZE_PRESETS[preset] ?? WINDOW_SIZE_PRESETS[DEFAULT_WINDOW_SIZE_PRESET];
    window.setSize(targetPreset.width, targetPreset.height, true);
  }

  private getInitialBounds(settings: AppSettings): AppSettings["windowBounds"] {
    const sizePreset = WINDOW_SIZE_PRESETS[settings.windowSizePreset] ?? WINDOW_SIZE_PRESETS[DEFAULT_WINDOW_SIZE_PRESET];
    const primaryWorkArea = screen.getPrimaryDisplay().workArea;
    const workAreas = screen.getAllDisplays().map((display) => display.workArea);
    const { bounds, recoveredFromOffscreen } = resolveWindowBounds({
      savedBounds: {
        ...settings.windowBounds,
        width: sizePreset.width,
        height: sizePreset.height
      },
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

  private restoreAfterScreenshotMode(): void {
    if (!this.screenshotModeActive || !this.window) {
      return;
    }

    clearTimeout(this.screenshotModeTimer);
    if (this.screenshotModeWasVisible && !this.window.isVisible()) {
      this.window.showInactive();
    }
    if (
      this.screenshotSettingsWindowWasVisible &&
      this.settingsWindow &&
      !this.settingsWindow.isDestroyed() &&
      !this.settingsWindow.isVisible()
    ) {
      this.settingsWindow.showInactive();
    }

    if (this.settings.get().alwaysOnTop) {
      this.window.setAlwaysOnTop(true, "floating");
    }
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.setAlwaysOnTop(true, "floating");
    }

    this.screenshotModeActive = false;
    this.screenshotModeWasVisible = false;
    this.screenshotSettingsWindowWasVisible = false;
    this.logger.info("Restored dock after screenshot mode");
  }
}
