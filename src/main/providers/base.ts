import { BrowserView, session, type Rectangle } from "electron";
import type { ProviderDefinition, ProviderResolvedTarget, ProviderSurface } from "../../shared/providers";
import type { AppSettings } from "../../shared/settings";
import { Logger } from "../logger";
import { applySessionSecurity } from "../security";

export interface ProviderCreateViewOptions {
  target: ProviderResolvedTarget;
  settings: AppSettings;
  initialBounds: Rectangle;
  logger: Logger;
}

export interface ProviderViewInstance {
  view: BrowserView;
  surface: ProviderSurface;
  destroy: () => void;
  setBounds?: (bounds: Rectangle) => void;
}

export interface ProviderAdapter {
  definition: ProviderDefinition;
  buildHomeUrl(): string;
  normalizeInput(input: string): ProviderResolvedTarget;
  createSessionPartition(settings: AppSettings): string;
  createView(options: ProviderCreateViewOptions): Promise<ProviderViewInstance>;
}

export abstract class BaseProvider implements ProviderAdapter {
  abstract definition: ProviderDefinition;

  abstract buildHomeUrl(): string;

  abstract normalizeInput(input: string): ProviderResolvedTarget;

  abstract createSessionPartition(settings: AppSettings): string;

  abstract createView(options: ProviderCreateViewOptions): Promise<ProviderViewInstance>;

  protected createIsolatedView(partition: string, logger: Logger, scope: string): BrowserView {
    logger.info("Resolving provider session", { partition, scope });
    const electronSession = session.fromPartition(partition, { cache: false });
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

    return view;
  }
}
