# VibeDock

VibeDock is an always-on-top floating media dock for developers. It is designed for macOS and Linux as a lightweight companion window for waiting on builds, scripts, and AI agents.

## Current status

This repository contains the `v0.1` foundation:

- Electron + React + TypeScript app shell
- Frameless always-on-top dock window
- Persistent window bounds and app settings
- Global hide/show shortcut
- Screenshot helper shortcut
- Provider abstraction with `X` implemented first
- `X mobile web timeline mode` for best-effort logged-in browsing
- First-run `X desktop login helper` that reuses the same session and hands back to mobile web
- Separate settings panel window so controls never sit underneath the live browser surface
- Local logging, isolated provider sessions, and permission deny defaults

## Quick start

```bash
npm install
npm run dev
```

Useful shortcuts:

- `CommandOrControl+Shift+Space`: hide or show the dock
- `CommandOrControl+Shift+S`: hide the dock briefly for screenshots

## Verification

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
```

## Project structure

- `src/main`: Electron main process, window management, providers, sessions, settings, shortcuts
- `src/preload`: typed IPC bridge
- `src/renderer`: React dock chrome and settings UI
- `src/shared`: shared types, schemas, IPC contracts
- `tests`: unit, contract, and Electron smoke tests

## Known MVP constraints

- `X mobile web timeline mode` is still a best-effort embedded shell and may break if X changes login, layout, or anti-bot behavior.
- The first login flow is intentionally bootstrapped through a desktop helper because direct first-run mobile sign-in is not reliable enough yet.
- Linux window-manager behavior can still vary across Wayland/X11 setups and should be validated on real machines.
- macOS system screenshot shortcuts such as `Cmd+Shift+4` are owned by the OS, so VibeDock includes its own screenshot helper instead of trying to intercept them reliably.
