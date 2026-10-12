---
name: electron-verify
description: Build and verify this Electron app — type-check, production build, and runtime checks in a visible app window the user can watch, with logs saved inside the project. Use whenever work needs verification beyond source inspection.
---

# Verification loop

All commands run from the repository root (in a team worktree, that worktree's root). Node and npm live
in `C:\Program Files\nodejs`; a shell started before Node was installed may need
`export PATH="/c/Program Files/nodejs:$PATH"`.

**This machine runs company endpoint security.** The user-level `C:\Users\EladCohen\.claude\CLAUDE.md`
("Company endpoint security: work transparently") takes priority over anything here. In short: keep every
process visible, keep scripts and logs inside the project, write plain commands, stop only what you
started, and never try to evade or bypass security software. If anything gets flagged, stop and tell the
user exactly what ran.

## 0. Confirm dependencies are current

`node_modules` must exist and be no older than `package-lock.json`
(`node_modules/.package-lock.json` is rewritten on every install). Otherwise run `npm ci` first.
Results from a stale install do not count as verification.

npm may warn that `esbuild`'s install script is not covered by `allowScripts`. That is expected: the
build uses esbuild's prebuilt platform package and works without the script. Do not approve scripts to
silence the warning.

Do not add or install a dependency that ships native binaries (`.exe`, `.dll`, `.node`) without the
user's explicit OK, naming the binaries it includes. Pseudo-terminal packages (`node-pty`, `winpty`,
ConPTY wrappers) also need IT approval first: `node-pty` triggered a quarantine on 2026-10-11.

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
CommonJS: the first line of `out/preload/index.js` is `"use strict";` and it calls
`require("electron")`. An `import` statement there means the module format changed and the sandboxed
preload will fail to load.

## 3. Tests

No test framework is chosen yet. Say so in the report; do not substitute ad-hoc scripts for tests.

## 4. Runtime checks

Run the app the way a developer would: in a **visible, titled console window**, with its output also
saved to a log file inside the project so you can read it afterwards.

```bash
# Built app: builds, then opens the app. The console window stays open and shows all output.
start "AOS verify - preview" powershell -NoExit -Command "$env:ELECTRON_ENABLE_LOGGING='1'; npm run preview 2>&1 | Tee-Object -FilePath .tmp-verify\preview.log"

# Dev app (Vite dev server; renderer at http://localhost:5173 or the next free port).
start "AOS verify - dev" powershell -NoExit -Command "$env:ELECTRON_ENABLE_LOGGING='1'; npm run dev 2>&1 | Tee-Object -FilePath .tmp-verify\dev.log"
```

Create `.tmp-verify\` first if it does not exist (it is git-ignored). Tell the user which window you
opened and what to look at.

**Gathering evidence:**

- **Logs:** read `.tmp-verify\*.log` for renderer `CONSOLE` lines, `Refused to ...` (CSP violations),
  and errors. GPU and crashpad noise is irrelevant. `ELECTRON_ENABLE_LOGGING` sends the renderer console
  to this output, so no debugging port is needed for it.
- **What the window shows:** ask the user to describe or screenshot what they see, or to open the
  renderer DevTools in the app window (`Ctrl+Shift+I`) and run a check you give them, such as
  `typeof require` and `typeof process` (both must be `"undefined"`: the renderer has no Node), or
  `window.api` (the preload API). If a desktop screenshot tool is available in the session, use it only
  with the user's approval.
- **DevTools protocol port:** not by default. If a check truly cannot be done another way, explain why
  and get the user's OK first, launch with the port in the same kind of visible window, keep the probe
  script in `.tmp-verify\`, and close that window as soon as the check is done.
- Do not use hidden or off-screen windows, base64 `data:` URLs on the command line, or scripts in
  `%TEMP%`. To render something for inspection, write the `.html` or `.svg` file into `.tmp-verify\` and
  open it there.

**Stopping:** close the console window you opened (closing it ends the app and the dev server), or ask
the user to. If a process must be ended from a command, end only the process ID you launched and
recorded, with `taskkill /PID <pid> /T`. Never kill processes by name or by path filter.

**Cleaning up:** delete what you created in `.tmp-verify\` once the evidence is in the report.

Every worktree's app shares one Electron `userData` folder (see `.claude/team/PROTOCOL.md`), so do not
rely on persisted state while another worktree's app is running.

## Reporting

State exactly what ran, what passed, what failed, and what remains unverified. Distinguish source-level
evidence from runtime evidence, say which evidence came from the user's own observation, and say "no
test framework yet" rather than implying test coverage. For each blocked objective, try at most one
fallback, then report the limitation instead of accumulating diagnostics.
