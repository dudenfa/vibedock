import { useEffect, useRef, useState } from "react";
import { useAppStore } from "./store";

const panelKind = new URLSearchParams(window.location.search).get("panel") === "settings"
  ? "settings"
  : "dock";

function getShortcutGlyph(): string {
  return navigator.platform.toLowerCase().includes("mac") ? "Cmd" : "Ctrl";
}

function SettingsContent(props: {
  input: string;
  setInput: (value: string) => void;
  loading: boolean;
  statusMessage: string;
  activeTargetUrl: string;
  activeSurface: "mobile" | "bootstrap";
  settings: ReturnType<typeof useAppStore.getState>["settings"];
  navigate: ReturnType<typeof useAppStore.getState>["navigate"];
  patchSettings: ReturnType<typeof useAppStore.getState>["patchSettings"];
  onClose?: () => void;
}) {
  const {
    input,
    setInput,
    loading,
    statusMessage,
    activeTargetUrl,
    activeSurface,
    settings,
    navigate,
    patchSettings,
    onClose
  } = props;
  const shortcutGlyph = getShortcutGlyph();

  const submitNavigation = async () => {
    await navigate({
      input
    });
  };

  const switchSurface = async (nextSurface: "mobile" | "bootstrap") => {
    await patchSettings({
      xBootstrapCompleted: nextSurface === "mobile"
    });
    await navigate({
      input
    });
    onClose?.();
  };

  return (
    <div className="settings-stack">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
            Dock controls
          </p>
          <p className="mt-1 text-sm text-white/88">
            Sign in with the desktop helper once, then keep scrolling in the mobile web dock.
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
          placeholder="Paste an x.com timeline or profile URL"
        />
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? "Loading…" : "Go"}
        </button>
      </form>

      <div className="mt-3 grid gap-3">
        <div className="setting-stack">
          <span>Timeline view</span>
          <p className="text-xs leading-5 text-[var(--text-muted)]">
            {activeSurface === "bootstrap"
              ? "You are in the desktop login helper. Finish logging into X here, then switch back to mobile web."
              : "You are in the mobile web timeline. If login ever stops working, reopen the desktop helper to refresh the session."}
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
                Continue to mobile web
              </button>
            ) : (
              <button
                className="secondary-link"
                type="button"
                onClick={() => {
                  void switchSurface("bootstrap");
                }}
              >
                Reopen desktop login helper
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
    activeTarget,
    activeSurface,
    settings,
    statusMessage,
    loading,
    navigate,
    patchSettings
  } = useAppStore();
  const [input, setInput] = useState(settings.currentInput);

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

  return (
    <main className="settings-panel-page h-screen overflow-hidden bg-[var(--app-bg)] p-3 text-[var(--text-main)]">
      <section className="settings-window flex h-full flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[var(--phone-body)] p-3 shadow-[0_32px_90px_rgba(2,6,23,0.44)]">
        <header className="drag-region relative mb-3 rounded-[24px] border border-white/8 bg-[var(--panel-bg-soft)] px-4 py-3">
          <div className="drag-strip absolute inset-x-4 top-2 h-4 rounded-full" aria-hidden="true" />
          <div className="no-drag">
            <SettingsContent
              input={input}
              setInput={setInput}
              loading={loading}
              statusMessage={statusMessage}
              activeTargetUrl={activeTarget.resolvedUrl}
              activeSurface={activeSurface}
              settings={settings}
              navigate={navigate}
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
    activeTarget,
    activeSurface,
    status,
    statusMessage,
    loading,
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

  const currentProvider = providers[0];
  const surfaceLabel = activeSurface === "bootstrap" ? "Login helper" : "Mobile web";
  const surfaceMessage = activeSurface === "bootstrap"
    ? "Finish login in this desktop helper, then open Settings and switch back to mobile web."
    : statusMessage;

  return (
    <main className="app-stage h-screen overflow-hidden bg-[var(--app-bg)] text-[var(--text-main)]">
      <div className="flex h-full items-center justify-center p-4">
        <section className="browser-shell drag-region flex h-full w-full max-w-[560px] flex-col overflow-hidden rounded-[36px] border border-white/10 bg-[var(--phone-body)] p-3 shadow-[0_40px_110px_rgba(2,6,23,0.58)]">
          <header className="relative z-10 shrink-0 rounded-[28px] border border-white/8 bg-[var(--panel-bg-soft)] px-3 pb-3 pt-5">
            <div className="drag-strip absolute inset-x-4 top-2 h-4 rounded-full" aria-hidden="true" />

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="browser-chip">
                  <span className={loading ? "status-dot status-dot-live" : "status-dot"} />
                  <span>{currentProvider?.label ?? "X"}</span>
                </div>
                <div className="browser-chip browser-chip-muted">
                  <span>{loading ? "Loading" : status}</span>
                </div>
                <div className="browser-chip browser-chip-accent">
                  <span>{surfaceLabel}</span>
                </div>
              </div>

              <button
                className="control-icon no-drag"
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

            <p className="mt-3 max-w-[23rem] text-xs leading-5 text-[var(--text-muted)]">
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
                  This area becomes the live X session once the page mounts.
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
