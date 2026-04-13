import { create } from "zustand";
import type { ProviderId, ProviderStatus, ProviderSurface } from "../shared/providers";
import type { WindowSizePreset } from "../shared/window-size";

export interface RendererProviderDefinition {
  id: ProviderId;
  label: string;
  description: string;
}

export interface RendererProviderTab {
  currentInput: string;
  surface: ProviderSurface;
  bootstrapCompleted: boolean;
}

export interface RendererSettings {
  version: number;
  windowBounds: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
  alwaysOnTop: boolean;
  opacity: number;
  windowSizePreset: WindowSizePreset;
  shortcut: string;
  restoreLastSession: boolean;
  startHidden: boolean;
  launchAtLogin: boolean;
  activeProviderId: ProviderId;
  providerTabs: Record<ProviderId, RendererProviderTab>;
}

export interface RendererResolvedTarget {
  providerId: ProviderId;
  input: string;
  resolvedUrl: string;
  title: string;
}

export interface RendererDockState {
  settings: RendererSettings;
  providers: RendererProviderDefinition[];
  activeProviderId: ProviderId;
  activeTarget: RendererResolvedTarget;
  activeSurface: ProviderSurface;
  status: ProviderStatus;
  statusMessage: string;
}

interface ViewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DockApiCompat {
  getState: () => Promise<unknown>;
  navigate: (request: { providerId: ProviderId; input: string }) => Promise<unknown>;
  reloadActiveProvider?: () => Promise<unknown>;
  updateSettings: (patch: Record<string, unknown>) => Promise<unknown>;
  setContentBounds: (bounds: ViewBounds) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  beginScreenshotMode: () => Promise<void>;
  openSettingsPanel: () => Promise<void>;
  onStateChange: (listener: (state: unknown) => void) => () => void;
  activateProvider?: (request: { providerId: ProviderId }) => Promise<unknown>;
  setProviderSurface?: (request: { providerId: ProviderId; surface: ProviderSurface }) => Promise<unknown>;
}

const dock = window.dock as unknown as DockApiCompat;

const PROVIDERS: RendererProviderDefinition[] = [
  {
    id: "x",
    label: "X",
    description: "Scroll the X timeline in a docked mobile web session."
  },
  {
    id: "tiktok",
    label: "TikTok",
    description: "Browse TikTok in a mobile web feed with session persistence."
  },
  {
    id: "instagram",
    label: "Instagram",
    description: "Browse Instagram in a desktop-first web shell with a persistent session."
  }
];

const DEFAULT_PROVIDER_TABS: Record<ProviderId, RendererProviderTab> = {
  x: {
    currentInput: "https://x.com/home",
    surface: "bootstrap",
    bootstrapCompleted: false
  },
  tiktok: {
    currentInput: "https://www.tiktok.com/foryou",
    surface: "bootstrap",
    bootstrapCompleted: false
  },
  instagram: {
    currentInput: "https://www.instagram.com/",
    surface: "mobile",
    bootstrapCompleted: true
  }
};

const DEFAULT_SETTINGS: RendererSettings = {
  version: 2,
  windowBounds: {
    width: 420,
    height: 680
  },
  alwaysOnTop: true,
  opacity: 0.98,
  windowSizePreset: "medium",
  shortcut: "CommandOrControl+Shift+Space",
  restoreLastSession: true,
  startHidden: false,
  launchAtLogin: false,
  activeProviderId: "x",
  providerTabs: DEFAULT_PROVIDER_TABS
};

const fallbackState: RendererDockState = {
  settings: DEFAULT_SETTINGS,
  providers: PROVIDERS,
  activeProviderId: "x",
  activeTarget: {
    providerId: "x",
    input: DEFAULT_PROVIDER_TABS.x.currentInput,
    resolvedUrl: DEFAULT_PROVIDER_TABS.x.currentInput,
    title: "X Timeline"
  },
  activeSurface: "bootstrap",
  status: "idle",
  statusMessage: "Booting"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeProviderId(value: unknown): ProviderId {
  if (value === "tiktok" || value === "instagram") {
    return value;
  }

  return "x";
}

function getProviderTitle(providerId: ProviderId): string {
  if (providerId === "tiktok") {
    return "TikTok";
  }

  if (providerId === "instagram") {
    return "Instagram";
  }

  return "X Timeline";
}

function normalizeSurface(value: unknown, fallback: ProviderSurface): ProviderSurface {
  return value === "mobile" || value === "bootstrap" ? value : fallback;
}

function normalizeProviderTab(providerId: ProviderId, rawTab: unknown, legacyFallbackInput: string): RendererProviderTab {
  if (!isRecord(rawTab)) {
    return {
      ...DEFAULT_PROVIDER_TABS[providerId],
      currentInput: legacyFallbackInput || DEFAULT_PROVIDER_TABS[providerId].currentInput
    };
  }

  const currentInput = typeof rawTab.currentInput === "string" && rawTab.currentInput.trim().length > 0
    ? rawTab.currentInput
    : legacyFallbackInput || DEFAULT_PROVIDER_TABS[providerId].currentInput;
  const surface = normalizeSurface(rawTab.surface, providerId === "x" ? "bootstrap" : "bootstrap");
  const bootstrapCompleted = typeof rawTab.bootstrapCompleted === "boolean"
    ? rawTab.bootstrapCompleted
    : surface === "mobile";

  return {
    currentInput,
    surface,
    bootstrapCompleted
  };
}

function normalizeProviderTabs(rawSettings: unknown, legacyInput: string, legacySurface: ProviderSurface): Record<ProviderId, RendererProviderTab> {
  const rawTabs = isRecord(rawSettings) && isRecord(rawSettings.providerTabs) ? rawSettings.providerTabs : undefined;

  const xTab = normalizeProviderTab("x", rawTabs?.x, legacyInput || DEFAULT_PROVIDER_TABS.x.currentInput);
  const tiktokTab = normalizeProviderTab("tiktok", rawTabs?.tiktok, DEFAULT_PROVIDER_TABS.tiktok.currentInput);
  const instagramTab = normalizeProviderTab("instagram", rawTabs?.instagram, DEFAULT_PROVIDER_TABS.instagram.currentInput);

  if (!rawTabs && legacySurface === "mobile") {
    xTab.surface = "mobile";
    xTab.bootstrapCompleted = true;
  }

  return {
    x: xTab,
    tiktok: tiktokTab,
    instagram: instagramTab
  };
}

function normalizeProviders(rawProviders: unknown): RendererProviderDefinition[] {
  const byId = new Map<ProviderId, RendererProviderDefinition>(PROVIDERS.map((provider) => [provider.id, provider]));

  if (Array.isArray(rawProviders)) {
    for (const provider of rawProviders) {
      if (!isRecord(provider)) {
        continue;
      }

      const id = normalizeProviderId(provider.id);
      const label = typeof provider.label === "string" && provider.label.trim().length > 0
        ? provider.label
        : byId.get(id)?.label ?? id.toUpperCase();
      const description = typeof provider.description === "string" && provider.description.trim().length > 0
        ? provider.description
        : byId.get(id)?.description ?? "";

      byId.set(id, {
        id,
        label,
        description
      });
    }
  }

  return PROVIDERS.map((provider) => byId.get(provider.id) ?? provider);
}

function normalizeDockState(rawState: unknown): RendererDockState {
  const fallbackSettings = fallbackState.settings;
  const raw = isRecord(rawState) ? rawState : {};
  const rawSettings = isRecord(raw.settings) ? raw.settings : {};
  const rawActiveTarget = isRecord(raw.activeTarget) ? raw.activeTarget : undefined;
  const legacyProviderId = normalizeProviderId(rawSettings.providerId ?? raw.activeProviderId ?? rawActiveTarget?.providerId);
  const legacyInput = typeof rawSettings.currentInput === "string" && rawSettings.currentInput.trim().length > 0
    ? rawSettings.currentInput
    : typeof rawActiveTarget?.input === "string" && rawActiveTarget.input.trim().length > 0
      ? rawActiveTarget.input
      : DEFAULT_PROVIDER_TABS[legacyProviderId].currentInput;
  const legacySurface = normalizeSurface(
    raw.activeSurface ?? (typeof rawSettings.xBootstrapCompleted === "boolean" && rawSettings.xBootstrapCompleted ? "mobile" : undefined),
    "bootstrap"
  );
  const providerTabs = normalizeProviderTabs(rawSettings, legacyInput, legacySurface);
  const activeProviderId = normalizeProviderId(raw.activeProviderId ?? rawSettings.activeProviderId ?? legacyProviderId);
  const activeTab = providerTabs[activeProviderId] ?? DEFAULT_PROVIDER_TABS[activeProviderId];
  const activeTarget: RendererResolvedTarget = rawActiveTarget && typeof rawActiveTarget.input === "string"
    ? {
        providerId: normalizeProviderId(rawActiveTarget.providerId ?? activeProviderId),
        input: rawActiveTarget.input,
        resolvedUrl: typeof rawActiveTarget.resolvedUrl === "string" ? rawActiveTarget.resolvedUrl : rawActiveTarget.input,
        title: typeof rawActiveTarget.title === "string" ? rawActiveTarget.title : getProviderTitle(activeProviderId)
      }
    : {
        providerId: activeProviderId,
        input: activeTab.currentInput,
        resolvedUrl: activeTab.currentInput,
        title: getProviderTitle(activeProviderId)
      };

  const settings: RendererSettings = {
    version: typeof rawSettings.version === "number" ? rawSettings.version : fallbackSettings.version,
    windowBounds: isRecord(rawSettings.windowBounds)
      ? {
          width: typeof rawSettings.windowBounds.width === "number" ? rawSettings.windowBounds.width : fallbackSettings.windowBounds.width,
          height: typeof rawSettings.windowBounds.height === "number" ? rawSettings.windowBounds.height : fallbackSettings.windowBounds.height,
          x: typeof rawSettings.windowBounds.x === "number" ? rawSettings.windowBounds.x : fallbackSettings.windowBounds.x,
          y: typeof rawSettings.windowBounds.y === "number" ? rawSettings.windowBounds.y : fallbackSettings.windowBounds.y
        }
      : fallbackSettings.windowBounds,
    alwaysOnTop: typeof rawSettings.alwaysOnTop === "boolean" ? rawSettings.alwaysOnTop : fallbackSettings.alwaysOnTop,
    opacity: typeof rawSettings.opacity === "number" ? rawSettings.opacity : fallbackSettings.opacity,
    windowSizePreset:
      rawSettings.windowSizePreset === "small" || rawSettings.windowSizePreset === "medium" || rawSettings.windowSizePreset === "big"
        ? rawSettings.windowSizePreset
        : fallbackSettings.windowSizePreset,
    shortcut: typeof rawSettings.shortcut === "string" && rawSettings.shortcut.trim().length > 0
      ? rawSettings.shortcut
      : fallbackSettings.shortcut,
    restoreLastSession: typeof rawSettings.restoreLastSession === "boolean" ? rawSettings.restoreLastSession : fallbackSettings.restoreLastSession,
    startHidden: typeof rawSettings.startHidden === "boolean" ? rawSettings.startHidden : fallbackSettings.startHidden,
    launchAtLogin: typeof rawSettings.launchAtLogin === "boolean" ? rawSettings.launchAtLogin : fallbackSettings.launchAtLogin,
    activeProviderId,
    providerTabs
  };

  return {
    settings,
    providers: normalizeProviders(raw.providers),
    activeProviderId,
    activeTarget,
    activeSurface: normalizeSurface(raw.activeSurface ?? activeTab.surface, activeTab.surface),
    status: raw.status === "idle" || raw.status === "loading" || raw.status === "ready" || raw.status === "error"
      ? raw.status
      : fallbackState.status,
    statusMessage: typeof raw.statusMessage === "string" && raw.statusMessage.trim().length > 0
      ? raw.statusMessage
      : fallbackState.statusMessage
  };
}

interface AppStore extends RendererDockState {
  loading: boolean;
  boot: () => Promise<void>;
  activateProvider: (request: { providerId: ProviderId }) => Promise<void>;
  navigate: (request: { providerId: ProviderId; input: string }) => Promise<void>;
  reloadActiveProvider: () => Promise<void>;
  setProviderSurface: (request: { providerId: ProviderId; surface: ProviderSurface }) => Promise<void>;
  patchSettings: (patch: Partial<RendererSettings>) => Promise<void>;
  setContentBounds: (bounds: ViewBounds) => Promise<void>;
}

export const useAppStore = create<AppStore>((set, get) => ({
  ...fallbackState,
  loading: true,
  boot: async () => {
    const state = normalizeDockState(await dock.getState());
    set({ ...state, loading: false });
    dock.onStateChange((nextState) => {
      set({ ...normalizeDockState(nextState), loading: false });
    });
  },
  activateProvider: async ({ providerId }) => {
    set({ loading: true });

    if (dock.activateProvider) {
      const state = normalizeDockState(await dock.activateProvider({ providerId }));
      set({ ...state, loading: false });
      return;
    }

    const activeInput = get().settings.providerTabs[providerId]?.currentInput ?? DEFAULT_PROVIDER_TABS[providerId].currentInput;
    const state = normalizeDockState(await dock.navigate({ providerId, input: activeInput }));
    set({ ...state, loading: false });
  },
  navigate: async (request) => {
    set({ loading: true });
    const state = normalizeDockState(await dock.navigate(request));
    set({ ...state, loading: false });
  },
  reloadActiveProvider: async () => {
    if (!dock.reloadActiveProvider) {
      return;
    }

    set({ loading: true });
    const state = normalizeDockState(await dock.reloadActiveProvider());
    set({ ...state, loading: false });
  },
  setProviderSurface: async ({ providerId, surface }) => {
    set({ loading: true });

    if (dock.setProviderSurface) {
      const state = normalizeDockState(await dock.setProviderSurface({ providerId, surface }));
      set({ ...state, loading: false });
      return;
    }

    if (providerId === "x") {
      const patch = {
        xBootstrapCompleted: surface === "mobile"
      };
      const state = normalizeDockState(await dock.updateSettings(patch));
      set({ ...state, loading: false });
      return;
    }

    const state = normalizeDockState(await dock.updateSettings({}));
    set({ ...state, loading: false });
  },
  patchSettings: async (patch) => {
    set({ loading: true });
    const state = normalizeDockState(await dock.updateSettings(patch as Record<string, unknown>));
    set({ ...state, loading: false });
  },
  setContentBounds: async (bounds) => {
    await dock.setContentBounds(bounds);
  }
}));
