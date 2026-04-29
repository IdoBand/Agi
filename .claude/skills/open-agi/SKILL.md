---
name: open-agi
description: Open the AGI frontend in a Playwright-controlled browser at http://localhost:5173. Use when the user says /open-agi or asks to "open the app / open agi / launch the frontend in a browser".
---

1. Call `mcp__playwright__browser_navigate` with `url: "http://localhost:5173"`. Playwright MCP auto-launches a browser on first navigate.
2. If navigation fails (connection refused), tell the user the dev server is not running and suggest `cd frontend && npm run dev`. Do not start it automatically.
3. After successful navigation, take a `mcp__playwright__browser_snapshot`.
4. One terse sentence confirming the page loaded.
