---
name: match-questions
description: Propagate a refined citizenship question from a user-named source (benchmark) JSON file to its sibling JSON files in the same dir, matched by question `id`. Use when the user invokes /match-questions or asks to sync/propagate a refined question across the citizenship JSON files.
---

1. Parse args: 1 source path (the file the user edited = benchmark) + 1+ question IDs. If source path or IDs missing, ask.
2. Load source file. For each ID, find its object (`id` match). If absent in source → report error, skip that ID (can't benchmark it).
3. Targets = every other `*.json` in the source file's directory.
4. For each target × each ID: find the object with that `id`.
   - Not found → skip, note "no match in <file>".
   - Found → compare each field (`question`, `answer`, `englishTranslation`, `category`) to source. For every differing field, `Edit` the target so it equals source. Make `old_string` unique (include the `id` or `question` line as context if the value alone isn't unique). Preserve the target's existing indentation/quoting (2-space vs 4-space differs across files) — patch only the changed value(s).
   - All fields equal → note "already in sync".
5. Report a concise table: per ID, which files updated (+ which fields), which skipped (no match), which already synced.

Notes:
- Never reformat/reorder a target file; only the changed object's field values move.
- `answer` is the usual (often only) diff, but sync any field that differs.
- These JSON files are git-ignored — diffs won't show in `git status`; verify by re-reading the patched object.
