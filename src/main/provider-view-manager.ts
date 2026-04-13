import { BrowserWindow, type Rectangle } from "electron";
import type { DockState, ProviderNavigationRequest, ViewBounds } from "../shared/ipc";
import type { ProviderResolvedTarget, ProviderStatus, ProviderSurface } from "../shared/providers";
import { Logger } from "./logger";
import { ProviderRegistry } from "./provider-registry";
import { SettingsService } from "./settings";
import type { ProviderViewInstance } from "./providers/base";

type StateListener = (state: DockState) => void;

const MIN_CONTENT_WIDTH = 240;
const MIN_CONTENT_HEIGHT = 200;

export class ProviderViewManager {
  private contentBounds: ViewBounds = { x: 16, y: 92, width: 388, height: 556 };
  private activeView?: ProviderViewInstance;
  private activeSurface: ProviderSurface = "mobile";
  private status: ProviderStatus = "idle";
  private statusMessage = "Ready";
  private activeTarget: ProviderResolvedTarget;
  private initialized = false;
  private initializationPromise?: Promise<void>;
  private navigationSequence = 0;
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
      : provider.buildHomeUrl();
    this.activeTarget = provider.normalizeInput(initialInput);
    this.activeSurface = appSettings.xBootstrapCompleted ? "mobile" : "bootstrap";
  }

  async initialize(): Promise<void> {
    this.logger.info("Initializing provider view", {
      input: this.activeTarget.input,
      resolvedUrl: this.activeTarget.resolvedUrl
    });
    await this.navigate({
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
    const navigationId = ++this.navigationSequence;
    const appSettings = this.settings.get();
    const provider = this.registry.get(appSettings.providerId);
    const target = provider.normalizeInput(request.input);
    this.setStatus("loading", "Opening X timeline");
    this.logger.info("Navigating provider", {
      input: request.input,
      resolvedUrl: target.resolvedUrl
    });

    try {
      const previousView = this.activeView;

      const nextView = await provider.createView({
        target,
        settings: appSettings,
        initialBounds: this.contentBounds as Rectangle,
        logger: this.logger
      });

      if (navigationId !== this.navigationSequence) {
        this.logger.warn("Discarding stale provider view after a newer navigation request");
        nextView.destroy();
        return this.buildState(this.settings.get());
      }

      this.activeView = nextView;
      this.activeSurface = nextView.surface;
      this.activeTarget = target;
      this.window.setBrowserView(nextView.view);
      this.applyBounds();
      this.destroyView(previousView);

      const nextSettings = this.settings.update({
        currentInput: target.input
      });

      this.initialized = true;
      if (nextView.surface === "bootstrap") {
        this.setStatus("ready", "Desktop login helper");
      } else {
        this.setStatus("ready", target.title);
      }
      const state = this.buildState(nextSettings);
      this.emit(state);
      return state;
    } catch (error) {
      if (navigationId !== this.navigationSequence) {
        return this.buildState(this.settings.get());
      }

      const message = error instanceof Error ? error.message : "Unable to load provider";
      this.logger.error("Failed to navigate provider", { message });
      this.setStatus("error", message);
      return this.buildState(this.settings.get());
    }
  }

  async updateSettings(patch: Partial<DockState["settings"]>): Promise<DockState> {
    const next = this.settings.update(patch);
    this.window.setAlwaysOnTop(next.alwaysOnTop, "floating");
    this.window.setOpacity(next.opacity);

    const state = this.buildState(next);
    this.emit(state);
    return state;
  }

  setContentBounds(bounds: ViewBounds): void {
    if (bounds.width < MIN_CONTENT_WIDTH || bounds.height < MIN_CONTENT_HEIGHT) {
      this.logger.warn("Ignoring tiny content bounds update", {
        bounds
      });
      return;
    }

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

  private destroyView(view?: ProviderViewInstance): void {
    if (!view) {
      return;
    }

    if (this.window.getBrowserView() === view.view) {
      this.window.setBrowserView(null);
    }

    view.destroy();
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
      activeSurface: this.activeSurface,
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
