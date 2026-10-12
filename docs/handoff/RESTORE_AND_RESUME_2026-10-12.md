# Handoff: restore after the antivirus purge, then resume slice 1

Written 2026-10-12 for a new agent picking this project up on the user's **personal machine**. Read the
whole brief before acting, then `CLAUDE.md` and `docs/ELECTRON_CONVENTIONS.md`. The user is the design
authority; confirm the open decision in §5 with them before writing code.

## 1. What happened

On 2026-10-11, on the user's **work machine**, the previous session was starting slice 1 (below) and ran a
one-off test: an unsigned script in `%TEMP%` launched Electron, loaded the native `node-pty` package, and
spawned a hidden console running `cmd.exe /c echo pty-ok && claude --version`. The test succeeded, and then
the company endpoint security reacted:

- it quarantined the Claude desktop app and `node-pty`'s binaries (some were later restored);
- it deleted most of `node_modules/node-pty`, `@xterm/xterm`, `@xterm/addon-fit` and `node-addon-api`,
  the test script, and the session's plan file.

The user now does repair and continued development on their personal machine.

## 2. What is safe, and where it lives

| Thing | Where | State |
|---|---|---|
| This project | GitHub `EladCohen1/Agentic-Office-Simulation`, branch `main` | **Intact.** Every tracked file was verified against GitHub after the purge. Head at the time of writing: `4835732` (plus this brief). |
| Presets repo | GitHub `EladCohen1/Agentic-Pipeline-Presets` | Intact (`5514a97`). Not needed for this work. |
| Art assets | `src/renderer/features/GuildHall/assets/` in this repo | Intact. These split SVGs are now the source of truth. The exploration drafts lived only in the work machine's `%TEMP%\aos-themes\` and are not needed. |

Nothing that was ever committed was lost. **A fresh clone on the personal machine has none of the damage.**

## 3. What was lost, and what to do about it

| Lost | Matters? | Action |
|---|---|---|
| Uncommitted work-machine edits to `package.json` / `package-lock.json` adding `node-pty@1.1.0`, `@xterm/xterm@6.0.0`, `@xterm/addon-fit@0.11.0` | Only if slice 1 keeps the in-app terminal (§5) | Never pushed, so a fresh clone doesn't have them. Re-add them **only after** the §5 decision. |
| Damaged `node_modules` on the work machine | Only on the work machine | Not reproduced by a fresh clone. On the work machine, later: discard the uncommitted `package.json`/`package-lock.json` edits and run `npm ci`. That is the user's call, at a time of their choosing. |
| The slice-1 plan file | Yes | Reproduced in full in §6. |
| The `node-pty` test script | No | Not needed. It was only a load test. |
| Work machine's user-level `~\.claude\CLAUDE.md` | Work machine only | It holds "work transparently" rules for the company antivirus. Not needed on the personal machine, but the same habits are good practice anywhere: see §4. |

## 4. Set up the personal machine

1. Install Node.js (LTS; the project used Node 24), git, the GitHub CLI (`gh auth login`), and the Claude
   Code CLI.
2. Sign the CLI in with the user's **Claude subscription** (`claude auth login`, then `claude auth status`
   must show `"authMethod": "claude.ai"`). The design depends on subscription billing (§5); do not switch
   to an API key.
3. Clone and install:
   ```
   git clone https://github.com/EladCohen1/Agentic-Office-Simulation.git
   cd Agentic-Office-Simulation
   npm ci
   ```
4. Paths in `CLAUDE.md`, `.claude/team/PROTOCOL.md` and the `team-setup` skill assume
   `C:\Projects\Agentic-Office-Simulation` (team worktrees in `C:\Projects\Agentic-Office-Simulation-team`).
   If the personal machine uses another location, tell the user and update those paths in one small commit.
5. Verify the baseline (load the `electron-verify` skill): `npm run typecheck`, `npm run build`, then run the
   app in a visible window and have the user confirm the guild hall renders with the characters wandering.
   This is the last committed feature.
6. The `electron-verify` skill was rewritten for transparency (visible windows, logs in `.tmp-verify/`, no
   debugging ports by default, stop only processes you started). Follow it as written; it is good practice
   on any machine.

## 5. Open decision before slice 1: how agents' terminals are hosted

Slice 1 was approved with **`node-pty` + `xterm.js`**: the app hosts each agent's real `claude` CLI in an
in-app terminal panel. That is exactly what the work machine's antivirus flagged. If the user will ever
run the app on the work machine, that design will trigger it again. **Ask the user** which way to go:

- **A. Keep `node-pty`** (as approved), for use on the personal machine, and only on the work machine after
  IT approves it. Restore the three dependencies.
- **B. Visible external terminals (no native module).** For each agent, the app opens a titled, visible
  terminal window (`start "<agent name>" cmd /k claude --session-id <uuid> --name "<name>"`) and records
  its process ID. The hall and its markers are still driven by hooks; clicking a character brings that
  agent's window forward, or reopens it with `claude --resume <id>`. No hidden consoles, no new native
  dependency. The trade-off: chat happens in a separate window, not a panel inside the app.

Recommend asking explicitly; B is the safer default if work-machine use matters. Everything else in the
plan below holds for either option; the differences are noted inline.

Facts already established (do not re-litigate unless the user asks):

- **Engine:** the real Claude Code CLI, not the Agent SDK. The Agent SDK may not use claude.ai login
  without Anthropic's approval, and the user requires subscription billing.
- **Fallback to the Claude desktop app** is a requirement: sessions stay ordinary Claude Code sessions in
  `~/.claude/projects/`, so Desktop's `/resume` can continue them, and the app can resume them back.
- **Hooks** go per project in `<project>\.claude\settings.local.json` (git-ignored), installed and removed
  by the app's "Connect project" flow, documented in `docs/CONNECTING_A_PROJECT.md`.
- **Test project:** a throwaway git repo at `C:\Projects\AOS-Test-Project` (or the personal machine's
  equivalent). Never test against this repo or a real project.
- Before the purge, the `node-pty` load test inside Electron 44 succeeded, and `claude` was found on PATH
  (CLI version 2.1.263). **Unfinished check:** confirm the installed CLI supports `--session-id`, `--name`
  and `--resume` (`claude --help`); update the CLI (`claude update`) if it does not.

## 6. The slice-1 plan (approved 2026-10-11; recovered text)

> Re-confirm with the user before implementing, because §5 changes the terminal hosting. Use plan mode as
> `CLAUDE.md` requires; this text is the starting point for that plan.

**Goal.** Connect a project; create agents that are real Claude Code sessions; chat with each; see each
character's state in the hall (working / idle / needs permission / has a question); hand a session off to
Desktop and back. Out of scope: the quest board, worker worktrees/lanes, the Parallel Agents adapter,
answering permissions or questions from the game UI instead of the terminal, packaging.

**Verified CLI and hook facts.** `claude --session-id <uuid>` starts a session with an app-chosen ID;
`--resume <id>` resumes; `--name` sets the name shown in `/resume` (CLI and Desktop). Desktop's `/resume`
lists CLI sessions on the machine and continues the same session. Hook events include `SessionStart`,
`UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PermissionRequest`, `Notification` (types include
`permission_prompt`, `idle_prompt`), `Stop`, `SubagentStart`, `SubagentStop`, `SessionEnd`; every event
carries `session_id`, `cwd`, `hook_event_name`, `permission_mode`; tool events carry `tool_name` and
`tool_input`. Command hooks support `"async": true`. HTTP hooks exist but show an error notice in the
session when the endpoint is down, which is unwanted when the user falls back to Desktop, so use a silent
async command hook.

**Main process (`src/main/features/…`)**

- **HookBridge:** an HTTP server bound to `127.0.0.1` on a random port, requiring a random token header;
  JSON only, size-capped, validated. On startup it writes `hook-endpoint.json` (`port`, `token`) and the
  forwarder script `forward-hook.cjs` into the app's `userData/hooks/`. The forwarder reads the event
  from stdin, reads the endpoint file, POSTs with a 1 s timeout, and always exits 0 silently.
- **ProjectConnections:** `connect(folder)` shows the user a preview of the exact hook entries; on
  confirm, merges them into `<project>/.claude/settings.local.json` (keeping existing content; entries
  identified by the forwarder command so they can be removed exactly); ensures the file is git-ignored
  (`git check-ignore`, else append to `.git/info/exclude`, never `.gitignore`); checks `node` is on PATH
  (the hook command is `node "<userData>/hooks/forward-hook.cjs"` with `async: true`). `disconnect` removes
  exactly those entries. Connected projects persist in `userData/projects.json` (atomic writes, validated
  on load).
- **AgentSessions:** per agent, a `claude` process in the project folder with
  `--session-id <uuid> --name "<Character> · <project>"` (new) or `--resume <id>`. Option A: inside a
  `node-pty` pseudo-terminal, output batched to the renderer. Option B: in a visible titled console window,
  PID recorded. Agents persist in `userData/agents.json` (id, project, character, session id, name) and
  start as offline after an app restart. **Hand off:** send `/exit` (A) or ask the user to close the window
  (B), then the session is resumable anywhere.
- **AgentStateStore:** reduces hook events (matched by `session_id`) into
  `offline | idle | working(activity) | needs-permission | has-question` plus an active subagent count.
  Activity from `tool_name`: Edit/Write/NotebookEdit → editing; Read/Grep/Glob → reading;
  WebSearch/WebFetch → researching; Bash → running; Agent/Task → delegating. `PreToolUse` of
  `AskUserQuestion` → has-question until its `PostToolUse`; `PermissionRequest` /
  `Notification(permission_prompt)` → needs-permission until the next tool or prompt event; `Stop` → idle;
  process exit → offline.

**IPC (`src/shared/ipc/`) and preload.** Typed channels, inputs validated in main:
`projects.list / previewConnect / connect / disconnect` (folder picked via a main-process dialog),
`agents.list / create / resume / handOff / remove`, plus `terminal.write / resize` and the events
`terminal.data / terminal.exit` (option A only); event `agents.changed`. Preload exposes purpose-specific
functions on `window.api`; listeners return unsubscribe functions.

**Renderer.** A React overlay: project picker, "Connect project…" (with the hook preview), "New agent", and
a roster (character, state, resume / hand off). Option A: a terminal drawer (`@xterm/xterm` + fit addon)
opens when you click a character. Option B: clicking a character focuses or reopens its window. The scene
replaces `wander-behavior.ts` with target-driven movement reusing the navigation grid and path following.
Each agent gets one of the nine characters and its own desk (max six agents). Stations: editing/running →
own desk; reading → archive; researching → map room; delegating → war table; idle → hearth lounge;
offline → walks out of the entrance. A light bulb (question) or "!" (permission) floats above the head.

**Docs.** `docs/CONNECTING_A_PROJECT.md`: what connecting writes, how to install or remove it by hand or by
an agent, how to continue sessions in Desktop (`/resume`) or the terminal (`claude --resume <id>`).

**Verification.** Type-check and build; connect the test project and confirm `settings.local.json` and the
git-ignore; create an agent; send a cheap prompt ("Reply with the single word: ready") and see it go
working → idle; ask it to run `git status` and see "!" until approved; ask it to use AskUserQuestion and
see the light bulb until answered; check the forwarder exits silently and fast with the app closed; hand off,
continue with `claude --resume <id> -p "What word did you reply with?"`, resume in the app again; the user
checks the Desktop `/resume` round trip; disconnect removes the hook entries exactly. Dispatch
`electron-reviewer` (IPC contract, preload API, local listener, process lifecycle, persistence, broad
diff). Commit; push on the user's OK.

## 7. Where things stood

- Last commits on `main`: `80206e9` (guild hall scene with wandering characters), `4835732` (verification
  made visible and endpoint-security friendly), then this brief.
- Slice 1 had not started: no source code for it was written.
- Next step: §4 setup and baseline check, then the §5 decision with the user, then plan mode for slice 1
  from §6.
