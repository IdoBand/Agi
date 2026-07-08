---
name: copy-knowledge
description: Copy backend/knowledge contents from one branch worktree to another (knowledge is untracked, so fresh worktrees miss it). Use when the user invokes /copy-knowledge <source-worktree> <target-worktree> or asks to copy/sync knowledge between worktrees.
---

Args: `<source-worktree> <target-worktree>` — worktree names under `\agi__worktree\` (e.g. `master avatar-options`), or absolute paths.

1. Resolve both args to absolute worktree paths. If an arg is not an absolute path, prefix `\agi__worktree\`. If either arg is missing, ask for it.
2. Verify `<source>\backend\knowledge` exists and is non-empty. If not, say so and stop.
3. Copy contents as-is, overwriting whatever exists in target:
   `Copy-Item -Path "<source>\backend\knowledge\*" -Destination "<target>\backend\knowledge" -Recurse -Force`
   (Create `<target>\backend\knowledge` first via `New-Item -ItemType Directory -Force` if missing.)
4. Report file count copied, e.g. `(Get-ChildItem -Recurse -File "<target>\backend\knowledge").Count`.
