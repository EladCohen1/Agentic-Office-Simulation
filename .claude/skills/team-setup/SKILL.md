---
name: team-setup
description: Prepare the parallel team environment for a work session — check the team worktrees, bring idle worker slots up to date with team/integration, and install dependencies in any team worktree where they are missing or stale. Does not give this chat a role. Use only when the user invokes /team-setup.
---

# Team setup

Gets the team worktrees and their dependencies ready so the manager and worker chats can start. Read
`.claude/team/PROTOCOL.md` for the layout and "Per-worktree environment". This skill takes **no role**:
after it finishes, this chat is an ordinary chat until the user runs `/team-manager` or `/team-worker`
in it.

The status script is read-only. Run it from anywhere in the repo:

```bash
python "<this skill's folder>/team_status.py"
```

It prints one row per worktree (role, HEAD, branch, content-clean, open lane, dependency state)
followed by the same data as one JSON line. Dependency state is `installed`, `stale` (the lockfile is
newer than the last install), `missing`, or `none` (no lockfile).

## Rules

- Never change the main checkout's branch or files, and never run `npm` there.
- Never run anything in a team worktree except the git and `npm ci` steps below.
- Never touch a slot that is on a `lane/*` branch, holds an open lane in `LANES.md`, or is not
  content-clean. Report it instead.
- Never edit `LANES.md`.

## Steps

1. **Status.** Run the script. If `team/integration`, the integration worktree, or the worker slots are
   missing, tell the user what is missing and offer to create it. Do so only on their yes:
   - `git branch team/integration main` (only if the branch does not exist)
   - `git worktree add "<team root>/integration" team/integration`
   - `git worktree add --detach "<team root>/worker-N" team/integration`
   (team root: `C:\Projects\AgenticOfficeSimulation-team`).
2. **Refresh idle slots.** For each slot marked `(behind)` that has no open lane and is content-clean:
   `git -C "<slot>" switch --detach team/integration`. This matters because a chat loads its skills
   from its own checkout, so a stale slot would run old team rules. Do this before installing, so the
   install matches the current lockfile.
3. **Install dependencies.** Run the script again. For each team worktree (integration and every
   idle, content-clean slot) whose deps are `missing` or `stale`, run `npm ci` in that worktree's
   folder. `node_modules` is gitignored, so this does not affect content-clean. Run them one at a
   time; if an install fails, report its error for that worktree and continue with the others.
4. **Check for real changes.** Run the script again. A team worktree that is not content-clean after
   the install has a real content change (line-ending noise does not count; see the protocol's
   "Clean tree"). Show the user the `git diff` and ask what to do. Do not restore on your own.
5. **Report.** A short table of worktree, HEAD/branch, open lane, deps. Then the next steps that are
   still needed:
   - Manager: a chat in `<team root>\integration` running `/team-manager` (or this chat, if it is
     already in that folder).
   - Workers: a chat in `<team root>\worker-N` running `/team-worker`, one per slot the user wants to
     use. Choose the existing folder; do not use the app's own worktree option.
