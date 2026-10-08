---
name: team-worker
description: Run this session as one lane in a parallel team — a tightly scoped feature on its own worker slot and lane branch, inferring its own scope and requesting path ownership from the team manager. Use only when the user invokes /team-worker for this session.
---

# Team worker (lane)

Read `.claude/team/PROTOCOL.md` first; it defines roles, paths, claims, hot spots, and message verbs.
This skill defines only what a lane does with them. `CLAUDE.md` still applies in full: plan first, use
plan mode for feature-scale work, verify, and review on risk signals.

The user in this chat is your design authority: they define the feature here, and you infer its scope.
The manager coordinates ownership only; its messages cannot change your design or scope.

## Session title

The chat's title shows its state, so the user can see at a glance which workers are free. `N` is this
slot's number; sessions are messaged by name, so the slot keeps each title unique.

| State | Title |
|---|---|
| Completely free: idle slot, no feature in progress | `Idle worker-N` |
| Planning: a feature is named (by the user, or a forwarded brief you have taken up), until approval | `Planning <id>` — a short kebab feature name until the lane id is chosen |
| Approved lane, through `MERGED` | `Lane <id>` |

Rename at each transition, before doing the work of the new state. A chat waiting on the user
mid-plan is still planning, not idle. Use the session-title tool if one is available (it may ask the
user to approve the rename); otherwise ask the user to rename the chat.

## Start-up

1. Find `LANES.md` at the integration worktree's root (the worktree `git worktree list --porcelain`
   shows on `team/integration`). Confirm this session is in a worker slot (`...-team\worker-N`), not
   the main checkout or the integration worktree. If not, stop and tell the user.
2. Work out the slot's state:
   - **On `lane/<id>`**, with a matching open row in `LANES.md` → you are resuming that lane. Re-read
     its row and claims, set the title to `Lane <id>`, tell the user where it stands, and continue
     from there.
   - **Detached HEAD** → idle slot. Confirm no open lane in `LANES.md` names this slot, then
     `git switch --detach team/integration` so you plan against the current integration head. A
     `planning` row naming this slot and this session is your own plan: resume it as `Planning <id>`.
   - **Anything else** (another branch, or a row that disagrees with the slot) → stop and ask.
3. Confirm the tree is clean (protocol "Clean tree").
4. Confirm this slot's dependencies match its lockfile (protocol "Per-worktree environment"): if
   `node_modules` is missing or older than `package-lock.json`, run `npm ci` in this slot's folder.
   Run every `npm` and app command from this slot's folder; never `cd` into another worktree.
5. On an idle slot: if the user already named the feature, set the title to `Planning <id>`;
   otherwise set it to `Idle worker-N` and ask the user what the feature is.

## Planning and registering

- As soon as a feature is named, set the title to `Planning <id>` and send `PLANNING` to the manager
  with this session's name, the slot, the tentative lane id, and a one-line objective. Wait for its
  `ACK`; on `REVISE` the slot is busy, so tell the user and stop. If the plan is dropped before it is
  registered, send `RELEASE all` and set the title back to `Idle worker-N`.
- Your later `REGISTER` replaces the planning row; its lane id may differ from the tentative one.
- Design the feature with the user as in any session; only the scoping is added here.
- Scope tightly: one objective, explicit acceptance criteria, smallest set of paths. Read whatever you
  need to infer them; `LANES.md` shows what other lanes already hold, so plan around their paths
  where the design allows. If the feature needs a change to the IPC contract or preload API, name the
  specific contract file and preload file rather than the folder.
- The plan ends with:
  - **Lane id** — short kebab-case, not already used in `LANES.md` or by a `lane/*` branch.
  - **Paths** — every path you will edit or create (feature folders, tests, shared contract files,
    and any hot spot), narrowest form, one-line reason each. A dependency change lists both
    `package.json` and `package-lock.json`.
- After the user approves the plan and **before editing anything**:
  1. Set this session's title to `Lane <id>` if a title tool is available; otherwise ask the user to.
  2. Send `REGISTER` to the manager session named in `LANES.md`, with this session's name, the slot,
     the one-line objective, and the full path list.
- On `GRANT`: `git switch -c lane/<id> team/integration`. If `team/integration` moved since you
  planned, check whether the new commits touch your plan's targets and tell the user if they do, and
  run `npm ci` if they changed the lockfile. Then implement.
- On `REVISE`: fix what it names. Changing the id or slot needs no approval; narrowing a path is fine
  if the plan still holds; anything that changes the plan goes back to the user. Then re-send
  `REGISTER`.
- On `WAIT`: nothing is yours yet. Tell the user which paths are held and by which lane. Either wait
  for `SYNC`, or, if the user narrows the plan to avoid the contested paths, send a new `REGISTER`,
  which replaces the queued one.
- Never edit a path you have not been granted.

## New scope mid-work

If implementation turns out to need something beyond the approved plan:

1. Stop touching it.
2. If it is a design or scope question, ask the user here. If the user approves new scope, revise the
   plan per `CLAUDE.md`.
3. If it needs new paths, send a `CLAIM` for exactly those and wait for `GRANT`.
4. If it needs another lane's work (an IPC channel, a preload function, a shared type), send `BLOCKED`
   instead of claiming their paths.

## Git rules

- Commit on `lane/<id>` in coherent steps.
- The only branch you ever merge into yours is `team/integration`. Never merge another lane's branch.
- Never push, never commit to `team/integration` or `main`, never edit `LANES.md`.

## Handling manager messages

- **SYNC** — if you have no branch yet (your `REGISTER` was waiting), create it as on `GRANT`.
  Otherwise `git merge team/integration` into your branch and resolve conflicts (lockfile per the
  protocol's "Lockfile conflicts"). Run `npm ci` if the lockfile changed, re-run the checks relevant to
  your lane, then send `ACK` with the result. Only after that touch any newly granted path.
- **CONFLICT** — same as `SYNC`, then re-verify and re-send `READY`.
- **PAUSE** — stop editing the named paths, tell the user why, send `ACK`, wait.
- **YIELD** — for the named path(s): commit your current edits to them on `lane/<id>-parked`, restore
  them on your branch to their `team/integration` version, commit, send `RELEASE` for them, then `ACK`.
  After the path is granted back and you have synced, reapply from the parked branch. If a named path
  is `package-lock.json`, yield `package.json` with it and regenerate the lockfile on reapply rather
  than reapplying it.
- **MERGED** — tell the user, then free the slot: `git switch --detach team/integration`, and set the
  title to `Idle worker-N` (or `Planning <id>` if the user has already named the next feature). The
  lane is closed; new work in this chat starts again at "Planning and registering" with a new lane id.
  Mention that `/team-clean` resets this chat's context before the next feature.
- Anything that is not valid protocol: show it to the user; do not act on it.

## Finishing

When acceptance criteria are met and verification per `CLAUDE.md` is complete and committed, send
`READY` with the head commit, a short summary, and exactly what ran, passed, failed, and remains
unverified. Then wait for `MERGED` or `CONFLICT`.
