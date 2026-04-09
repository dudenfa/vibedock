import { BrowserView, session, shell, type Rectangle, type Session } from "electron";
import type { ProviderDefinition, ProviderMode, ProviderResolvedTarget } from "../../shared/providers";
import type { AppSettings } from "../../shared/settings";
import { Logger } from "../logger";
import { applySessionSecurity } from "../security";

export interface ProviderCreateViewOptions {
  mode: ProviderMode;
  target: ProviderResolvedTarget;
  settings: AppSettings;
  initialBounds: Rectangle;
  logger: Logger;
}

export interface ProviderViewInstance {
  view: BrowserView;
  title: string;
  destroy: () => void;
  setBounds?: (bounds: Rectangle) => void;
}

export interface ProviderAdapter {
  definition: ProviderDefinition;
  buildHomeUrl(mode: ProviderMode): string;
  normalizeInput(input: string, mode: ProviderMode): ProviderResolvedTarget;
  createSessionPartition(mode: ProviderMode, settings: AppSettings): string;
  createView(options: ProviderCreateViewOptions): Promise<ProviderViewInstance>;
  isInternalNavigation(url: string, mode: ProviderMode): boolean;
  handleExternalNavigation(url: string): Promise<void>;
}

export abstract class BaseProvider implements ProviderAdapter {
  abstract definition: ProviderDefinition;

  abstract buildHomeUrl(mode: ProviderMode): string;

  abstract normalizeInput(input: string, mode: ProviderMode): ProviderResolvedTarget;

  abstract createSessionPartition(mode: ProviderMode, settings: AppSettings): string;

  abstract createView(options: ProviderCreateViewOptions): Promise<ProviderViewInstance>;

  abstract isInternalNavigation(url: string, mode: ProviderMode): boolean;

  async handleExternalNavigation(url: string): Promise<void> {
    await shell.openExternal(url);
  }

  protected createIsolatedView(partition: string, logger: Logger, scope: string): {
    view: BrowserView;
    electronSession: Session;
  } {
    logger.info("Resolving provider session", { partition, scope });
    const electronSession = session.fromPartition(partition, { cache: true });
    logger.info("Resolved provider session", { partition, scope });
    applySessionSecurity(electronSession, logger, scope);
    logger.info("Applied provider session security", { partition, scope });
    const view = new BrowserView({
      webPreferences: {
        partition,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true
      }
    });
    logger.info("Created provider browser view", { partition, scope });

    return { view, electronSession };
  }
}
