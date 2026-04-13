import { useEffect, useMemo, useRef, useState } from "react";
import type { ProviderId, ProviderSurface } from "../shared/providers";
import { useAppStore } from "./store";

const panelKind = new URLSearchParams(window.location.search).get("panel") === "settings"
  ? "settings"
  : "dock";

function getShortcutGlyph(): string {
  return navigator.platform.toLowerCase().includes("mac") ? "Cmd" : "Ctrl";
}

function getBootstrapSurfaceLabel(providerId: ProviderId): string {
  return providerId === "tiktok" ? "Desktop web" : "Login helper";
}

function getBootstrapSurfaceDescription(providerId: ProviderId, providerLabel: string): string {
  if (providerId === "tiktok") {
    return `${providerLabel} works better as a desktop web timeline right now. Mobile web is still available in case you want to experiment with it.`;
  }

  return `Use the desktop login helper when auth gets picky, then return to the mobile feed view.`;
}

function getSurfaceDescription(
  providerId: ProviderId,
  providerLabel: string,
  surface: ProviderSurface
): string {
  if (surface === "bootstrap") {
    if (providerId === "tiktok") {
      return `You are in the ${providerLabel} desktop web view. This is currently the recommended way to browse TikTok inside VibeDock.`;
    }

    return `You are in the ${providerLabel} desktop login helper. Finish logging in here, then return to the mobile web tab.`;
  }

  if (providerId === "tiktok") {
    return `You are in the ${providerLabel} mobile web view. TikTok may still push the install-app experience here, so desktop web is usually more reliable.`;
  }

  return `You are in the ${providerLabel} mobile web timeline. If login ever stops working, reopen the desktop helper to refresh the session.`;
}

function getSurfaceToggleCopy(providerId: ProviderId, surface: ProviderSurface): string {
  if (surface === "bootstrap") {
    return providerId === "tiktok" ? "Switch to mobile web" : "Continue to mobile web";
  }

  return providerId === "tiktok" ? "Switch back to desktop web" : "Reopen desktop login helper";
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
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
            {activeProviderLabel} controls
          </p>
          <p className="mt-1 text-sm text-white/88">
            {getBootstrapSurfaceDescription(activeProviderId, activeProviderLabel)}
          </p>
        </div>
        {onClose ? (
          <button className="control-icon no-drag" type="button" onClick={onClose} aria-label="Close settings">
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
        ) : null}
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
            {activeSurface === "bootstrap" ? (
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
    <main className="settings-panel-page h-screen overflow-hidden bg-[var(--app-bg)] p-3 text-[var(--text-main)]">
      <section className="settings-window flex h-full flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[var(--phone-body)] p-3 shadow-[0_32px_90px_rgba(2,6,23,0.44)]">
        <header className="drag-region relative mb-3 rounded-[24px] border border-white/8 bg-[var(--panel-bg-soft)] px-4 py-3">
          <div className="drag-strip absolute inset-x-4 top-2 h-4 rounded-full" aria-hidden="true" />
          <div className="no-drag">
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
              setProviderSurface={setProviderSurface}
              patchSettings={patchSettings}
              onClose={() => {
                window.close();
              }}
            />
          </div>
        </header>
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
    activeSurface,
    status,
    statusMessage,
    loading,
    activateProvider,
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

      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void window.dock.beginScreenshotMode();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

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
  const surfaceLabel = activeSurface === "bootstrap"
    ? getBootstrapSurfaceLabel(activeProviderId)
    : "Mobile web";
  const surfaceMessage = activeSurface === "bootstrap"
    ? getSurfaceDescription(
        activeProviderId,
        activeProvider?.label ?? activeProviderId,
        "bootstrap"
      )
    : statusMessage;

  return (
    <main className="app-stage h-screen overflow-hidden bg-[var(--app-bg)] text-[var(--text-main)]">
      <div className="flex h-full items-center justify-center p-4">
        <section className="browser-shell drag-region flex h-full w-full max-w-[560px] flex-col overflow-hidden rounded-[36px] border border-white/10 bg-[var(--phone-body)] p-3 shadow-[0_40px_110px_rgba(2,6,23,0.58)]">
          <header className="relative z-10 shrink-0 rounded-[28px] border border-white/8 bg-[var(--panel-bg-soft)] px-3 pb-3 pt-4">
            <div className="drag-strip absolute inset-x-4 top-2 h-4 rounded-full" aria-hidden="true" />

            <div className="flex items-center gap-3">
              <div className="provider-tabbar no-drag flex min-w-0 flex-1 items-end gap-2">
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
                className="control-icon no-drag shrink-0"
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

            <div className="mt-3 no-drag flex flex-wrap items-center gap-2">
              <div className="browser-chip">
                <span className={loading ? "status-dot status-dot-live" : "status-dot"} />
                <span>{activeProvider?.label ?? activeProviderId}</span>
              </div>
              <div className="browser-chip browser-chip-muted">
                <span>{loading ? "Loading" : status}</span>
              </div>
              <div className="browser-chip browser-chip-accent">
                <span>{surfaceLabel}</span>
              </div>
            </div>

            <p className="mt-3 max-w-[24rem] text-xs leading-5 text-[var(--text-muted)]">
              {surfaceMessage}
            </p>
          </header>

          <section className="relative mt-3 min-h-0 flex-1 rounded-[32px] p-2">
            <div className="browser-outline pointer-events-none absolute inset-0 rounded-[30px]" />
            <div
              ref={contentRef}
              className="content-shell no-drag relative h-full overflow-hidden rounded-[30px] border border-white/8 bg-[#050c19]"
            >
              <div className="pointer-events-none flex h-full flex-col items-center justify-center px-6 text-center">
                <div className="mb-3 h-12 w-12 rounded-[16px] border border-white/10 bg-white/5" />
                <p className="text-sm font-medium text-white/88">Timeline viewport</p>
                <p className="mt-2 max-w-[15rem] text-xs leading-5 text-[var(--text-muted)]">
                  This area becomes the live {activeProvider?.label ?? activeProviderId} session once the page mounts.
                </p>
                <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-white/40">
                  {activeTarget.resolvedUrl}
                </p>
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
