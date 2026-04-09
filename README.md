# VibeDock

VibeDock is an always-on-top floating media dock for developers. It is designed for macOS and Linux as a lightweight companion window for waiting on builds, scripts, and AI agents.

## Current status

This repository contains the `v0.1` foundation:

- Electron + React + TypeScript app shell
- Frameless always-on-top dock window
- Persistent window bounds and app settings
- Global hide/show shortcut
- Provider abstraction with `X` implemented first
- `X Browser timeline mode` for best-effort logged-in browsing
- Local logging, isolated provider sessions, and permission deny defaults

## Quick start

```bash
npm install
npm run dev
```

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

- `X Browser timeline mode` is explicitly experimental and may break if X changes login or anti-bot behavior.
- Linux window-manager behavior can still vary across Wayland/X11 setups and should be validated on real machines.
