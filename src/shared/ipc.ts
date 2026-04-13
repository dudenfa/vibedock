import type { AppSettings } from "./settings";
import type { ProviderDefinition, ProviderId, ProviderResolvedTarget, ProviderStatus, ProviderSurface } from "./providers";

export interface ViewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DockState {
  settings: AppSettings;
  providers: ProviderDefinition[];
  activeProviderId: ProviderId;
  activeTarget: ProviderResolvedTarget;
  activeSurface: ProviderSurface;
  status: ProviderStatus;
  statusMessage: string;
}

export interface ProviderNavigationRequest {
  providerId: ProviderId;
  input: string;
}

export interface ProviderActivationRequest {
  providerId: ProviderId;
}

export interface ProviderSurfaceRequest {
  providerId: ProviderId;
  surface: ProviderSurface;
}

export interface DockApi {
  getState: () => Promise<DockState>;
  activateProvider: (request: ProviderActivationRequest) => Promise<DockState>;
  navigate: (request: ProviderNavigationRequest) => Promise<DockState>;
  setProviderSurface: (request: ProviderSurfaceRequest) => Promise<DockState>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<DockState>;
  setContentBounds: (bounds: ViewBounds) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  beginScreenshotMode: () => Promise<void>;
  openSettingsPanel: () => Promise<void>;
  onStateChange: (listener: (state: DockState) => void) => () => void;
}

export const IPC_CHANNELS = {
  getState: "dock:get-state",
  activateProvider: "dock:activate-provider",
  navigate: "dock:navigate",
  setProviderSurface: "dock:set-provider-surface",
  updateSettings: "dock:update-settings",
  setContentBounds: "dock:set-content-bounds",
  openExternal: "dock:open-external",
  beginScreenshotMode: "dock:begin-screenshot-mode",
  openSettingsPanel: "dock:open-settings-panel",
  stateChanged: "dock:state-changed"
} as const;
