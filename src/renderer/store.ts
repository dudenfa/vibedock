import { create } from "zustand";
import type { DockState, ProviderNavigationRequest, ViewBounds } from "../shared/ipc";
import { defaultSettings } from "../shared/settings";

interface AppStore extends DockState {
  loading: boolean;
  boot: () => Promise<void>;
  navigate: (request: ProviderNavigationRequest) => Promise<void>;
  patchSettings: (patch: Partial<DockState["settings"]>) => Promise<void>;
  setContentBounds: (bounds: ViewBounds) => Promise<void>;
}

const fallbackState: DockState = {
  settings: defaultSettings,
  providers: [],
  activeTarget: {
    providerId: "x",
    mode: "browser",
    input: defaultSettings.currentInput,
    resolvedUrl: defaultSettings.currentInput,
    title: "X Timeline"
  },
  status: "idle",
  statusMessage: "Booting"
};

export const useAppStore = create<AppStore>((set) => ({
  ...fallbackState,
  loading: true,
  boot: async () => {
    const state = await window.dock.getState();
    set({ ...state, loading: false });
    window.dock.onStateChange((nextState) => {
      set({ ...nextState, loading: false });
    });
  },
  navigate: async (request) => {
    set({ loading: true });
    const state = await window.dock.navigate(request);
    set({ ...state, loading: false });
  },
  patchSettings: async (patch) => {
    const state = await window.dock.updateSettings(patch);
    set({ ...state, loading: false });
  },
  setContentBounds: async (bounds) => {
    await window.dock.setContentBounds(bounds);
  }
}));
