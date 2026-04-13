import { BrowserWindow, type Rectangle } from "electron";
import type {
  DockState,
  ProviderActivationRequest,
  ProviderNavigationRequest,
  ProviderSurfaceRequest,
  ViewBounds
} from "../shared/ipc";
import type { ProviderId, ProviderResolvedTarget, ProviderStatus, ProviderSurface } from "../shared/providers";
import { Logger } from "./logger";
import { ProviderRegistry } from "./provider-registry";
import { SettingsService } from "./settings";
import type { ProviderViewInstance } from "./providers/base";

type StateListener = (state: DockState) => void;

interface ProviderRuntimeState {
  target: ProviderResolvedTarget;
  surface: ProviderSurface;
  status: ProviderStatus;
  statusMessage: string;
  view?: ProviderViewInstance;
}

const MIN_CONTENT_WIDTH = 240;
const MIN_CONTENT_HEIGHT = 200;

export class ProviderViewManager {
  private contentBounds: ViewBounds = { x: 16, y: 92, width: 388, height: 556 };
  private readonly providerStates = new Map<ProviderId, ProviderRuntimeState>();
  private activeProviderId: ProviderId;
  private attachedProviderId?: ProviderId;
  private initialized = false;
  private initializationPromise?: Promise<void>;
  private actionSequence = 0;
  private readonly listeners = new Set<StateListener>();
  private readonly autoPromotingProviders = new Set<ProviderId>();

  constructor(
    private readonly window: BrowserWindow,
    private readonly registry: ProviderRegistry,
    private readonly settings: SettingsService,
    private readonly logger: Logger
  ) {
    const appSettings = this.settings.get();
    this.activeProviderId = appSettings.activeProviderId;

    for (const providerDefinition of this.registry.list()) {
      const provider = this.registry.get(providerDefinition.id);
      const tabSettings = appSettings.providerTabs[providerDefinition.id];
      const initialInput = appSettings.restoreLastSession
        ? tabSettings.currentInput
        : provider.buildHomeUrl();

      this.providerStates.set(providerDefinition.id, {
        target: provider.normalizeInput(initialInput),
        surface: providerDefinition.id === "tiktok"
          ? "bootstrap"
          : tabSettings.bootstrapCompleted
            ? "mobile"
            : "bootstrap",
        status: "idle",
        statusMessage: "Ready"
      });
    }
  }

  async initialize(): Promise<void> {
    const activeState = this.getProviderState(this.activeProviderId);
    this.logger.info("Initializing provider view", {
      providerId: this.activeProviderId,
      input: activeState.target.input,
      resolvedUrl: activeState.target.resolvedUrl
    });
    await this.activateProvider({
      providerId: this.activeProviderId
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

  async activateProvider(request: ProviderActivationRequest): Promise<DockState> {
    const providerId = request.providerId;
    const providerState = this.getProviderState(providerId);

    if (providerId === this.activeProviderId && this.attachedProviderId === providerId && providerState.view) {
      return this.buildState();
    }

    const actionId = ++this.actionSequence;
    const previousProviderId = this.attachedProviderId;
    this.activeProviderId = providerId;
    this.persistProviderSelection();

    try {
      if (previousProviderId && previousProviderId !== providerId) {
        await this.pauseInactiveMedia(previousProviderId);
      }

      if (!providerState.view) {
        await this.reconcileProviderSurface(providerId);
      }

      this.detachCurrentView();

      if (!providerState.view) {
        providerState.status = "loading";
        providerState.statusMessage = `Opening ${this.registry.get(providerId).definition.label} timeline`;
        this.emit(this.buildState());
        await this.createOrReplaceView(providerId, actionId);
      } else {
        this.attachProviderView(providerId);
        this.setReadyStatus(providerId);
        this.emit(this.buildState());
      }

      return this.buildState();
    } catch (error) {
      if (actionId !== this.actionSequence) {
        return this.buildState();
      }

      const message = error instanceof Error ? error.message : "Unable to load provider";
      providerState.status = "error";
      providerState.statusMessage = message;
      this.logger.error("Failed to activate provider", {
        providerId,
        message
      });
      this.emit(this.buildState());
      return this.buildState();
    }
  }

  async navigate(request: ProviderNavigationRequest): Promise<DockState> {
    const actionId = ++this.actionSequence;
    const providerId = request.providerId;
    const appSettings = this.settings.get();
    const provider = this.registry.get(providerId);
    const providerState = this.getProviderState(providerId);
    const target = provider.normalizeInput(request.input);

    providerState.target = target;
    providerState.status = "loading";
    providerState.statusMessage = `Opening ${provider.definition.label} timeline`;
    this.activeProviderId = providerId;
    this.persistProviderSelection();
    this.logger.info("Navigating provider", {
      providerId,
      input: request.input,
      resolvedUrl: target.resolvedUrl
    });
    this.emit(this.buildState());

    try {
      if (!providerState.view) {
        await this.reconcileProviderSurface(providerId);
      }

      if (this.attachedProviderId && this.attachedProviderId !== providerId) {
        await this.pauseInactiveMedia(this.attachedProviderId);
      }

      this.detachCurrentView();
      await this.createOrReplaceView(providerId, actionId, appSettings);
      this.persistProviderSelection();
      return this.buildState();
    } catch (error) {
      if (actionId !== this.actionSequence) {
        return this.buildState();
      }

      const message = error instanceof Error ? error.message : "Unable to load provider";
      providerState.status = "error";
      providerState.statusMessage = message;
      this.logger.error("Failed to navigate provider", {
        providerId,
        message
      });
      this.emit(this.buildState());
      return this.buildState();
    }
  }

  async setProviderSurface(request: ProviderSurfaceRequest): Promise<DockState> {
    const actionId = ++this.actionSequence;
    const providerId = request.providerId;
    const nextSurface = request.surface;
    const providerState = this.getProviderState(providerId);

    if (providerState.surface === nextSurface) {
      return this.buildState();
    }

    providerState.surface = nextSurface;
    this.persistProviderSelection();
    this.destroyProviderView(providerId);

    if (providerId !== this.activeProviderId) {
      this.emit(this.buildState());
      return this.buildState();
    }

    providerState.status = "loading";
    providerState.statusMessage = nextSurface === "bootstrap"
      ? this.getBootstrapSurfaceLabel(providerId, true)
      : `Opening ${this.registry.get(providerId).definition.label} timeline`;
    this.emit(this.buildState());

    try {
      await this.createOrReplaceView(providerId, actionId);
      return this.buildState();
    } catch (error) {
      if (actionId !== this.actionSequence) {
        return this.buildState();
      }

      const message = error instanceof Error ? error.message : "Unable to switch provider surface";
      providerState.status = "error";
      providerState.statusMessage = message;
      this.logger.error("Failed to set provider surface", {
        providerId,
        surface: nextSurface,
        message
      });
      this.emit(this.buildState());
      return this.buildState();
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

  private async createOrReplaceView(
    providerId: ProviderId,
    actionId: number,
    appSettings = this.settings.get()
  ): Promise<void> {
    const provider = this.registry.get(providerId);
    const providerState = this.getProviderState(providerId);
    const previousView = providerState.view;
    const nextView = await provider.createView({
      target: providerState.target,
      settings: appSettings,
      surface: providerState.surface,
      initialBounds: this.contentBounds as Rectangle,
      logger: this.logger
    });

    if (actionId !== this.actionSequence) {
      this.logger.warn("Discarding stale provider view after a newer provider action", {
        providerId
      });
      nextView.destroy();
      return;
    }

    providerState.view = nextView;
    this.attachProviderView(providerId);
    if (previousView && previousView !== nextView) {
      previousView.destroy();
    }

    this.installAutoPromoteListener(providerId, nextView);
    this.setReadyStatus(providerId);
    this.persistProviderSelection();
    this.initialized = true;
    this.emit(this.buildState());
  }

  private attachProviderView(providerId: ProviderId): void {
    const providerState = this.getProviderState(providerId);
    if (!providerState.view) {
      return;
    }

    this.window.setBrowserView(providerState.view.view);
    this.attachedProviderId = providerId;
    this.applyBounds();
  }

  private applyBounds(): void {
    if (!this.attachedProviderId) {
      return;
    }

    const providerState = this.getProviderState(this.attachedProviderId);
    if (!providerState.view) {
      return;
    }

    const bounds = this.contentBounds as Rectangle;
    if (providerState.view.setBounds) {
      providerState.view.setBounds(bounds);
      return;
    }

    providerState.view.view.setBounds(bounds);
  }

  private detachCurrentView(): void {
    if (!this.attachedProviderId) {
      return;
    }

    this.window.setBrowserView(null);
    this.attachedProviderId = undefined;
  }

  private destroyProviderView(providerId: ProviderId): void {
    const providerState = this.getProviderState(providerId);
    if (!providerState.view) {
      return;
    }

    if (this.attachedProviderId === providerId) {
      this.detachCurrentView();
    }

    providerState.view.destroy();
    providerState.view = undefined;
  }

  private setReadyStatus(providerId: ProviderId): void {
    const providerState = this.getProviderState(providerId);
    providerState.status = "ready";
    providerState.statusMessage = providerState.surface === "bootstrap"
      ? this.getBootstrapSurfaceLabel(providerId)
      : providerState.target.title;
  }

  private async reconcileProviderSurface(providerId: ProviderId): Promise<void> {
    const provider = this.registry.get(providerId);
    if (!provider.resolvePreferredSurface) {
      return;
    }

    const providerState = this.getProviderState(providerId);
    const preferredSurface = await provider.resolvePreferredSurface(this.settings.get(), this.logger);
    if (!preferredSurface || preferredSurface === providerState.surface) {
      return;
    }

    providerState.surface = preferredSurface;
    this.persistProviderSelection();
  }

  private getBootstrapSurfaceLabel(providerId: ProviderId, loading = false): string {
    if (providerId === "tiktok") {
      return loading ? "Opening TikTok desktop web" : "TikTok desktop web";
    }

    return loading ? "Opening desktop login helper" : "Desktop login helper";
  }

  private getProviderState(providerId: ProviderId): ProviderRuntimeState {
    const state = this.providerStates.get(providerId);
    if (!state) {
      throw new Error(`Missing provider state for ${providerId}`);
    }

    return state;
  }

  private persistProviderSelection(): void {
    const providerTabs = {
      ...this.settings.get().providerTabs
    };

    for (const [providerId, providerState] of this.providerStates.entries()) {
      providerTabs[providerId] = {
        currentInput: providerState.target.input,
        bootstrapCompleted: providerState.surface === "mobile"
      };
    }

    this.settings.update({
      activeProviderId: this.activeProviderId,
      providerTabs
    });
  }

  private buildState(settings = this.settings.get()): DockState {
    const activeState = this.getProviderState(this.activeProviderId);
    return {
      settings,
      providers: this.registry.list(),
      activeProviderId: this.activeProviderId,
      activeTarget: activeState.target,
      activeSurface: activeState.surface,
      status: activeState.status,
      statusMessage: activeState.statusMessage
    };
  }

  private emit(state: DockState): void {
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  private async pauseInactiveMedia(providerId: ProviderId): Promise<void> {
    const providerState = this.getProviderState(providerId);
    const webContents = providerState.view?.view.webContents;
    if (!webContents || webContents.isDestroyed()) {
      return;
    }

    try {
      await webContents.executeJavaScript(
        `Array.from(document.querySelectorAll("video,audio")).forEach((media) => {
          try {
            if (typeof media.pause === "function") media.pause();
          } catch {}
          try {
            media.muted = true;
          } catch {}
        });`,
        true
      );
    } catch (error) {
      this.logger.warn("Unable to pause inactive provider media", {
        providerId,
        message: error instanceof Error ? error.message : "unknown"
      });
    }
  }

  private installAutoPromoteListener(providerId: ProviderId, viewInstance: ProviderViewInstance): void {
    if (viewInstance.surface !== "bootstrap") {
      return;
    }

    const provider = this.registry.get(providerId);
    if (!provider.shouldAutoPromoteBootstrap) {
      return;
    }

    const maybePromote = (url: string) => {
      if (this.autoPromotingProviders.has(providerId)) {
        return;
      }

      const providerState = this.getProviderState(providerId);
      if (providerState.surface !== "bootstrap") {
        return;
      }

      if (!provider.shouldAutoPromoteBootstrap?.(url)) {
        return;
      }

      this.autoPromotingProviders.add(providerId);
      this.logger.info("Auto-promoting provider from bootstrap to mobile web", {
        providerId,
        url
      });
      void this.setProviderSurface({
        providerId,
        surface: "mobile"
      }).finally(() => {
        this.autoPromotingProviders.delete(providerId);
      });
    };

    viewInstance.view.webContents.on("did-navigate", (_event, url) => {
      maybePromote(url);
    });
    viewInstance.view.webContents.on("did-navigate-in-page", (_event, url) => {
      maybePromote(url);
    });
  }
}
