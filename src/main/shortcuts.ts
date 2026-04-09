import { globalShortcut } from "electron";
import { Logger } from "./logger";

export class ShortcutService {
  constructor(
    private readonly logger: Logger,
    private readonly toggleWindowVisibility: () => void
  ) {}

  register(shortcut: string): void {
    globalShortcut.unregisterAll();
    const success = globalShortcut.register(shortcut, () => {
      this.toggleWindowVisibility();
    });

    if (!success) {
      this.logger.warn("Failed to register shortcut", { shortcut });
      return;
    }

    this.logger.info("Registered shortcut", { shortcut });
  }

  dispose(): void {
    globalShortcut.unregisterAll();
  }
}
