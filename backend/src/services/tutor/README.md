# Tutor Mode

Free-form conversational Hungarian tutor (citizenship-interview examiner)
driven by an LLM agent built on **LangChain/LangGraph**
(`createReactAgent`). Runs alongside the strict quiz mode — both share the
same STT / TTS / avatar pipeline. The avatar mouth is driven on the frontend
by audio amplitude (no server-side lipsync).

## Files

- `claude-agent.service.ts` — agent runner: `runTurnStream()` async generator
  (sentence events), session map, per-step text gating, LLM/tool telemetry
- `tutor-tools.ts` — LangChain tools (list/read knowledge + one fused
  evaluate-and-draw per mode; bank-only mode adds `listTopics`)
- `system-prompt.ts` — examiner persona + tool-use rules
  (`…_BILINGUAL`, `…_BANK_ONLY`; `ACTIVE_…` picks the non-bank prompt)
- `stt-prompt.ts` — Whisper context prompt (scene + last examiner reply)
- `session-trace.ts` — markdown transcripts in `logs/tutor-sessions/<sid>.md`
- `knowledge.service.ts` — manifest loader, path-traversal guard
- `providers/` — `llm-provider.factory.ts` selects Anthropic | OpenAI
  (`LLM_PROVIDER`); each provider builds the chat model, system message, and
  normalizes usage metadata
- `../../../knowledge/manifest.json` + `*.md` — curated lessons
- `../../controllers/tutor.controller.ts` — SSE pipeline orchestrator
- `../../routes/tutor.routes.ts` — `POST /tutor/turn`, `POST /tutor/reset`

## One turn end-to-end (SSE)

```
mic Blob ─► POST /tutor/turn ─► uploadAudio (multer temp file)
       ─► sttService.transcribe(path, ctx, sttPrompt)   [stt-prompt.ts adds scene + last reply]
       ─► SSE event: transcript
       ─► runTurnStream(sessionId, text, bankOnly)      [claude-agent.service.ts]
              │
              ├─ createReactAgent({ llm, tools, prompt, checkpointer: MemorySaver })
              │    thread_id per session → history lives in the checkpointer
              ├─ agent.streamEvents(v2): tokens accumulate in a buffer,
              │  split on sentence boundaries → yield {idx, hu}
              └─ tool calls run in-process; usage + latency logged per LLM call
       ─► per sentence: SSE event: sentence  +  ttsService.synthesize(hu)
       ─► TTS results re-ordered by idx ─► SSE event: audio {idx, base64 mp3}
       ─► SSE event: done {fullHu} ─► session-trace appends the turn
```

Sentence-level streaming means first audio plays while the model is still
generating. TTS runs concurrently per sentence; audio events are emitted in
order (`nextEmitIdx` drain).

### Step gating (bank-only quirk)

The model's step #1 streams live (first-audio latency). Steps #2+ are
buffered until their tool call is visible: a **silent re-draw**
(`draw.skip='question'` with no `evaluation`) drops the buffered narration so
"skipping this question" deliberation is never spoken; anything else flushes.

## Why LangGraph

- `createReactAgent` gives the ReAct loop (model ↔ tools) for free;
  `streamEvents(v2)` exposes token chunks, tool start/end, and usage metadata
  in one stream — exactly what sentence-level SSE + telemetry need.
- `MemorySaver` checkpointer keeps per-session history under a `thread_id`,
  so each turn sends only the new `HumanMessage` instead of replaying the
  transcript manually.
- Provider-agnostic: the factory swaps Anthropic ↔ OpenAI behind one
  `ILlmProvider` interface. The Anthropic provider sets ephemeral
  prompt-cache breakpoints (system block + moving tail) so the tools→system
  prefix and prior turns are read from cache; OpenAI caching is
  automatic/server-side. Observable via `cacheRead`/`cacheWrite` on
  `llm_call_end` log lines.

## Tools

Two modes, chosen per session by the `bankOnly` flag on `/tutor/turn`. The
evaluate + draw tools are **fused** — recording an evaluation rides along
with drawing the next question instead of taking its own LLM round-trip:

| Tool | Mode | Purpose |
|---|---|---|
| `listKnowledge` | both | reads `manifest.json`, returns `{entries:[{path,title,summary,tags}]}` — the agent's "table of contents" |
| `readKnowledge({path})` | both | path must be in manifest; resolves under `knowledgeDir` and asserts the resolved path stays inside (defeats `../`) |
| `evaluateAndDrawPractice({evaluation?,draw?})` | bilingual/active | **fused**: optional `evaluation {topic,correct,note}` appends to the per-session eval log; optional `draw {category?}` returns a random Q&A minus served IDs. Both optional → first question is draw-only, a correct answer is eval+draw in one call, an eval-only call records without drawing |
| `listTopics` | bank-only | read-only list of bank categories with 1-based numbers (for jumps) |
| `evaluateAndDrawNext({evaluation?,draw?})` | bank-only | **fused**: same `evaluation`; `draw {skip:'none'\|'question'\|'category', jumpToTopic?}` advances the server-managed category cursor (jump wins over skip). Eval-only call leaves the cursor untouched. Returns `{newCategory,categoryName}` on category entry, `{done:true}` when exhausted |

## Adding a new tool

In `tutor-tools.ts`, inside `buildTutorTools` (or `buildBankOnlyTutorTools`):

```ts
import { tool } from '@langchain/core/tools';

const myTool = tool(
  async (args: { foo: string }) => {
    const result = await whatever(args.foo);
    return JSON.stringify(result);
  },
  {
    name: 'doThing',
    description: 'What it does, when the agent should call it.',
    schema: z.object({ foo: z.string() }),
  },
);
```

Add it to the returned tools array and mention it in the system prompt so
the model knows when to call it. Tools are rebuilt per turn with the
`sessionId` closed over, so per-session state (eval logs, cursors) needs no
extra plumbing.

## Adding curated knowledge

1. Drop a new `*.md` file in `backend/knowledge/`.
2. Add an entry to `manifest.json`: `{path, title, summary, tags}`.
3. That's it — `listKnowledge` will surface it on the next session start, and
   `readKnowledge` will accept the path. `summary` is what the model uses to
   decide whether to read the file, so keep it tight and accurate.

The manifest is the *only* thing the agent sees up-front; files not listed
there cannot be read (defense in depth alongside the path-traversal guard).

## Session state

- **Backend:** `Map<sessionId, {lastTouched, threadId, turnCount, lastReply,
  bankOnly}>` in `claude-agent.service.ts`, 1h TTL swept on each turn.
  Conversation history lives in the `MemorySaver` checkpointer under
  `threadId`. Eval logs / served-question sets / bank cursors live in
  parallel Maps in `tutor-tools.ts` keyed by the same id.
- **Traces:** every turn appends to `logs/tutor-sessions/<sessionId>.md`
  (learner text, LLM calls + token usage, tool calls, examiner reply).
  Reset rotates the file aside with a timestamp.
- **Frontend:** `useTutorChat` generates a uuid on `startSession`, sends it
  with every `/tutor/turn`, holds an `AbortController` so re-recording
  cancels in-flight requests. `POST /tutor/reset` purges all backend maps +
  the checkpointer thread.

## Config

From `backend/src/config/index.ts`:

```
ANTHROPIC_API_KEY       required when LLM_PROVIDER=anthropic (throws on first turn if missing)
ANTHROPIC_MODEL         default claude-sonnet-4-6
LLM_PROVIDER            anthropic (default) | openai
LLM_OPENAI_MODEL        tutor-only OpenAI model, default gpt-5-mini
TUTOR_KNOWLEDGE_DIR     default ./knowledge
TUTOR_PROMPT_VARIANT    baseline | bilingual (parsed in config; the active
                        prompt is currently pinned to BILINGUAL in system-prompt.ts)
TUTOR_STT_SCENE         Whisper scene line (stt-prompt.ts), Hungarian default
```

## Known limitations / v2 ideas

- **In-memory sessions.** Backend restart drops the session map, checkpointer
  threads, eval logs, and cursors. Only the markdown traces survive.
- **Empty-reply fallback.** If the model emits only tool calls with no final
  text, we speak `"Bocsánat, nem hallottam jól. Mondanád újra?"` so
  ElevenLabs doesn't reject an empty input.
- **Eval logs are write-only.** The fused tools' `evaluation` arg appends;
  nothing reads them yet. Add a `summarizeProgress` tool or end-of-session
  recap when ready.
- **Prompt variant is vestigial.** `TUTOR_PROMPT_VARIANT` parses but nothing
  consumes it; switch prompts via `ACTIVE_CITIZENSHIP_INTERVIEW_PROMPT` in
  `system-prompt.ts`.
