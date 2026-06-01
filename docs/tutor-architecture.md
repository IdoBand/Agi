# Tutor architecture

Single, top-to-bottom reference for the Hungarian citizenship-interview tutor. Open this when you need to understand what the tutor is, how a turn flows, where state lives, and which file to open to change behavior.

---

## 1. TL;DR

Push-to-talk Hungarian citizenship-interview tutor. Hold **T**, speak, release. Audio → STT (Whisper local or OpenAI) → Claude Agent SDK turn (with resumable session + 4 MCP tools) → SSE stream of sentences → parallel ElevenLabs TTS → audio played in order. Conversation history is owned by the SDK (resumed each turn by `sdkSessionId`); side-state (asked questions, eval log) lives in in-memory Maps with a 1 h TTL; full markdown transcripts are appended to `logs/tutor-sessions/<sid>.md` and rotated on reset.

---

## 2. Top-level map

```
tutor/
├── frontend/
│   ├── components/
│   │   ├── TutorChatMode.tsx ─────────► wires recorder ↔ useTutorChat ↔ TutorControlPanel
│   │   ├── TutorControlPanel.tsx ─────► phase chip, transcript pane, start/reset buttons
│   │   └── MediaConsole/MediaConsole.tsx ► mic picker + PTT button (CSS-module migrated)
│   └── hooks/
│       ├── useTutorChat.ts ───────────► phase machine, SSE parser, audio queue, T-key bind
│       └── useVoiceRecorder.ts ───────► MediaRecorder wrapper (webm/opus)
│
├── backend/src/
│   ├── routes/tutor.routes.ts ────────► POST /tutor/turn, POST /tutor/reset
│   ├── controllers/tutor.controller.ts ► STT → runTurnStream → fan-out TTS → SSE
│   ├── services/tutor/
│   │   ├── claude-agent.service.ts ───► runTurnStream (Claude SDK + MCP), session map, sweep
│   │   ├── tutor-tools.ts ────────────► LangChain tools: list/read + fused evaluate-and-draw
│   │   ├── system-prompt.ts ──────────► baseline + bilingual examiner prompts
│   │   ├── stt-prompt.ts ─────────────► seeds Whisper w/ scene + last examiner reply
│   │   ├── knowledge.service.ts ──────► manifest + path-traversal-safe file read
│   │   └── session-trace.ts ──────────► markdown turn log + rotate-on-reset
│   ├── services/stt/stt.service.ts ───► provider switch (Whisper local / OpenAI)
│   ├── services/tts/tts.service.ts ───► ElevenLabs single-shot synth
│   └── utils/logger.ts ───────────────► Winston (console + logs/debug.log)
│
├── backend/knowledge/
│   ├── manifest.json
│   └── citizenship/{orderedQuestions.json, images2Questions.json}
│
└── external/
    ├── Anthropic Claude (model from ANTHROPIC_MODEL, default claude-sonnet-4-6)
    ├── OpenAI Whisper / OpenAI Transcribe
    └── ElevenLabs eleven_v3
```

Cross-refs:
- `claude-agent ↔ tutor-tools ↔ knowledge.service` — agent owns session, tools mutate eval/asked Maps and read knowledge files.
- `claude-agent ↔ session-trace` — every successful turn appends; `resetSession` rotates.
- `useTutorChat ↔ useVoiceRecorder ↔ MediaConsole` — hook drives phase, recorder produces blob, console exposes the PTT affordance.
- `system-prompt ↔ ACTIVE_CITIZENSHIP_INTERVIEW_PROMPT ↔ TUTOR_PROMPT_VARIANT env`.

---

## 3. Turn lifecycle

```
USER                   FE (useTutorChat)             BACKEND                       EXTERNAL
────                   ─────────────────             ───────                       ────────
T-down ──────────────► startRecording()
                       phase=recording
                       MediaRecorder → chunks
T-up   ──────────────► stopRecording() → blob
                       phase=thinking
                       fetch POST /tutor/turn ────► tutor.controller
                       (multipart: audio, sid)      handleTutorTurn
                                                    │
                                                    ├─ buildSttPrompt(lastReply)
                                                    ├─ sttService.transcribe ─────► Whisper / OpenAI
                                                    │
                       ◄──── SSE: transcript ──────┤  sseSend({type:'transcript'})
                       transcript pane appends
                                                    │
                                                    ├─ runTurnStream(sid, text)
                                                    │    query({ resume: sdkSessionId,
                                                    │            mcpServers:{tutor},
                                                    │            systemPrompt,
                                                    │            allowedTools }) ──► Claude + MCP loop
                                                    │    for await msg:
                                                    │      assistant.text → buffer → split sentences
                                                    │      tool_use / tool_result → trace
                                                    │
                       ◄──── SSE: sentence (×N) ───┤  yield SentenceEvent
                       transcript text grows        │  controller fires ttsService.synthesize ─► ElevenLabs
                                                    │  drains audio in idx order
                       ◄──── SSE: audio (×N) ──────┤  sseSend({type:'audio', base64})
                       enqueueAudio → phase=speaking
                       <audio> plays, onended → playNext()
                                                    │
                       ◄──── SSE: done ────────────┤  appendTurnTrace → logs/tutor-sessions/<sid>.md
                       turnDoneRef=true              res.end()
                       (after queue drains) phase=listening
```

---

## 4. Backend layout

| Concern | File:line | Notes |
|---|---|---|
| Routes | `backend/src/routes/tutor.routes.ts:7` | `POST /turn` (multipart), `POST /reset` (json) |
| Controller — turn | `backend/src/controllers/tutor.controller.ts:15` | STT → SSE start → drive `runTurnStream`, fan-out TTS, drain in idx order |
| Controller — reset | `backend/src/controllers/tutor.controller.ts:132` | calls `resetSession(sid)` |
| Agent — runTurnStream | `backend/src/services/tutor/claude-agent.service.ts:90` | Claude Agent SDK `query`, sentence boundary split, tool trace capture |
| Agent — resetSession | `backend/src/services/tutor/claude-agent.service.ts:216` | calls `purge` (drops Maps, deleteSession, rotate trace) |
| Agent — purge | `backend/src/services/tutor/claude-agent.service.ts:22` | session GC |
| Agent — sweep | `backend/src/services/tutor/claude-agent.service.ts:34` | TTL (1 h) eviction, runs on every turn |
| MCP tools | `backend/src/services/tutor/tutor-tools.ts:45` | `buildTutorMcpServer(sid)` |
| Tool whitelist | `backend/src/services/tutor/tutor-tools.ts:130` | `TUTOR_TOOL_NAMES` (`mcp__tutor__*`) |
| Active prompt | `backend/src/services/tutor/system-prompt.ts:141` | env-selected baseline / bilingual |
| STT context prompt | `backend/src/services/tutor/stt-prompt.ts:3` | `buildSttPrompt(lastExaminerReply)` |
| Knowledge | `backend/src/services/tutor/knowledge.service.ts` | manifest cache + path-traversal guard |
| Trace append | `backend/src/services/tutor/session-trace.ts:60` | `appendTurnTrace` (writes `## Turn N` block) |
| Trace rotate | `backend/src/services/tutor/session-trace.ts:72` | on reset → `<sid>.<ISO>.md` |
| STT provider switch | `backend/src/services/stt/stt.service.ts:6` | `STT_PROVIDER` (`whisper` default, `openai`) |
| TTS | `backend/src/services/tts/tts.service.ts:18` | ElevenLabs `eleven_v3`, returns Buffer |
| Logger | `backend/src/utils/logger.ts` | Winston, console + `logs/debug.log` (footnote¹) |

¹ `CLAUDE.md` references `backend/sre/utils/logger.ts`; the actual path is `backend/src/utils/logger.ts`. Worth fixing the typo in `CLAUDE.md`.

---

## 5. Tools

Built per-session in `tutor-tools.ts` (closures capture `sessionId`). LangChain `StructuredToolInterface[]` handed to `createReactAgent`. Each tool returns a JSON string. Two builders, one per mode:

- `buildBankOnlyTutorTools` → `listKnowledge`, `readKnowledge`, **`evaluateAndDrawNext`**.
- `buildTutorTools` (bilingual/active) → `listKnowledge`, `readKnowledge`, **`evaluateAndDrawPractice`**.

| Tool | Input schema | Effect | Storage |
|------|--------------|--------|---------|
| `listKnowledge` | `{}` | reads cached manifest | none |
| `readKnowledge` | `{path: string}` | reads file under `TUTOR_KNOWLEDGE_DIR` (path-traversal blocked) | none |
| `evaluateAndDrawPractice` | `{ evaluation?: {topic,correct,note}, draw?: {category?} }` | **fused**: if `evaluation`, append eval log first; if `draw`, return random Q&A minus served IDs. Both optional. Returns `{recorded, ...question}` or `{recorded}` | mutates `evalLogs` + `askedQuestions` |
| `evaluateAndDrawNext` | `{ evaluation?: {topic,correct,note}, draw?: {skip:'none'\|'question'\|'category'} }` | **fused**: eval-log first (if present), then advance the server cursor (if `draw`). Eval-only call leaves cursor untouched. Returns `{recorded, ...question}`, `{recorded, newCategory, categoryName}`, `{recorded, done:true}`, or `{recorded}` | mutates `evalLogs` + `askedQuestions` + `bankCursors` |

Fusion eliminates the separate `recordEvaluation` round-trip: a record+draw turn is one tool call (one observe round-trip) instead of two. Maps are module-scoped in `tutor-tools.ts`; cleared by `dropEvalLog` / `dropAskedQuestions` / `dropBankCursor` from `purge`.

### Prompt caching

The static prefix (tool schemas + system prompt) is byte-identical across every turn. `claude-agent.service.ts` builds two module-level `SystemMessage`s whose single text block carries `cache_control:{type:'ephemeral'}`; Anthropic caches the whole tools→system prefix. First Sonnet call of a session writes the cache (~3.6k tokens), every later call reads it. Observable via `cacheRead=`/`cacheWrite=` on the `llm_call_end` debug line. Note: `input_tokens` already folds in cache tokens, so it does not drop — judge caching by the cache fields, not `inTokens`.

---

## 6. Memory model — three layers

```
┌─────────────────────────────────────────────────────────────────────┐
│ L1  SDK-managed conversation history                                │
│     owner: @anthropic-ai/claude-agent-sdk                           │
│     key:   state.sdkSessionId  (randomUUID at first turn)           │
│     write: every assistant + tool message in the SDK loop           │
│     read:  query({ resume: sdkSessionId }) on turns 2..N            │
│     drop:  deleteSession(sdkSessionId) inside purge()               │
└─────────────────────────────────────────────────────────────────────┘
              ▲                                     ▲
              │ first turn uses {sessionId}         │ every later turn uses {resume}
              │                                     │
┌─────────────────────────────────────────────────────────────────────┐
│ L2  In-memory side-state (process lifetime, 1 h TTL)                │
│     sessions       : Map<sid, {sdkSessionId,turnCount,lastTouched,  │
│                                lastReply}>     (claude-agent)       │
│     askedQuestions : Map<sid, Set<questionId>> (tutor-tools)        │
│     evalLogs       : Map<sid, TutorEvalLogEntry[]> (tutor-tools)    │
│     turnCounters   : Map<sid, number>          (session-trace)      │
│     headerWritten  : Set<sid>                  (session-trace)      │
│     write: runTurnStream end-of-turn / evaluateAndDraw{Next,        │
│            Practice} (eval log + asked set + bank cursor)           │
│     drop:  purge() + sweep() (every turn, evicts >1 h idle)         │
└─────────────────────────────────────────────────────────────────────┘
              ▲
              │ turn-end: appendTurnTrace
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ L3  Disk transcripts                                                │
│     path: logs/tutor-sessions/<sid>.md                              │
│     write: appendTurnTrace (one `## Turn N` block per turn,         │
│            includes user text, tool calls + truncated outputs,      │
│            examiner reply)                                          │
│     rotate: rotateSessionTrace → <sid>.<ISO>.md (on reset)          │
│     read:  /read-tutor-logs skill                                   │
└─────────────────────────────────────────────────────────────────────┘
```

Notes:
- L1 is opaque — we never inspect or replay it ourselves; we only hand the SDK a `resume` id.
- L2's `lastReply` is the *only* thing we expose to the next turn outside L1 — it seeds the Whisper prompt for better recognition (`stt-prompt.ts:3`).
- L2 and L1 lifetimes can desync if the SDK store is wiped externally — the resume call would silently start a fresh thread. The asked/eval Maps would still hold stale state. No mitigation today.

---

## 7. System prompt anatomy

Two prompt strings live in `system-prompt.ts`. `ACTIVE_CITIZENSHIP_INTERVIEW_PROMPT` (`:141`) picks one based on `TUTOR_PROMPT_VARIANT`:

```
TUTOR_PROMPT_VARIANT=baseline   → CITIZENSHIP_INTERVIEW_PROMPT_BASELINE  (:26)
TUTOR_PROMPT_VARIANT=bilingual  → CITIZENSHIP_INTERVIEW_PROMPT_BILINGUAL (:82)  [default]
```

Both share the same skeleton (only the *grammar feedback* section differs):

- **Persona** — Hungarian citizenship interview examiner; neutral, professional; default Hungarian; no rapport-building.
- **Language level (own speech)** — A2 CEFR; short sentences; present + simple past; ~1500 words; no idioms/slang/conditional/subjunctive; cap does not apply to bank questions read verbatim.
- **Session continuity** — full history (incl. tool calls + results) is resumed each turn; treat as ground truth; no re-asking; max 3 redraws if a paraphrase appears.
- **Conduct (tool use, MANDATORY)** — re-expressed in fused terms (the old two-step "record then draw" is now one call):
  - **eval + draw** (both args): normal turn after the learner answered — record and draw the next in one call.
  - **draw only**: first question; redundancy re-draw (`skip:'question'`/cap 3, or cap-3 redraw in bilingual).
  - **eval only**: deferred-eval resolution; recording a self-generated (non-bank) question; "correct" + own follow-up.
  - **no tool call**: first miss/partial (hint, defer eval, await retry); pure clarification turn.
  - Hard invariant: if the previous turn drew a question and the learner attempted an answer, this turn's call MUST include `evaluation` (except deferred-partial-awaiting-retry, clarification, or skip with `note='skipped'`). Never attach `evaluation` to a silent re-draw.
  - One question at a time; brief acknowledgement; first turn = greeting + first question.
- **Evaluation** — charitable to STT noise; gold answer is one valid answer; partial OK; `correct=false` only on real meaning miss; neutral verbalization (`Helyes.` / `Pontosabban: …`).
- **Grammar feedback** —
  - *baseline:* repeat corrected form in Hungarian, e.g. `Helyesen: a nagymamám családja.`
  - *bilingual:* deliver correction in **English** (`Quick correction — you said '<wrong>', the correct form is '<right>' because <reason>.`), then continue in Hungarian.
  - One per turn; never on STT noise; doesn't flip pass/fail; surface in the fused tool's `evaluation.note`.
- **Tools recap** — `evaluateAndDrawPractice`/`evaluateAndDrawNext` (fused: `draw` pulls a question — don't speak gold first; `evaluation` records the judgement — mandatory after every drill answer; combine both in one call), `listKnowledge`/`readKnowledge` (summarize, don't dump).
- **Output format** — Hungarian only (bilingual exception: the correction sentence is English); plain text; no markdown/JSON/tags.
- **Hard rules** — short (1-3 sentences); spoken aloud; never break character; never expose tool names; never empty.
---

## 8. Frontend layout

| Concern | File:line |
|---|---|
| Phase machine + SSE parser + audio queue | `frontend/src/hooks/useTutorChat.ts:53` |
| Start session (sets `sid`, phase=listening) | `useTutorChat.ts:69` |
| Reset (POST `/tutor/reset`, abort in-flight) | `useTutorChat.ts:76` |
| `enqueueAudio` / `playNext` | `useTutorChat.ts:101–125` |
| `sendTurn` (POST + SSE consume) | `useTutorChat.ts:131` |
| T-key push-to-talk | `useTutorChat.ts:237` (keydown `:241`, keyup `:254`) |
| MediaRecorder wrapper | `frontend/src/hooks/useVoiceRecorder.ts:13` |
| Chat mode wiring | `frontend/src/components/TutorChatMode.tsx:20` |
| Control panel UI | `frontend/src/components/TutorControlPanel.tsx` |
| Mic picker + PTT visual | `frontend/src/components/MediaConsole/MediaConsole.tsx` (CSS-module migrated) |

Phase machine: `idle → listening → recording → thinking → speaking → listening`. Reset returns to `idle`. The hook also reports PTT availability to the parent via `onPttAvailableChange` (`:230`) so the console can grey out the affordance when not pressable.

`/translate` (`POST /translate`) is the HU→EN translator backend; called from the FE when the user toggles a transcript line to view English.

---

## 9. External services & env vars

| Var | Default | Used by |
|-----|---------|---------|
| `ANTHROPIC_API_KEY` | (required) | `claude-agent.service.ts` |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | `config/index.ts:52`, passed to `query({model})` |
| `TUTOR_PROMPT_VARIANT` | `bilingual` | `system-prompt.ts:141` |
| `TUTOR_KNOWLEDGE_DIR` | `./knowledge` (resolved) | `knowledge.service.ts` |
| `TUTOR_STT_SCENE` | `Magyar állampolgársági interjú zajlik.` | `stt-prompt.ts:1` |
| `STT_PROVIDER` | `whisper` | `stt.service.ts:6` |
| `STT_TEMPERATURE` | `0` | `whisper.stt.service.ts`, `openai.stt.service.ts` — decoding temperature; negative = omit, use provider default |
| `STT_TEMPERATURE_INC` | `0` | `whisper.stt.service.ts` — whisper.cpp fallback temperature step; negative = omit |
| `WHISPER_PATH` | `./bin/whisper/whisper-cli.exe` | `whisper.stt.service.ts` |
| `WHISPER_SERVER_PATH` | `./bin/whisper/whisper-server.exe` | ditto |
| `WHISPER_MODEL_PATH` | `./bin/whisper/models/ggml-medium.bin` | ditto |
| `WHISPER_SERVER_PORT` | `8178` | ditto |
| `OPENAI_API_KEY` | — | `openai.stt.service.ts` (when `STT_PROVIDER=openai`) |
| `OPENAI_STT_MODEL` | `gpt-4o-mini-transcribe` | ditto |
| `ELEVEN_LABS_API_KEY` | — | `tts.service.ts` |
| `ELEVEN_LABS_VOICE_ID` | `kgG7dCoKCfLehAPWkJOE` | ditto (model: `eleven_v3`) |
| `GOOGLE_TRANSLATE_API_KEY` | — | `/translate` route |

External services hit per turn: 1× STT (Whisper local **or** OpenAI), 1× Claude (multi-step w/ MCP tool round-trips), N× ElevenLabs (one per yielded sentence, parallel).

---

## 10. Knowledge data

`backend/knowledge/manifest.json` lists curated lessons; tools resolve `path` to a file under `TUTOR_KNOWLEDGE_DIR` and read it.

```
backend/knowledge/
├── manifest.json
└── citizenship/
    ├── orderedQuestions.json   # MAGÁRÓL etc.
    └── images2Questions.json   # állampolgárság, Nyelvtudás
```

Both JSON files are arrays of question metas with the schema (per `quiz.service.getAllQuestionMetas`):
```
{ id, category, question, answer, englishTranslation, ... }
```
The fused draw tools (`evaluateAndDrawPractice` / `evaluateAndDrawNext`) read from this aggregated bank (not from the knowledge files directly — the knowledge tools are for grammar/vocab lookup).

---

## 11. Logging conventions

Winston logger writes to console + `logs/debug.log`. Greppable prefixes:

| Prefix | Source | Example |
|--------|--------|---------|
| `[tutor]` | controller | `[tutor] sid=abc stt_done text="..."`, `[tutor] sid=abc first_audio_emitted dt_from_stt=820ms`, `[tutor] sid=abc done total_dt_from_stt=...ms reply="..."` |
| `[tutor-turn]` | controller catch | `[tutor-turn] error: ...` |
| `[tutor-agent]` | claude-agent.service | `[tutor-agent] non-success result: error_max_turns`, `[tutor-agent] query error: ...` |
| `[tutor-tool <name>]` | tutor-tools | `[tutor-tool readKnowledge] Path traversal blocked: ...` |
| `[tutor-trace]` | session-trace | `[tutor-trace] append failed: ...`, `[tutor-trace] rotate failed: ...` |
| `[knowledge]` | knowledge.service | `[knowledge] loaded N entries from .../manifest.json` |

Per-turn timing breadcrumbs (`stt_done`, `first_sentence_emitted`, `first_audio_emitted`, `done`) all carry `sid=<id>` and a `dt_from_stt` so you can reconstruct end-to-end latency from the log alone.

---

## 12. Glossary / cross-refs

- `useTutorChat ↔ tutor.controller` — SSE protocol: `transcript | sentence | audio | done` (`tutor.types.ts:12`).
- `claude-agent ↔ tutor-tools ↔ knowledge` — tools mutate `askedQuestions` / `evalLogs` Maps; knowledge reads are stateless.
- `claude-agent ↔ session-trace` — every turn appends; `resetSession` rotates the file and clears trace counters.
- `claude-agent ↔ Anthropic SDK` — `sessionId` (first turn) / `resume` (later turns) is the *only* link to L1 history.
- `system-prompt ↔ ACTIVE_CITIZENSHIP_INTERVIEW_PROMPT ↔ TUTOR_PROMPT_VARIANT` — env switch.
- `stt-prompt ↔ getLastAssistantReply` — last examiner reply is fed to Whisper as priming context.
- `useTutorChat ↔ useVoiceRecorder ↔ MediaConsole` — recorder is owned at the page level and passed in; the hook only reads `isRecording` / `selectedDeviceId` and calls `start/stopRecording`.
