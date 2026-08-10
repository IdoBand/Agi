---
name: copy-knowledge
description: Replace backend/knowledge contents in one branch worktree with another's (knowledge is untracked, so worktrees go stale independently). Target contents are wiped first, then copied from source. Use when the user invokes /copy-knowledge <source-worktree> <target-worktree> or asks to copy/sync/overwrite knowledge between worktrees or branches.
---

Args: `<source-worktree> <target-worktree>` — worktree names under `\agi__worktree\` (e.g. `master avatar-options`), or absolute paths.

1. Resolve both args to absolute worktree paths. If an arg is not an absolute path, prefix `\agi__worktree\`. If either arg is missing, ask for it.
2. Verify `<source>\backend\knowledge` exists and is non-empty. If not, say so and stop. Refuse if source == target.
3. Show the user what is about to be destroyed: list `<target>\backend\knowledge` file count (and any top-level entries absent from source). Confirm before proceeding — this is a destructive overwrite of untracked, unrecoverable files.
4. Wipe the target dir, then recreate it:
   `Remove-Item -Recurse -Force "<target>\backend\knowledge" -ErrorAction SilentlyContinue`
   `New-Item -ItemType Directory -Force "<target>\backend\knowledge"`
5. Copy source contents in:
   `Copy-Item -Path "<source>\backend\knowledge\*" -Destination "<target>\backend\knowledge" -Recurse -Force`
6. Verify + report: file counts on both sides must match — `(Get-ChildItem -Recurse -File "<source>\backend\knowledge").Count` vs the same for target. Note which target-only files were deleted.

Notes:
- Target contents are untracked and git-ignored — deletion is permanent, no `git checkout` recovery.
- Wipe-then-copy (not merge) is the point: it kills stale files that exist only in the target.
