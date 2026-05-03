---
name: read-tutor-logs
description: Read the latest tutor session transcript plus the tail of the backend debug log. Use when the user invokes /read-tutor-logs or asks to inspect tutor session logs / debug a tutor bug.
---

1. Glob `backend/logs/tutor-sessions/*.md`. The first result is the most recently modified session. If the user passed a session ID arg, use `backend/logs/tutor-sessions/<id>.md` instead.
2. If no transcript exists, say so and stop.
3. Read the transcript file in full.
4. Tail the backend log: PowerShell `Get-Content backend\logs\debug.log -Tail 200`. If the file does not exist, skip this step.
5. Summarize in 2-3 sentences: session ID, turn count, any errors/warnings in the tail, any anomalies in Examiner lines (raw JSON, leftover `<hu>`/`<en>` tags, empty replies). Then await user follow-up.
