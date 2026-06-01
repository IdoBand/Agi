---
name: read-tutor-logs
description: Read the latest tutor session transcript plus the tail of the backend debug log. Use when the user invokes /read-tutor-logs or asks to inspect tutor session logs / debug a tutor bug.
---

1. Glob `backend/logs/tutor-sessions/*.md`. The first result is the most recently modified session. If the user passed a session ID arg, use `backend/logs/tutor-sessions/<id>.md` instead.
2. If no transcript exists, say so and stop.
3. Read the transcript file in full. Note the per-turn `**LLM:**` lines (Sonnet calls + token counts) — these self-document Sonnet volume per turn.
4. Correlate to the backend debug log by session, not a blind tail. Extract `<sessionId>` from the chosen `.md` filename (strip `.md`; ignore any `.<timestamp>` rotation suffix), then run PowerShell:
   `Select-String -Path backend\logs\debug.log -Pattern "sid=<sessionId>" | ForEach-Object { $_.Line }`
   This replays every lifecycle line for the session (turn_start, llm_call_start/end, tool_start/end, llm_retry, turn_error, turn_summary) — `turn=` aligns with the transcript's `## Turn N`. If it returns nothing (log rotated/missing), fall back to `Get-Content backend\logs\debug.log -Tail 200`.
5. Summarize in 2-3 sentences: session ID, turn count, per-turn Sonnet call counts + token totals, and CALL OUT any `429`/`rate_limit`/`llm_retry` lines or `turn_error` lines (these explain throttling). Also flag anomalies in Examiner lines (raw JSON, leftover `<hu>`/`<en>` tags, empty replies). Then await user follow-up.
