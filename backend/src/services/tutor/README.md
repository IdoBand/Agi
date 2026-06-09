# Tutor Mode

Free-form conversational Hungarian tutor driven by Claude via the Agent SDK
(`@anthropic-ai/claude-agent-sdk`). Runs alongside the strict quiz mode — both
share the same STT / TTS / avatar pipeline. The avatar mouth is driven on the
frontend by audio amplitude (no server-side lipsync).

## Files

- `claude-agent.service.ts` — agent runner (one `query()` per turn, history
  fallback, session map)
- `tutor-tools.ts` — custom LangChain tools (list/read + one fused evaluate-and-draw per mode)
- `system-prompt.ts` — persona + tool-use rules
- `knowledge.service.ts` — manifest loader, path-traversal guard
- `../../../knowledge/manifest.json` + `*.md` — curated lessons
- `../../controllers/tutor.controller.ts` — pipeline orchestrator
- `../../routes/tutor.routes.ts` — `POST /tutor/turn`, `POST /tutor/reset`

## One turn end-to-end

```
mic Blob ─► POST /tutor/turn ─► uploadAudio (multer writes temp/<wf>/input/original.webm)
       ─► sttService.transcribe(path)              [reused: stt.service.ts]
       ─► claudeAgent.runTurn(sessionId, text)     [NEW]
              │
              ├─ load history for sessionId from in-memory Map
              ├─ build prompt = transcript + "Learner: <text>"
              ├─ query({ prompt, options:{ systemPrompt, mcpServers:{tutor},
              │           allowedTools:[mcp__tutor__*], tools:[],
              │           permissionMode:'bypassPermissions' }})
              ├─ async iterate; agent may call tools (executed in-process,
              │  results fed back automatically by SDK), accumulate text
              └─ append {user,assistant} to history; return text (or fallback)
       ─► ttsService.synthesize(text) ─► mp3 buf   [reused: tts.service.ts]
       ─► saveToFile ─► read mp3 ─► base64
       ─► { content, audio, facialExpression, userTranscript }
```

## Why this architecture

- **`query()` per turn, not a long-lived session object.** The Agent SDK's
  `query()` runs a full agentic loop until the model stops calling tools, then
  closes. Stateless from the SDK's point of view — we reconstruct context by
  passing the whole transcript as the next prompt. Simpler than the SDK's own
  session resume (which writes to disk under `~/.claude`), and survives
  restarts only as long as the in-memory Map does (not at all). For a v1 voice
  tutor that's fine.
- **`tools: []`** disables the built-in Claude Code tools (Read, Bash,
  Grep…). Without this the agent could read your filesystem.
- **`allowedTools`** whitelists only the tutor tools, so even if defaults
  sneak through they're rejected.
- **`permissionMode: 'bypassPermissions'`** — the agent runs unattended; we
  don't want a CLI permission prompt blocking the request.

## How tools work

The Agent SDK speaks **MCP** (Model Context Protocol). `createSdkMcpServer`
builds an *in-process* MCP server — no subprocess, no network. Each tool is
defined with `tool(name, description, zodSchema, handler)`; the SDK
auto-generates the JSON schema from Zod and routes tool calls back to your
handler. The agent sees them as `mcp__tutor__listKnowledge`, etc.
(`mcp__<server>__<tool>`).

The tools per mode (the draw + record tools are **fused** into one — recording rides along with the draw instead of taking its own Sonnet round-trip):

| Tool | Mode | Purpose |
|---|---|---|
| `listKnowledge` | both | reads `manifest.json`, returns `{entries:[{path,title,summary,tags}]}` — the agent's "table of contents" |
| `readKnowledge({path})` | both | path must be in manifest; resolves under `knowledgeDir` and asserts the resolved path stays inside (defeats `../`) |
| `evaluateAndDrawPractice({evaluation?,draw?})` | bilingual/active | **fused**: optional `evaluation {topic,correct,note}` appends to the per-session eval log; optional `draw {category?}` returns a random Q&A minus served IDs. Both optional → first question is draw-only, a correct answer is eval+draw in one call, an eval-only call records without drawing |
| `evaluateAndDrawNext({evaluation?,draw?})` | bank-only | **fused**: same `evaluation`; `draw {skip:'none'\|'question'\|'category'}` advances the server-managed category cursor. Eval-only call leaves the cursor untouched |

## Adding a new tool

In `tutor-tools.ts`, inside `buildTutorMcpServer`:

```ts
const myTool = tool(
  'doThing',
  'What it does, when the agent should call it.',
  { foo: z.string(), bar: z.number().optional() },
  async (args) => {
    const result = await whatever(args.foo);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);
```

Then add `myTool` to the `tools: [...]` array passed to `createSdkMcpServer`,
and add `'mcp__tutor__doThing'` to `TUTOR_TOOL_NAMES`. Mention it in the
system prompt so Claude knows when to use it.

## Adding curated knowledge

1. Drop a new `*.md` file in `backend/knowledge/`.
2. Add an entry to `manifest.json`: `{path, title, summary, tags}`.
3. That's it — `listKnowledge` will surface it on the next session start, and
   `readKnowledge` will accept the path. `summary` is what Claude uses to
   decide whether to read the file, so keep it tight and accurate.

The manifest is the *only* thing the agent sees up-front; files not listed
there cannot be read (defense in depth alongside the path-traversal guard).

## Reuse map (existing → tutor)

| Existing | Used by tutor for |
|---|---|
| `sttService.transcribe(path, ctx)` | learner audio → text |
| `ttsService.synthesize(text)` + `saveToFile` | reply text → mp3 |
| `uploadAudio` middleware | multipart parsing + temp dir + `req.workflowId` |
| `WorkflowContext` + `deleteWorkflowDir` | per-request temp file lifecycle |
| `loadQuestions()` (via new `getRandomQuestionMeta`) | tool 3's question source |
| Frontend `useVoiceRecorder` | unchanged, shared with quiz |
| Frontend `Experience` / `Avatar` | consume same `Message` shape — controller returns `content` (not `text`) so mapping is trivial |

## Session state

- **Backend:** `Map<sessionId, {lastTouched, history}>` in
  `claude-agent.service.ts`. 1h TTL swept on each turn. Eval logs live in a
  parallel Map in `tutor-tools.ts` keyed by the same id.
- **Frontend:** `useTutorChat` generates a uuid on `startSession`, sends it
  with every `/tutor/turn`, holds an `AbortController` so re-recording cancels
  in-flight requests. `POST /tutor/reset` drops both maps.

## Mode isolation (frontend)

`App.tsx` only mounts **one** of `<QuizMode/>` or `<TutorChatMode/>` at a
time. Both hooks register a global T-key listener; mounting both would
collide. The active mode pushes `currentMessage` up via `onMessage` and
registers its `onAudioEnd` callback via `onAudioEndRef`, so the shared
`<Experience/>` plays whichever is active.

## Config

`backend/src/config/index.ts` adds:

```ts
anthropic: { apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6' },
tutor:     { knowledgeDir: path.resolve(process.env.TUTOR_KNOWLEDGE_DIR || './knowledge') },
```

`ANTHROPIC_API_KEY` is required — `claude-agent.service.ts` throws on the
first turn if it's missing rather than silently degrading.

## Known limitations / v2 ideas

- **Latency.** Reply → TTS → audio is a few seconds end-to-end. The avatar
  mouth animates from audio amplitude on the client (no lipsync step).
- **In-memory history.** Backend restart drops sessions. Persist to disk or
  use the SDK's own `resume:` if needed.
- **Empty-reply fallback.** If the model only emits tool calls with no final
  text, we return `"Bocsánat, nem hallottam jól. Mondanád újra?"` so
  ElevenLabs doesn't reject an empty input.
- **Eval logs are write-only.** the fused tool's `evaluation` arg appends; nothing reads
  them yet. Add a `summarizeProgress` tool or end-of-session recap when ready.
