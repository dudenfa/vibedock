import { contextBridge, ipcRenderer } from "electron";
import {
  IPC_CHANNELS,
  type DockApi,
  type ProviderActivationRequest,
  type ProviderNavigationRequest,
  type ProviderSurfaceRequest,
  type ViewBounds
} from "../shared/ipc";
import type { AppSettings } from "../shared/settings";

const api: DockApi = {
  getState: () => ipcRenderer.invoke(IPC_CHANNELS.getState),
  activateProvider: (request: ProviderActivationRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.activateProvider, request),
  navigate: (request: ProviderNavigationRequest) => ipcRenderer.invoke(IPC_CHANNELS.navigate, request),
  setProviderSurface: (request: ProviderSurfaceRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.setProviderSurface, request),
  updateSettings: (patch: Partial<AppSettings>) => ipcRenderer.invoke(IPC_CHANNELS.updateSettings, patch),
  setContentBounds: (bounds: ViewBounds) => ipcRenderer.invoke(IPC_CHANNELS.setContentBounds, bounds),
  openExternal: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.openExternal, url),
  beginScreenshotMode: () => ipcRenderer.invoke(IPC_CHANNELS.beginScreenshotMode),
  openSettingsPanel: () => ipcRenderer.invoke(IPC_CHANNELS.openSettingsPanel),
  onStateChange: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, state: Awaited<ReturnType<DockApi["getState"]>>) => {
      listener(state);
    };
    ipcRenderer.on(IPC_CHANNELS.stateChanged, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.stateChanged, wrapped);
    };
  }
};

contextBridge.exposeInMainWorld("dock", api);

declare global {
  interface Window {
    dock: DockApi;
  }
}
