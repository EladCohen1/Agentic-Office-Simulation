"""Report the state of the team worktrees and their installed dependencies.

Usage:
    python team_status.py            # print status once

Read-only: never changes branches, files, or dependencies.
"""
import json
import os
import subprocess

INTEGRATION_BRANCH = "refs/heads/team/integration"


def run(cmd, cwd=None):
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace")


def norm(path):
    return os.path.normcase(os.path.normpath(path))


def worktrees():
    out = run(["git", "worktree", "list", "--porcelain"]).stdout
    items, cur = [], {}
    for line in out.splitlines() + [""]:
        if not line:
            if cur:
                items.append(cur)
            cur = {}
        elif line.startswith("worktree "):
            cur["path"] = os.path.normpath(line[len("worktree "):])
        elif line.startswith("HEAD "):
            cur["head"] = line[5:12]
        elif line.startswith("branch "):
            cur["branch"] = line[len("branch "):]
        elif line == "detached":
            cur["branch"] = None
    main = items[0] if items else None
    integration = next((w for w in items if w.get("branch") == INTEGRATION_BRANCH), None)
    team_root = os.path.dirname(integration["path"]) if integration else None
    slots = []
    if team_root:
        slots = sorted(
            (w for w in items if norm(os.path.dirname(w["path"])) == norm(team_root)
             and os.path.basename(w["path"]).startswith("worker-")),
            key=lambda w: w["path"],
        )
    return main, integration, slots, team_root


def content_clean(path):
    if run(["git", "-C", path, "diff", "--quiet", "HEAD"]).returncode != 0:
        return False
    untracked = run(["git", "-C", path, "ls-files", "--others", "--exclude-standard"]).stdout.strip()
    return not untracked


def deps_state(path):
    """installed | stale | missing | none (no lockfile).

    npm writes node_modules/.package-lock.json on every install, so a lockfile newer than it means
    the worktree's dependencies predate its current lockfile.
    """
    lockfile = os.path.join(path, "package-lock.json")
    installed = os.path.join(path, "node_modules", ".package-lock.json")
    if not os.path.exists(lockfile):
        return "none"
    if not os.path.exists(installed):
        return "missing"
    return "stale" if os.path.getmtime(lockfile) > os.path.getmtime(installed) else "installed"


def open_lane_slots(integration):
    """Map slot name -> lane id for lanes in LANES.md whose status is not closed."""
    if not integration:
        return {}
    board = os.path.join(integration["path"], "LANES.md")
    if not os.path.exists(board):
        return {}
    lines = open(board, encoding="utf-8").read().splitlines()
    result, header, in_lanes = {}, None, False
    for line in lines:
        if line.startswith("## "):
            in_lanes = line.strip() == "## Lanes"
            header = None
            continue
        if not in_lanes or not line.startswith("|") or set(line) <= set("|- "):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if header is None:
            header = [c.lower() for c in cells]
            continue
        row = dict(zip(header, cells))
        if row.get("slot") and row.get("status", "").lower() != "closed":
            result[row["slot"]] = row.get("lane", "?")
    return result


def describe(w, role, lanes):
    branch = w.get("branch")
    name = os.path.basename(w["path"])
    return {
        "role": role,
        "name": name,
        "path": w["path"],
        "head": w.get("head"),
        "branch": branch.replace("refs/heads/", "") if branch else "(detached)",
        "content_clean": content_clean(w["path"]) if role != "main" else None,
        "open_lane": lanes.get(name) if role == "slot" else None,
        "deps": deps_state(w["path"]) if role != "main" else None,
    }


def status():
    main, integration, slots, team_root = worktrees()
    lanes = open_lane_slots(integration)
    integration_head = run(["git", "rev-parse", "--short=7", "team/integration"]).stdout.strip() or None
    rows = []
    if main:
        rows.append(describe(main, "main", lanes))
    if integration:
        rows.append(describe(integration, "integration", lanes))
    rows += [describe(s, "slot", lanes) for s in slots]
    for r in rows:
        r["behind_integration"] = (
            r["role"] == "slot" and r["branch"] == "(detached)" and r["head"] != integration_head
        )
    return {"team_root": team_root, "integration_head": integration_head, "worktrees": rows}


def print_status(s):
    print(f"team root: {s['team_root']}   team/integration: {s['integration_head']}")
    print(f"{'role':12} {'name':34} {'head':8} {'branch':22} {'clean':6} {'lane':14} {'deps':10}")
    for r in s["worktrees"]:
        clean = "-" if r["content_clean"] is None else ("yes" if r["content_clean"] else "NO")
        branch = r["branch"] + (" (behind)" if r["behind_integration"] else "")
        print(f"{r['role']:12} {r['name']:34} {r['head'] or '-':8} {branch:22} {clean:6} "
              f"{r['open_lane'] or '-':14} {r['deps'] or '-':10}")
    print(json.dumps(s))


if __name__ == "__main__":
    print_status(status())
