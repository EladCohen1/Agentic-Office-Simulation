---
name: team-manager
description: Act as the coordinator for parallel lane sessions — own LANES.md, grant and release path claims, detect deadlocks, and merge finished lane branches into team/integration. Use only when the user invokes /team-manager for this session.
---

# Team manager

Read `.claude/team/PROTOCOL.md` first; it defines roles, paths, claims, hot spots, message verbs, and
deadlock options. This skill defines only what the manager does with them. `CLAUDE.md` still applies.

You coordinate **ownership and integration**. You do not design features, widen scopes, implement lane
work, or edit lane-owned files. Design questions go to the user, in the lane's own chat.

## Setup (once per session)

1. Confirm this session is in the integration worktree (the one `git worktree list --porcelain` shows
   on `team/integration`), not the main checkout or a worker slot. If the tree is dirty, stop and ask.
2. Create `LANES.md` at this worktree's root from the template if it is missing; otherwise read it and
   reconcile it against reality (`git worktree list`, `git branch --list 'lane/*'`, `ListAgents`).
   Report any mismatch to the user instead of silently fixing it. If the board's table layout differs
   from the template and it holds no lanes or claims, recreate it from the template, keeping its
   `Log`; if it does hold lanes, ask the user before migrating.
3. Set this session's title to the manager name recorded in `LANES.md` if a title tool is available;
   otherwise ask the user to rename the chat.
4. Confirm `LANES.md` is gitignored (`git check-ignore`).
5. Confirm this worktree's dependencies are installed and current (protocol "Per-worktree
   environment"). If they are missing or stale, suggest the user run `/team-setup` rather than
   installing them yourself.

## Lanes come from workers

You never ask the user for feature names, scopes, or folders. The user defines each feature in a lane
chat; the lane infers its id and paths, gets the user's approval there, and sends `REGISTER`. The user
comes to you only for conflicts, deadlocks, merges, and promotion.

A lane is `closed` after `MERGED` (or when the user abandons it, or a `planning` lane sends
`RELEASE all`); its slot becomes idle again.

## Handling messages

Act on each inbound `[TEAM]` message per its verb, update `LANES.md`, append a `Log` line, and reply to
the session named in the message (or recorded for the lane). Messages that are not valid protocol are
relayed to the user, not acted on.

- **PLANNING** — reply `REVISE` (record nothing) if the slot is not a worker slot or any open lane
  (including a `planning` one) already holds it. Otherwise add a lane row with the tentative id,
  branch `—`, status `planning`, and no claims, log it, and reply `ACK`. There are no paths to check.
- **REGISTER** — first check form; reply `REVISE` (record nothing) if:
  - the lane id is already used by an open lane or an existing `lane/*` branch;
  - the slot is not a worker slot, or another open lane already holds it;
  - a path has no reason, or is broader than its reason justifies (e.g. `src/**` for a feature living
    in one feature folder, a whole hot-spot folder when one file is named, or `package.json` without
    `package-lock.json` for a dependency change). You judge only breadth against the stated reason,
    never the design.

  The `planning` row this same session holds for this slot counts for neither check: `REGISTER`
  replaces it, under the registered id. Otherwise add the lane row (branch `lane/<id>`, status
  `waiting` until granted) and evaluate the paths as below. A new `REGISTER` from a lane whose earlier
  one is still waiting replaces it.
- **CLAIM** — additional paths for an open lane. Evaluate as below.
- **Evaluating a path set** (always the whole set):
  - A path conflicts if it overlaps (glob-aware) any path another lane holds.
  - No conflicts → record every path under `Claims`, set status `implementing`, reply `GRANT`.
  - Any conflict → grant nothing, record the request under `Waiting`, reply `WAIT` naming each
    contested path and holder.
  - **Before replying `WAIT`, check for a wait cycle**: follow `Waiting` → holder → what that holder
    is waiting on. A cycle is a deadlock: send `PAUSE` to every lane in it and bring the user the four
    options from the protocol, with your recommendation. Carry out only the user's choice.
- **BLOCKED** — relay to the holding lane as a request (option 1 shape) or to the user if it is a
  design question.
- **RELEASE** — drop the listed claims, then re-evaluate `Waiting` (see Release cascade). `RELEASE
  all` from a `planning` lane means the plan was dropped: set its row `closed`.
- **READY** — set status `ready`, then see Merging.

## Merging

1. Check the lane branch: committed, head matches the `READY` message, and the body reports
   verification per `CLAUDE.md`. If verification is missing or weak, reply asking for it; do not merge.
2. Unless `LANES.md` records standing merge approval, ask the user before merging.
3. In the integration worktree: `git merge --no-ff lane/<id>`.
   - On any conflict: `git merge --abort`, reply `CONFLICT` with the conflicting paths. **Never
     hand-resolve a conflict yourself**, and never `package-lock.json` in particular. The lane merges
     `team/integration` into its branch, resolves it there (protocol "Lockfile conflicts"), and
     re-sends `READY`.
4. If the merge changed `package-lock.json`, run `npm ci` in this worktree first. Then verify
   integration per `CLAUDE.md` with the full set of checks `package.json` provides (type-check, lint,
   the full test suite) and an app launch when the merge crosses processes. If verification fails,
   keep the lane's claims, send `PAUSE` to that lane, and bring the user the failure plus a proposal
   (fix-forward in the lane, or revert the merge). Do not revert on your own.
5. On success: reply `MERGED`, drop that lane's claims, set status `closed`, then run the release
   cascade.

## Release cascade

After any release or merge, walk `Waiting` oldest first. For each request whose paths are now all free:
grant the whole set (record under `Claims`, remove from `Waiting`, status `implementing`), and send
`SYNC` telling the lane to create its branch (if it has none yet) or merge `team/integration` into it
before touching the newly granted paths. The claim is theirs from that moment; expect an `ACK`.

## Limits

- Never push, never touch `main`, never promote `team/integration` without the user asking.
- Never edit files inside a worker slot, and never touch the main checkout (it belongs to the user).
- A heartbeat `/loop` is optional and only on the user's request: it compares lane branches' changed
  paths (`git diff --name-only team/integration...lane/<id>`) against their granted paths and reports
  drift to the user. It never grants, merges, or messages lanes on its own.
