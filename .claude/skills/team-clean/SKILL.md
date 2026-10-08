---
name: team-clean
description: Wipe a worker chat's conversation after its lane is merged, so the next feature starts with a fresh context in the same chat — after checking the slot is free and titling it Idle. Use only when the user invokes /team-clean in a worker slot.
---

# Team clean (reset a worker chat)

Read `.claude/team/PROTOCOL.md` for slots, `LANES.md`, and "Clean tree". This skill only resets a
finished worker chat. It does not end or release a lane: that happens through `MERGED` (see
`team-worker`).

## Checks — refuse on any failure

Run these in order. Nothing switches branches until checks 1–4 pass.

1. This session is in a worker slot (`...-team\worker-N`), not the main checkout or the integration
   worktree. Take `N` from the slot folder.
2. No open lane names this slot. If any `LANES.md` row whose Status is not `closed` names this slot,
   stop: tell the user the lane is still open and that clearing would discard its context. This comes
   before looking at HEAD, because a `waiting` lane is open while still on a detached HEAD (it creates
   its branch only once granted).
3. The tree is clean per the protocol "Clean tree" (judged by content, not `git status`). If it isn't,
   list what's dirty and stop.
4. HEAD is in a free state:
   - Detached HEAD → free.
   - `lane/<id>` with no open row in `LANES.md` (the lane was merged but the slot was never freed)
     → free.
   - Anything else (another branch) → stop and ask.
5. Refresh the slot: `git switch --detach team/integration`, in every free case, so the next
   `/team-worker` plans against the current integration head and loads the current team rules.
   If that changed `package-lock.json`, run `npm ci` in this slot's folder.

## Reset

1. Set the title to `Idle worker-N` using the session-title tool, or ask the user to rename the chat.
   If this chat ran a design lane, use `Idle design worker-N` instead: that is when the lane this
   chat just finished has a `design-` id, judged from the current title (`Lane design-…`, or already
   `Idle design worker-N`) or, failing that, the most recent `closed` row in `LANES.md` naming this
   slot. Read `LANES.md` only; never write it. Decide this before the clear — nothing from this
   conversation carries over.
2. Tell the user in one line that the slot is idle and that the next feature starts with
   `/team-worker <feature>` (`/team-design-worker <feature>` for a design chat). Say this before the
   clear: nothing from this conversation carries over.
3. Clear this chat with the session-clear tool (`session_id: "self"`). The clear runs after this turn
   ends, so end the turn right after calling it. If no clear tool is available, tell the user to type
   `/clear`.
