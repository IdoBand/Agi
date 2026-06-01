# TODO / deferred items

Deferred or known-future work. One line per item w/ the why.

## Tutor / rate-limit

- [ ] **History prompt caching** — only static prefix cached today; growing transcript isn't, so per-turn `inTokens` climbs (~8k→27k). Cache the history too.
- [ ] **Eval logs are write-only** — add `summarizeProgress` tool / end-of-session recap. `getEvalLog` already exported but unused.
- [ ] **In-memory session history** — survives only as long as the process. Persist if cross-restart continuity needed.
