import type { AppSettings } from "./settings";
import type {
  ProviderDefinition,
  ProviderMode,
  ProviderResolvedTarget,
  ProviderStatus
} from "./providers";

export interface ViewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DockState {
  settings: AppSettings;
  providers: ProviderDefinition[];
  activeTarget: ProviderResolvedTarget;
  status: ProviderStatus;
  statusMessage: string;
}

export interface ProviderNavigationRequest {
  mode: ProviderMode;
  input: string;
}

export interface DockApi {
  getState: () => Promise<DockState>;
  navigate: (request: ProviderNavigationRequest) => Promise<DockState>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<DockState>;
  setContentBounds: (bounds: ViewBounds) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  onStateChange: (listener: (state: DockState) => void) => () => void;
}

export const IPC_CHANNELS = {
  getState: "dock:get-state",
  navigate: "dock:navigate",
  updateSettings: "dock:update-settings",
  setContentBounds: "dock:set-content-bounds",
  openExternal: "dock:open-external",
  stateChanged: "dock:state-changed"
} as const;

