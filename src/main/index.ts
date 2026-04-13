import path from "node:path";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import {
  IPC_CHANNELS,
  type DockState,
  type ProviderActivationRequest,
  type ProviderNavigationRequest,
  type ProviderSurfaceRequest,
  type ViewBounds
} from "../shared/ipc";
import { Logger } from "./logger";
import { ProviderRegistry } from "./provider-registry";
import { ProviderViewManager } from "./provider-view-manager";
import { SettingsService } from "./settings";
import { ShortcutService } from "./shortcuts";
import { WindowManager } from "./window-manager";
import { cleanupChromiumCaches } from "./cache-maintenance";

const logger = new Logger();
const APP_NAME = "VibeDock";
const DISABLED_CHROMIUM_FEATURES = [
  "CompressionDictionaryTransport",
  "CompressionDictionaryTransportBackend"
];

let providerViewManager: ProviderViewManager;
let windowManager: WindowManager;
let settingsService: SettingsService;
let shortcutService: ShortcutService;

app.commandLine.appendSwitch("disable-features", DISABLED_CHROMIUM_FEATURES.join(","));
app.commandLine.appendSwitch("disable-http-cache");

async function createApplication(): Promise<void> {
  if (process.env.NODE_ENV === "test") {
    app.setPath("userData", path.join(app.getPath("temp"), "vibedock-e2e"));
  } else {
    app.setName(APP_NAME);
    app.setPath("userData", path.join(app.getPath("appData"), APP_NAME));
  }

  logger.initialize();
  cleanupChromiumCaches(app.getPath("userData"), logger);
  logger.info("Starting VibeDock");
  settingsService = new SettingsService(logger);
  windowManager = new WindowManager(settingsService, logger);
  const window = windowManager.create();

  const registry = new ProviderRegistry();
  providerViewManager = new ProviderViewManager(
    window,
    registry,
    settingsService,
    logger
  );

  shortcutService = new ShortcutService(logger, () => {
    windowManager.toggleVisibility();
  }, () => {
    windowManager.beginScreenshotMode();
  });
  shortcutService.register(settingsService.get().shortcut);

  providerViewManager.onStateChange((state) => {
    for (const browserWindow of BrowserWindow.getAllWindows()) {
      if (!browserWindow.isDestroyed()) {
        browserWindow.webContents.send(IPC_CHANNELS.stateChanged, state);
      }
    }
  });

  wireIpc(window);
  await loadRenderer(window, "dock");

  if (process.platform === "darwin" && app.isPackaged && settingsService.get().launchAtLogin) {
    app.setLoginItemSettings({
      openAtLogin: true
    });
  }

  if (process.env.NODE_ENV !== "test") {
    setTimeout(() => {
      void providerViewManager.ensureInitialized().catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown initialization failure";
        logger.error("Failed to initialize provider view", { message });
      });
    }, 1200);
  }
}

async function loadRenderer(window: BrowserWindow, panel: "dock" | "settings"): Promise<void> {
  if (process.env.VITE_DEV_SERVER_URL) {
    await window.loadURL(`${process.env.VITE_DEV_SERVER_URL}?panel=${panel}`);
    return;
  }

  await window.loadFile(path.resolve(__dirname, "../../dist/index.html"), {
    query: {
      panel
    }
  });
}

function wireIpc(window: BrowserWindow): void {
  ipcMain.handle(IPC_CHANNELS.getState, async (): Promise<DockState> => {
    return providerViewManager.getState();
  });

  ipcMain.handle(IPC_CHANNELS.activateProvider, async (_event, request: ProviderActivationRequest) => {
    return providerViewManager.activateProvider(request);
  });

  ipcMain.handle(IPC_CHANNELS.navigate, async (_event, request: ProviderNavigationRequest) => {
    return providerViewManager.navigate(request);
  });

  ipcMain.handle(IPC_CHANNELS.setProviderSurface, async (_event, request: ProviderSurfaceRequest) => {
    return providerViewManager.setProviderSurface(request);
  });

  ipcMain.handle(IPC_CHANNELS.reloadActiveProvider, async () => {
    return providerViewManager.reloadActiveProvider();
  });

  ipcMain.handle(IPC_CHANNELS.updateSettings, async (_event, patch) => {
    const state = await providerViewManager.updateSettings(patch);
    shortcutService.register(state.settings.shortcut);

    if (patch.windowSizePreset) {
      windowManager.applyWindowSizePreset(state.settings.windowSizePreset);
    }

    if (
      process.platform === "darwin" &&
      app.isPackaged &&
      patch.launchAtLogin !== undefined
    ) {
      app.setLoginItemSettings({
        openAtLogin: state.settings.launchAtLogin
      });
    }

    return state;
  });

  ipcMain.handle(IPC_CHANNELS.setContentBounds, async (_event, bounds: ViewBounds) => {
    providerViewManager.setContentBounds(bounds);
    if (process.env.NODE_ENV !== "test") {
      void providerViewManager.ensureInitialized().catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown initialization failure";
        logger.error("Failed to initialize provider view after bounds update", { message });
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.openExternal, async (_event, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle(IPC_CHANNELS.beginScreenshotMode, async () => {
    windowManager.beginScreenshotMode();
  });

  ipcMain.handle(IPC_CHANNELS.openSettingsPanel, async () => {
    const settingsWindow = windowManager.openSettingsPanel();
    if (!settingsWindow.webContents.getURL()) {
      await loadRenderer(settingsWindow, "settings");
    }
  });

  window.on("closed", () => {
    ipcMain.removeHandler(IPC_CHANNELS.getState);
    ipcMain.removeHandler(IPC_CHANNELS.activateProvider);
    ipcMain.removeHandler(IPC_CHANNELS.navigate);
    ipcMain.removeHandler(IPC_CHANNELS.setProviderSurface);
    ipcMain.removeHandler(IPC_CHANNELS.reloadActiveProvider);
    ipcMain.removeHandler(IPC_CHANNELS.updateSettings);
    ipcMain.removeHandler(IPC_CHANNELS.setContentBounds);
    ipcMain.removeHandler(IPC_CHANNELS.openExternal);
    ipcMain.removeHandler(IPC_CHANNELS.beginScreenshotMode);
    ipcMain.removeHandler(IPC_CHANNELS.openSettingsPanel);
  });
}

app.whenReady().then(() => {
  void createApplication();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createApplication();
  } else {
    windowManager.toggleVisibility();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  shortcutService?.dispose();
});
