import { BrowserWindow, type Rectangle } from "electron";
import type { DockState, ViewBounds } from "../shared/ipc";
import type { ProviderNavigationRequest } from "../shared/ipc";
import type { ProviderResolvedTarget, ProviderStatus } from "../shared/providers";
import { Logger } from "./logger";
import { ProviderRegistry } from "./provider-registry";
import { SettingsService } from "./settings";
import type { ProviderViewInstance } from "./providers/base";

type StateListener = (state: DockState) => void;

export class ProviderViewManager {
  private contentBounds: ViewBounds = { x: 16, y: 92, width: 388, height: 556 };
  private activeView?: ProviderViewInstance;
  private status: ProviderStatus = "idle";
  private statusMessage = "Ready";
  private activeTarget: ProviderResolvedTarget;
  private initialized = false;
  private initializationPromise?: Promise<void>;
  private readonly listeners = new Set<StateListener>();

  constructor(
    private readonly window: BrowserWindow,
    private readonly registry: ProviderRegistry,
    private readonly settings: SettingsService,
    private readonly logger: Logger
  ) {
    const appSettings = this.settings.get();
    const provider = this.registry.get(appSettings.providerId);
    const initialInput = appSettings.restoreLastSession
      ? appSettings.currentInput
      : provider.buildHomeUrl(appSettings.mode);
    this.activeTarget = provider.normalizeInput(initialInput, appSettings.mode);
  }

  async initialize(): Promise<void> {
    this.logger.info("Initializing provider view", {
      input: this.activeTarget.input,
      resolvedUrl: this.activeTarget.resolvedUrl
    });
    await this.navigate({
      mode: this.activeTarget.mode,
      input: this.activeTarget.input
    });
    this.initialized = true;
  }

  ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return Promise.resolve();
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.initialize().finally(() => {
      this.initializationPromise = undefined;
    });

    return this.initializationPromise;
  }

  async navigate(request: ProviderNavigationRequest): Promise<DockState> {
    const appSettings = this.settings.get();
    const provider = this.registry.get(appSettings.providerId);
    const normalizedRequest = {
      ...request,
      mode: "browser" as const
    };
    const target = provider.normalizeInput(normalizedRequest.input, normalizedRequest.mode);
    this.setStatus("loading", "Opening X timeline");
    this.logger.info("Navigating provider", {
      input: request.input,
      resolvedUrl: target.resolvedUrl,
      mode: normalizedRequest.mode
    });

    try {
      this.destroyActiveView();

      const nextView = await provider.createView({
        mode: normalizedRequest.mode,
        target,
        settings: appSettings,
        initialBounds: this.contentBounds as Rectangle,
        logger: this.logger
      });

      this.activeView = nextView;
      this.activeTarget = target;
      this.window.setBrowserView(nextView.view);
      this.applyBounds();

      const nextSettings = this.settings.update({
        mode: normalizedRequest.mode,
        currentInput: target.input
      });

      this.initialized = true;
      this.setStatus("ready", target.title);
      const state = this.buildState(nextSettings);
      this.emit(state);
      return state;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load provider";
      this.logger.error("Failed to navigate provider", { message });
      this.setStatus("error", message);
      return this.buildState(this.settings.get());
    }
  }

  async updateSettings(patch: Partial<DockState["settings"]>): Promise<DockState> {
    const previous = this.settings.get();
    const next = this.settings.update(patch);
    this.window.setAlwaysOnTop(next.alwaysOnTop, "floating");
    this.window.setOpacity(next.opacity);

    if (
      patch.xMobileEmulation !== undefined &&
      patch.xMobileEmulation !== previous.xMobileEmulation
    ) {
      return this.navigate({
        mode: next.mode,
        input: this.activeTarget.input
      });
    }

    const state = this.buildState(next);
    this.emit(state);
    return state;
  }

  setContentBounds(bounds: ViewBounds): void {
    this.contentBounds = bounds;
    this.applyBounds();
  }

  onStateChange(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): DockState {
    return this.buildState(this.settings.get());
  }

  private applyBounds(): void {
    if (!this.activeView) {
      return;
    }

    const bounds = this.contentBounds as Rectangle;
    if (this.activeView.setBounds) {
      this.activeView.setBounds(bounds);
      return;
    }

    this.activeView.view.setBounds(bounds);
  }

  private destroyActiveView(): void {
    if (!this.activeView) {
      return;
    }

    if (this.window.getBrowserView() === this.activeView.view) {
      this.window.setBrowserView(null);
    }
    this.activeView.destroy();
    this.activeView = undefined;
  }

  private setStatus(status: ProviderStatus, message: string): void {
    this.status = status;
    this.statusMessage = message;
    this.emit(this.buildState(this.settings.get()));
  }

  private buildState(settings = this.settings.get()): DockState {
    return {
      settings,
      providers: this.registry.list(),
      activeTarget: this.activeTarget,
      status: this.status,
      statusMessage: this.statusMessage
    };
  }

  private emit(state: DockState): void {
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}
