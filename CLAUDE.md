# Agentic Office Simulation — Operating Instructions

Electron desktop app, TypeScript, React. Treat the repository's current code, configuration, and
`package.json` as the project state; never rely on an assumed template baseline or a remembered
inventory of features, windows, or tests.

## Repository layout

The git root is this folder (`C:\Projects\AgenticOfficeSimulation`), and it is the working directory.

## Stack baseline

- Electron is a dev dependency (see `package.json` for the exact version). The app runs as separate
  **main**, **preload**, and **renderer** processes.
- TypeScript (strict) and React are the chosen stack for all source.
- Build tooling, test framework, and lint/format tooling are recorded here once they are chosen. Until
  then, do not assume one exists.

`package.json`, `package-lock.json`, `tsconfig*.json`, and the build configuration are the source of
truth if any of the above drifts. Read them rather than trusting this section.

## Runtime ownership boundaries

Classify a feature's process ownership before implementing it. These scopes are distinct:

- **`src/main/`** — application lifecycle, window creation, OS integration, IPC handlers, persistence,
  and app-wide services. The only process with Node and Electron main-process APIs, and the only one
  that touches the file system.
- **`src/preload/`** — the `contextBridge` API and nothing else. Thin, typed functions mapped onto IPC.
  Must **not** own domain logic or state.
- **`src/renderer/`** — React UI and view state. No Node and no Electron imports; it reaches the OS
  only through the preload API on `window`.
- **`src/shared/`** — plain TypeScript types and the IPC contract (`src/shared/ipc/`). Must not import
  Electron, Node, or React.

Do not put domain logic in preload because it is the security boundary, and do not give the renderer
Node access by relaxing `webPreferences`. Cross-process communication goes through the IPC contract,
never ad-hoc channel strings.

## Source location

All repository-owned source lives under `src/<process>/...`, organized by feature or domain inside each
process (`src/main/features/<FeatureName>/`, `src/renderer/features/<FeatureName>/`). Subdivide inside
a feature folder only when it has enough modules to justify it. Do not create parallel source trees
elsewhere. Test location is decided together with the test framework; record it here when it is.
Inspect the current tree when feature inventory matters.

## Reference documents

- **`docs/ELECTRON_CONVENTIONS.md`** is authoritative for architecture and code. Read only the sections
  relevant to the task. Its §1 hard conventions and §3 security defaults are the normal standard —
  depart only for a concrete reason, and say why; a security-default departure needs the user's
  explicit approval. Its §2 architectural preferences are judgment-guiding, not mechanical absolutes:
  a justified feature need can outweigh one.
- **`docs/design/`** holds feature specs (indexed in `docs/design/BACKLOG.md`). An `approved` spec is
  the feature's intent; read it when a task implements or depends on that feature. There is no overall
  product design document yet. The user is the final design authority. Do not invent constraints from
  a spec's silence. If a request materially conflicts with an approved spec, surface the conflict
  while planning. Specs inform feature intent and the convention guide informs code; keep the two
  distinct.

## Parallel team

`.claude/team/PROTOCOL.md` defines the parallel lane workflow (`/team-setup`, `/team-manager`,
`/team-worker`, `/team-design-worker`, `/team-clean`). It layers on top of this file and applies only
in sessions that run one of those skills.

## Tooling

- Use ordinary filesystem, search, and Git tools for source, Markdown, JSON, and repository inspection.
- Adding, removing, or upgrading a dependency is a plan item with a stated reason. Use `npm install`
  so `package-lock.json` stays in sync; never hand-edit the lockfile.
- The GitHub CLI (`gh`) is available and authenticated. Do not push, open PRs, or change repository
  settings unless the user asks.

## Verification

Source inspection alone does not verify runtime behavior. Verify in proportion to scope and credible
failure modes: type-checking plus the narrowest relevant tests for logic; launching the app and checking
both main-process output and the renderer console for process-integration work (IPC, preload API,
window lifecycle, security settings, persistence); the complete diff for text-only work. Stop when
acceptance criteria and identified risks have evidence, or when further checks would duplicate coverage.
While a check's tooling does not exist yet, say so instead of implying coverage.

For each blocked verification objective try at most one fallback, unless new evidence reveals a distinct
failure mode. **Report exactly what ran, passed, failed, and remains unverified.** Never declare
completion while a known implementation-caused type error, test failure, or blocking finding remains.

## Working method

Own requirements, scope, architecture, and the final report yourself. For anything beyond a trivial or
purely informational change, plan first: clarify purpose, behavior, acceptance criteria, process
ownership, data flow, the IPC surface, dependencies, and lifecycle and cleanup concerns; inspect only
the context needed to plan accurately; keep design questions separate from technical ones (convention
guide); and name real alternatives.

Call out unnecessary complexity, weak abstractions, coupling, premature optimization, inappropriate
inheritance, unclear ownership, ad-hoc globals, chatty or untyped IPC, missing subscription cleanup, and
security-boundary risk — recommend the simpler design when it achieves the same goal. Do not agree with
a design merely because the user proposed it, and do not add abstraction to look sophisticated.
Read-only inspection never needs approval.

**Use plan mode for feature-scale work.** Exiting plan mode with the user's approval is the
implementation gate — before that, do not edit implementation files or install dependencies. After it,
that approval covers the commands the plan reasonably needs (the installs it lists, builds, tests,
launching the app); do not stop to ask per command. If later findings materially change the approved
scope or architecture, return to the user with a revised plan before continuing.

## Delegation

Two independent judgments, not a fixed route table:

- **Recon** — dispatch one `electron-explorer` pass when a concrete unresolved question about files,
  symbols, process ownership, IPC wiring, or integration would otherwise make implementation guesswork.
  Resolve remaining uncertainty yourself or return to the user; do not re-run reconnaissance.
- **Review** — dispatch `electron-reviewer` whenever any material-risk signal is present: process
  ownership or boundary changes; preload API or IPC contract changes; security settings
  (`webPreferences`, CSP, navigation and window-open handling, `shell.openExternal`); lifecycle,
  startup/shutdown-order, or subscription-cleanup risk; persistence, schema, or migration changes;
  shared or app-wide state changes; public API or architectural-boundary changes; async, concurrency,
  hot-path, or destructive behavior; new or upgraded dependencies; broad diffs; weak verification
  evidence; or material deviation from the plan. Record every applicable signal in the handoff, attach
  every approved plan the diff builds on (including earlier ones in the same working tree), and ask for
  findings only unless a finding is expected to be disputed. Skip review only when no signal exists.

`electron-worker` handles implementation when the change is large enough to benefit from an isolated
context; implement directly when it is not. Give each subagent a self-contained handoff — it does not
inherit this conversation. Subagents do bounded work and must not redefine the feature.

Route legitimate blocking findings back to the same worker, which fixes those findings and their direct
consequences only; the reviewer then verifies only those fixes rather than starting a fresh review.
