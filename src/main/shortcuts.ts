import { globalShortcut } from "electron";
import { Logger } from "./logger";

const SCREENSHOT_MODE_SHORTCUT = "CommandOrControl+Shift+S";

export class ShortcutService {
  constructor(
    private readonly logger: Logger,
    private readonly toggleWindowVisibility: () => void,
    private readonly beginScreenshotMode: () => void
  ) {}

  register(shortcut: string): void {
    globalShortcut.unregisterAll();
    const windowShortcutRegistered = globalShortcut.register(shortcut, () => {
      this.toggleWindowVisibility();
    });

    if (!windowShortcutRegistered) {
      this.logger.warn("Failed to register shortcut", { shortcut });
    } else {
      this.logger.info("Registered shortcut", { shortcut });
    }

    if (shortcut === SCREENSHOT_MODE_SHORTCUT) {
      this.logger.warn("Skipping screenshot helper shortcut because it conflicts with the main shortcut", {
        shortcut
      });
      return;
    }

    const screenshotShortcutRegistered = globalShortcut.register(SCREENSHOT_MODE_SHORTCUT, () => {
      this.beginScreenshotMode();
    });

    if (!screenshotShortcutRegistered) {
      this.logger.warn("Failed to register screenshot helper shortcut", {
        shortcut: SCREENSHOT_MODE_SHORTCUT
      });
      return;
    }

    this.logger.info("Registered screenshot helper shortcut", {
      shortcut: SCREENSHOT_MODE_SHORTCUT
    });
  }

  dispose(): void {
    globalShortcut.unregisterAll();
  }
}
