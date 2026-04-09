import { useEffect, useRef, useState } from "react";
import { useAppStore } from "./store";

export function App() {
  const {
    boot,
    providers,
    activeTarget,
    settings,
    status,
    statusMessage,
    loading,
    navigate,
    patchSettings,
    setContentBounds
  } = useAppStore();

  const [input, setInput] = useState(settings.currentInput);
  const [showSettings, setShowSettings] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    setInput(activeTarget.input);
  }, [activeTarget.input]);

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
    const observer = new ResizeObserver(updateBounds);
    observer.observe(element);
    window.addEventListener("resize", updateBounds);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateBounds);
    };
  }, [setContentBounds, showSettings]);

  const currentProvider = providers[0];

  const submitNavigation = async () => {
    await navigate({
      mode: "browser",
      input
    });
  };

  return (
    <main className="app-stage h-screen overflow-hidden bg-[var(--app-bg)] text-[var(--text-main)]">
      <div className="flex h-full items-center justify-center p-4">
        <section className="browser-shell flex h-full w-full max-w-[560px] flex-col overflow-hidden rounded-[36px] border border-white/10 bg-[var(--phone-body)] p-2 shadow-[0_40px_110px_rgba(2,6,23,0.58)]">
          <header className="drag-region shrink-0 rounded-[28px] border border-white/8 bg-[var(--panel-bg-soft)] px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="no-drag flex items-center gap-2">
                <div className="browser-chip">
                  <span className={loading ? "status-dot status-dot-live" : "status-dot"} />
                  <span>{currentProvider?.label ?? "X"}</span>
                </div>
                <div className="browser-chip browser-chip-muted">
                  <span>{loading ? "Loading" : status}</span>
                </div>
                {settings.xMobileEmulation ? (
                  <div className="browser-chip browser-chip-accent">
                    <span>Mobile</span>
                  </div>
                ) : null}
              </div>

              <button
                className="control-icon no-drag"
                type="button"
                onClick={() => setShowSettings((current) => !current)}
                aria-label="Settings"
                aria-expanded={showSettings}
                aria-controls="settings-panel"
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

            {showSettings ? (
              <div
                id="settings-panel"
                className="no-drag mt-3 rounded-[24px] border border-white/8 bg-[var(--panel-bg-strong)] p-3"
              >
                <div className="mb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                    Dock controls
                  </p>
                  <p className="mt-1 text-sm text-white/88">
                    Keep the browser nearly full-screen and only open controls when you need them.
                  </p>
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
                    placeholder={currentProvider?.description ?? "Paste an x.com timeline or profile URL"}
                  />
                  <button className="primary-button" type="submit" disabled={loading}>
                    {loading ? "Loading…" : "Go"}
                  </button>
                </form>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="setting-stack sm:col-span-2">
                    <span>Experimental mobile emulation</span>
                    <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/8 bg-white/[0.03] px-3 py-2">
                      <p className="text-xs leading-5 text-[var(--text-muted)]">
                        Uses Chromium-compatible mobile browser hints while reusing your X session.
                        If Google or Apple sign-in fails here, sign in once in Browser mode and
                        switch back to Mobile.
                      </p>
                      <input
                        type="checkbox"
                        checked={settings.xMobileEmulation}
                        onChange={(event) => {
                          void patchSettings({ xMobileEmulation: event.target.checked });
                        }}
                      />
                    </div>
                  </label>

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

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-xs text-[var(--text-muted)]">{statusMessage}</div>
                  <button
                    className="secondary-link"
                    type="button"
                    onClick={() => {
                      void window.dock.openExternal(activeTarget.resolvedUrl);
                    }}
                  >
                    Open current in browser
                  </button>
                </div>
              </div>
            ) : null}
          </header>

          <section className="no-drag relative mt-2 min-h-0 flex-1">
            <div className="browser-outline pointer-events-none absolute inset-0 rounded-[30px]" />
            <div
              ref={contentRef}
              className="content-shell relative h-full overflow-hidden rounded-[30px] border border-white/8 bg-[#050c19]"
            >
              <div className="pointer-events-none flex h-full flex-col items-center justify-center px-6 text-center">
                <div className="mb-3 h-12 w-12 rounded-[16px] border border-white/10 bg-white/5" />
                <p className="text-sm font-medium text-white/88">Timeline viewport</p>
                <p className="mt-2 max-w-[15rem] text-xs leading-5 text-[var(--text-muted)]">
                  This area becomes the live X browser session once the page mounts.
                </p>
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
