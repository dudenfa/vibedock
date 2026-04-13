import { useEffect, useMemo, useRef, useState } from "react";
import type { ProviderId, ProviderSurface } from "../shared/providers";
import { WINDOW_SIZE_PRESETS, type WindowSizePreset } from "../shared/window-size";
import { useAppStore } from "./store";

const panelKind = new URLSearchParams(window.location.search).get("panel") === "settings"
  ? "settings"
  : "dock";

function getShortcutGlyph(): string {
  return navigator.platform.toLowerCase().includes("mac") ? "Cmd" : "Ctrl";
}

function getShellPresetClass(windowSizePreset: WindowSizePreset): string {
  return `shell-size-${windowSizePreset}`;
}

function getBootstrapSurfaceDescription(providerId: ProviderId, providerLabel: string): string {
  if (providerId === "x") {
    return "Use the desktop login helper when auth gets picky, then return to the mobile feed view.";
  }

  if (providerId === "tiktok") {
    return `${providerLabel} works better as a desktop web timeline right now. Mobile web stays available if you want to compare surfaces.`;
  }

  return `${providerLabel} runs directly in mobile web inside VibeDock.`;
}

function getSurfaceDescription(
  providerId: ProviderId,
  providerLabel: string,
  surface: ProviderSurface
): string {
  if (surface === "bootstrap") {
    if (providerId === "x") {
      return `You are in the ${providerLabel} desktop login helper. Finish logging in here, then return to mobile web.`;
    }

    if (providerId === "tiktok") {
      return `You are in the ${providerLabel} desktop web view. This is the recommended way to browse TikTok inside VibeDock.`;
    }

    return `You are in the ${providerLabel} mobile web view.`;
  }

  if (providerId === "x") {
    return `You are in the ${providerLabel} mobile web timeline. If login stops working, reopen the desktop helper to refresh the session.`;
  }

  if (providerId === "tiktok") {
    return `You are in the ${providerLabel} mobile web view. TikTok may still push the install-app experience here, so desktop web is usually more reliable.`;
  }

  return `You are in the ${providerLabel} mobile web view. Login and browsing should stay inside this surface now.`;
}

function getSurfaceToggleCopy(providerId: ProviderId, surface: ProviderSurface): string {
  if (surface === "bootstrap") {
    return providerId === "x" ? "Continue to mobile web" : "Switch to mobile web";
  }

  return providerId === "x" ? "Reopen desktop login helper" : "Switch back to desktop web";
}

function SettingsContent(props: {
  activeProviderId: ProviderId;
  activeProviderLabel: string;
  input: string;
  setInput: (value: string) => void;
  loading: boolean;
  statusMessage: string;
  activeTargetUrl: string;
  activeSurface: ProviderSurface;
  settings: ReturnType<typeof useAppStore.getState>["settings"];
  navigate: ReturnType<typeof useAppStore.getState>["navigate"];
  setProviderSurface: ReturnType<typeof useAppStore.getState>["setProviderSurface"];
  patchSettings: ReturnType<typeof useAppStore.getState>["patchSettings"];
  reloadActiveProvider: ReturnType<typeof useAppStore.getState>["reloadActiveProvider"];
  onClose?: () => void;
}) {
  const {
    activeProviderId,
    activeProviderLabel,
    input,
    setInput,
    loading,
    statusMessage,
    activeTargetUrl,
    activeSurface,
    settings,
    navigate,
    setProviderSurface,
    patchSettings,
    reloadActiveProvider,
    onClose
  } = props;
  const shortcutGlyph = getShortcutGlyph();

  const submitNavigation = async () => {
    await navigate({
      providerId: activeProviderId,
      input
    });
  };

  const switchSurface = async (nextSurface: ProviderSurface) => {
    await setProviderSurface({
      providerId: activeProviderId,
      surface: nextSurface
    });
    onClose?.();
  };

  return (
    <div className="settings-stack">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
          {activeProviderLabel} controls
        </p>
        <p className="mt-1 text-sm text-white/80">
          {getBootstrapSurfaceDescription(activeProviderId, activeProviderLabel)}
        </p>
      </div>

      <div className="setting-stack">
        <span>Screen size</span>
        <p className="text-xs leading-5 text-[var(--text-muted)]">
          Choose small, medium, or big. The preset keeps the floating screen tuned for each provider.
        </p>
        <div className="preset-group">
          {(Object.entries(WINDOW_SIZE_PRESETS) as Array<[WindowSizePreset, (typeof WINDOW_SIZE_PRESETS)[WindowSizePreset]]>).map(
            ([preset, meta]) => (
              <button
                key={preset}
                className={`preset-button ${settings.windowSizePreset === preset ? "preset-button-active" : ""}`}
                type="button"
                onClick={() => {
                  void patchSettings({ windowSizePreset: preset });
                }}
              >
                <span>{meta.label}</span>
              </button>
            )
          )}
        </div>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submitNavigation();
        }}
      >
        <input
          className="input-shell"
          type="url"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={`Paste a ${activeProviderLabel} URL`}
        />
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? "Loading…" : "Go"}
        </button>
      </form>

      <div className="mt-3 grid gap-3">
        <div className="setting-stack">
          <span>{activeProviderLabel} view</span>
          <p className="text-xs leading-5 text-[var(--text-muted)]">
            {getSurfaceDescription(activeProviderId, activeProviderLabel, activeSurface)}
          </p>
          <div className="flex flex-wrap gap-2">
            {activeProviderId === "instagram" ? null : activeSurface === "bootstrap" ? (
              <button
                className="secondary-link"
                type="button"
                onClick={() => {
                  void switchSurface("mobile");
                }}
              >
                {getSurfaceToggleCopy(activeProviderId, "bootstrap")}
              </button>
            ) : (
              <button
                className="secondary-link"
                type="button"
                onClick={() => {
                  void switchSurface("bootstrap");
                }}
              >
                {getSurfaceToggleCopy(activeProviderId, "mobile")}
              </button>
            )}
            <button
              className="secondary-link"
              type="button"
              onClick={() => {
                void reloadActiveProvider();
              }}
            >
              Refresh current
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="setting-row">
            <span>Always on top</span>
            <input
              type="checkbox"
              checked={settings.alwaysOnTop}
              onChange={(event) => {
                void patchSettings({ alwaysOnTop: event.target.checked });
              }}
            />
          </label>

          <label className="setting-row">
            <span>Restore session</span>
            <input
              type="checkbox"
              checked={settings.restoreLastSession}
              onChange={(event) => {
                void patchSettings({ restoreLastSession: event.target.checked });
              }}
            />
          </label>

          <label className="setting-row">
            <span>Start hidden</span>
            <input
              type="checkbox"
              checked={settings.startHidden}
              onChange={(event) => {
                void patchSettings({ startHidden: event.target.checked });
              }}
            />
          </label>

          <label className="setting-row">
            <span>Launch at login</span>
            <input
              type="checkbox"
              checked={settings.launchAtLogin}
              onChange={(event) => {
                void patchSettings({ launchAtLogin: event.target.checked });
              }}
            />
          </label>

          <div className="setting-stack sm:col-span-2">
            <span>Screenshot helper</span>
            <p className="text-xs leading-5 text-[var(--text-muted)]">
              Hide the dock for a few seconds, take the screenshot you want, and let it return automatically.
            </p>
            <button
              className="secondary-link mt-1 self-start"
              type="button"
              onClick={() => {
                void window.dock.beginScreenshotMode();
              }}
            >
              Hide for screenshot ({shortcutGlyph}+Shift+S)
            </button>
          </div>

          <label className="setting-stack">
            <span>Opacity</span>
            <input
              type="range"
              min="0.7"
              max="1"
              step="0.01"
              value={settings.opacity}
              onChange={(event) => {
                void patchSettings({ opacity: Number(event.target.value) });
              }}
            />
          </label>

          <label className="setting-stack">
            <span>Shortcut</span>
            <input
              className="mini-input"
              type="text"
              value={settings.shortcut}
              onChange={(event) => {
                void patchSettings({ shortcut: event.target.value });
              }}
            />
          </label>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-xs text-[var(--text-muted)]">{statusMessage}</div>
        <button
          className="secondary-link"
          type="button"
          onClick={() => {
            void window.dock.openExternal(activeTargetUrl);
          }}
        >
          Open current in browser
        </button>
      </div>
    </div>
  );
}

function SettingsPanelView() {
  const {
    boot,
    activeProviderId,
    providers,
    activeTarget,
    activeSurface,
    settings,
    statusMessage,
    loading,
    navigate,
    reloadActiveProvider,
    setProviderSurface,
    patchSettings
  } = useAppStore();
  const [input, setInput] = useState(settings.providerTabs[settings.activeProviderId].currentInput);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    setInput(activeTarget.input);
  }, [activeTarget.input]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || ((event.metaKey || event.ctrlKey) && event.key === ",")) {
        event.preventDefault();
        window.close();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const activeProvider = providers.find((provider) => provider.id === activeProviderId);

  return (
    <main className={`settings-panel-page h-screen overflow-hidden bg-[var(--app-bg)] p-2.5 text-[var(--text-main)] ${getShellPresetClass(settings.windowSizePreset)}`}>
      <section className="settings-window flex h-full min-h-0 flex-col overflow-hidden rounded-[26px] border border-white/8 bg-[var(--phone-body)] p-2.5 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
        <header className="drag-region settings-titlebar relative shrink-0 rounded-[18px] border border-white/6 bg-[var(--panel-bg-soft)] px-3 py-2.5">
          <div className="drag-strip absolute inset-x-4 top-1.5 h-3 rounded-full" aria-hidden="true" />
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                Settings
              </p>
              <p className="mt-1 text-sm text-white/80">
                Move this panel anywhere, then scroll through the controls.
              </p>
            </div>
            <button className="control-icon control-icon-compact no-drag" type="button" onClick={() => { window.close(); }} aria-label="Close settings">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                <path
                  d="m6 6 12 12M18 6 6 18"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
          </div>
        </header>

        <div className="no-drag mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
          <SettingsContent
            activeProviderId={activeProviderId}
            activeProviderLabel={activeProvider?.label ?? activeProviderId}
            input={input}
            setInput={setInput}
            loading={loading}
            statusMessage={statusMessage}
            activeTargetUrl={activeTarget.resolvedUrl}
            activeSurface={activeSurface}
            settings={settings}
            navigate={navigate}
            reloadActiveProvider={reloadActiveProvider}
            setProviderSurface={setProviderSurface}
            patchSettings={patchSettings}
          />
        </div>
      </section>
    </main>
  );
}

function DockView() {
  const {
    boot,
    providers,
    activeProviderId,
    activeTarget,
    settings,
    activateProvider,
    reloadActiveProvider,
    setContentBounds
  } = useAppStore();
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        event.preventDefault();
        void window.dock.openSettingsPanel();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "r") {
        event.preventDefault();
        void reloadActiveProvider();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void window.dock.beginScreenshotMode();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [reloadActiveProvider]);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) {
      return;
    }

    const updateBounds = () => {
      const rect = element.getBoundingClientRect();
      void setContentBounds({
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      });
    };

    updateBounds();
    const frame = window.requestAnimationFrame(updateBounds);
    const observer = new ResizeObserver(updateBounds);
    observer.observe(element);
    window.addEventListener("resize", updateBounds);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", updateBounds);
    };
  }, [setContentBounds]);

  const activeProvider = useMemo(
    () => providers.find((provider) => provider.id === activeProviderId),
    [activeProviderId, providers]
  );

  return (
    <main className={`app-stage h-screen overflow-hidden bg-[var(--app-bg)] text-[var(--text-main)] ${getShellPresetClass(settings.windowSizePreset)}`}>
      <div className="flex h-full items-center justify-center p-2.5 sm:p-3">
        <section className="browser-shell drag-region flex h-full w-full max-w-[min(98vw,1700px)] flex-col overflow-hidden rounded-[26px] border border-white/8 bg-[var(--phone-body)] p-1.5 shadow-[0_30px_100px_rgba(0,0,0,0.6)]">
          <header className="relative z-10 shrink-0 rounded-[18px] border border-white/6 bg-[var(--panel-bg-soft)] px-2 py-2">
            <div className="drag-strip absolute inset-x-4 top-1.5 h-3 rounded-full" aria-hidden="true" />

            <div className="flex items-center gap-2">
              <div className="provider-tabbar no-drag flex min-w-0 flex-1 items-center gap-1.5">
                {providers.map((provider) => {
                  const isActive = provider.id === activeProviderId;
                  return (
                    <button
                      key={provider.id}
                      className={`provider-tab ${isActive ? "provider-tab-active" : "provider-tab-idle"}`}
                      type="button"
                      onClick={() => {
                        void activateProvider({
                          providerId: provider.id
                        });
                      }}
                    >
                      <span className="provider-tab-label">{provider.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                className="control-icon control-icon-compact no-drag shrink-0"
                type="button"
                onClick={() => {
                  void window.dock.openSettingsPanel();
                }}
                aria-label="Settings"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                  <path
                    d="M4 7h10M18 7h2M10 17h10M4 17h2M14 7a2 2 0 1 1 4 0a2 2 0 0 1-4 0ZM6 17a2 2 0 1 1 4 0a2 2 0 0 1-4 0Z"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.6"
                  />
                </svg>
              </button>
            </div>
          </header>

          <section className="relative mt-1.5 min-h-0 flex-1 rounded-[22px] p-0.5">
            <div className="browser-outline pointer-events-none absolute inset-0 rounded-[22px]" />
            <div
              ref={contentRef}
              className="content-shell no-drag relative h-full overflow-hidden rounded-[20px] border border-white/6 bg-[#050505]"
            >
              <div className="pointer-events-none flex h-full flex-col items-center justify-center px-6 text-center">
                <div className="mb-3 h-10 w-10 rounded-[14px] border border-white/10 bg-white/5" />
                <p className="text-sm font-medium text-white/90">Live provider screen</p>
                <p className="mt-2 max-w-[16rem] text-xs leading-5 text-[var(--text-muted)]">
                  This area becomes the live {activeProvider?.label ?? activeProviderId} session once the page mounts.
                </p>
                <p className="mt-3 text-[10px] uppercase tracking-[0.28em] text-white/36">{activeTarget.resolvedUrl}</p>
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

export function App() {
  if (panelKind === "settings") {
    return <SettingsPanelView />;
  }

  return <DockView />;
}
