---
name: electron-verify
description: Build and verify this Electron app — type-check, production build, and launching the built or dev app with renderer logging and a DevTools port to inspect the live renderer. Use whenever work needs verification beyond source inspection.
---

# Verification loop

All commands run from the repository root (in a team worktree, that worktree's root). Node and npm live
in `C:\Program Files\nodejs`; a shell started before Node was installed may need
`export PATH="/c/Program Files/nodejs:$PATH"`.

## 0. Confirm dependencies are current

`node_modules` must exist and be no older than `package-lock.json`
(`node_modules/.package-lock.json` is rewritten on every install). Otherwise run `npm ci` first.
Results from a stale install do not count as verification.

npm may warn that `esbuild`'s install script is not covered by `allowScripts`. That is expected: the
build uses esbuild's prebuilt platform package and works without the script. Do not approve scripts to
silence the warning.

## 1. Type-check

```bash
npm run typecheck
```

Runs `tsc --noEmit` on `tsconfig.node.json` (main, preload, shared, `electron.vite.config.ts`) and
`tsconfig.web.json` (renderer, shared). Vite does not type-check, so a passing build proves nothing
about types. A type error your change caused is never an acceptable stopping point.

The type-check does not enforce every process boundary: the preload sees all Node types although a
sandboxed preload can only `require` a small subset (`electron`, `events`, `timers`, `url`), and a
renderer file importing `electron` pulls in Node types. Check those by reading the diff until lint
rules enforce them.

## 2. Build

```bash
npm run build
```

Produces `out/main/index.js`, `out/preload/index.js`, and `out/renderer/`. The preload must stay
CommonJS: `head -c 200 out/preload/index.js` starts with `"use strict"` and `require("electron")`. An
`import` statement there means the module format changed and the sandboxed preload will fail to load.

## 3. Tests

No test framework is chosen yet. Say so in the report; do not substitute ad-hoc scripts for tests.

## 4. Runtime checks

Launch with Chromium logging (renderer console and CSP violations go to stderr) and a DevTools port,
then inspect the live page over the DevTools protocol.

```bash
# Built app. This runs whatever is in out/ without rebuilding (unlike `npm run preview`), so run
# `npm run build` first or you are verifying stale output.
ELECTRON_ENABLE_LOGGING=1 ./node_modules/electron/dist/electron.exe . --remote-debugging-port=9223 > <scratchpad>/run.log 2>&1 &

# Dev app (Vite dev server; renderer at http://localhost:5173 or the next free port)
ELECTRON_ENABLE_LOGGING=1 npx electron-vite dev --remoteDebuggingPort 9224 > <scratchpad>/dev.log 2>&1 &
```

- `curl -s http://127.0.0.1:<port>/json/list` lists the open pages with their `title` and `url`.
- To evaluate in the page, connect to the page's `webSocketDebuggerUrl` and send `Runtime.evaluate`
  (Node 24 has a global `WebSocket`; keep the probe script in the scratchpad, not the repo). Useful
  checks: the rendered DOM (`document.querySelector(...)`), `typeof require` and `typeof process`
  (both must be `"undefined"`: the renderer has no Node), and `window.api` (the preload API).
- Read the log for `CONSOLE` lines, `Refused to ...` (CSP violations), and errors. GPU and crashpad
  noise is irrelevant.
- **Always stop what you started**, and only that: Electron processes whose executable is under this
  worktree's `node_modules`, and `node` processes running `electron-vite`. Never stop other Electron
  apps on the machine.

Every worktree's app shares one Electron `userData` folder (see `.claude/team/PROTOCOL.md`), so do not
rely on persisted state while another worktree's app is running.

## Reporting

State exactly what ran, what passed, what failed, and what remains unverified. Distinguish source-level
evidence from runtime evidence, and say "no test framework yet" rather than implying test coverage. For
each blocked objective, try at most one fallback, then report the limitation instead of accumulating
diagnostics.
