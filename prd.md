# PRD: Quiz Mode

## Overview

Add a quiz game mode to the existing voice-chat application. The avatar (Agi) asks the user questions from a predefined pool (`questions.json`, 186 questions with stable `id`s), the user answers by voice, and Ollama evaluates whether the answer is acceptable — returning a simple boolean. Question audio + lipsync files are pre-generated once via a preparation script (no runtime TTS). No sessions, no spoken feedback — just question → answer → correct/incorrect.

---

## questions.json Schema

Each question has a stable UUID `id` used to name pre-generated audio/lipsync files. IDs are permanent — they don't change when questions are added, removed, or reordered.

```typescript
interface Question {
  id: string;   // UUID v4, e.g. "f47ac10b-58cc-4372-a567-0e02b2c3d479"
  q: string;    // question text (Hungarian)
  a: string;    // expected answer (may be empty)
}
```

ID generation: when adding `id` fields for the first time, assign a `crypto.randomUUID()` to each question. Once assigned, IDs never change.

---

## Preparation Script

A standalone script (`scripts/generate-question-audio.ts`) that pre-generates TTS audio + lipsync data for all questions. Run once (or incrementally).

### Usage

```bash
npx ts-node scripts/generate-question-audio.ts           # all questions
npx ts-node scripts/generate-question-audio.ts --limit 5  # first 5 only (for testing)
```

### Pipeline (per question)

1. Read `questions.json`, iterate by `id`.
2. Skip if `backend/assets/questionsAudio/{id}.mp3` already exists (idempotent).
3. `audioService.synthesize(q)` → MP3 buffer.
4. Save MP3 to `backend/assets/questionsAudio/{id}.mp3`.
5. `lipsyncService.generateLipsync(mp3Path)` → save lipsync to `backend/assets/questionsAudio/{id}.json`.

### Output structure

```
backend/assets/questionsAudio/
├── f47ac10b.mp3
├── f47ac10b.json    (lipsync)
├── a3c9e71d.mp3
├── a3c9e71d.json
└── ...
```

### Initial testing

Run for only 5 questions (`--limit 5`) to validate before burning through all 186.

---

## Game Flow

```
START → Pick 5 random questions, load pre-generated audio+lipsync from disk
  → For each question:
      1. Frontend plays question (TTS + lipsync already loaded)
      2. User answers via push-to-talk
      3. Backend: STT transcribes the answer
      4. Backend: Ollama evaluates questionText + userAnswer → returns boolean
      5. Frontend shows correct/incorrect
  → Repeat until all 5 answered
```

---

## Endpoints

### 1. `GET /quiz/start`

Starts a new quiz round. Picks 5 random questions, loads pre-generated audio + lipsync from disk, and returns them all at once so the frontend can play them sequentially without waiting.

#### Response

```typescript
interface QuizStartResponse {
  questions: QuizQuestion[];
}

interface QuizQuestion {
  index: number;                   // 0-4
  text: string;                    // raw Hungarian text from questions.json
  audio: string;                   // base64 MP3 (ElevenLabs)
  lipsync: LipsyncData;           // mouthCues array (Rhubarb)
  facialExpression: FacialExpression; // always "default" for questions
}
```

#### Pipeline

1. Shuffle `questions.json`, take first 5.
2. For each question, read pre-generated files from `backend/assets/questionsAudio/`:
   - Read `{id}.mp3` → base64 encode
   - Read `{id}.json` → parse as lipsync data
3. Return all 5 questions with audio + lipsync.

No TTS or lipsync generation at runtime.

#### Error cases

| Case | Status | Body |
|------|--------|------|
| Audio file missing for selected question | 500 | `{ error: "Missing pre-generated audio for question {id}" }` |

---

### 2. `GET /quiz/start/test`

Same as `/quiz/start` but always returns the first 5 questions from `questions.json` (deterministic, no shuffle). Used during development to test against the small set of pre-generated audio files before generating all 186.

Once all question audio is generated, this endpoint can be removed.

---

### 3. `POST /quiz/evaluate`

Receives the user's voice answer for a single question, transcribes it via STT, sends question text + answer text to Ollama for evaluation, returns a boolean.

#### Request

```
Content-Type: multipart/form-data

Fields:
  - audio: File (audio/webm, audio/wav, audio/mp3, etc.)
  - questionText: string          // the original question text
```

```typescript
interface QuizEvaluateRequest {
  audio: File;                     // user's voice answer
  questionText: string;            // question being answered
}
```

#### Response

```typescript
interface QuizEvaluateResponse {
  correct: boolean;                // Ollama's verdict
  explanation: string;             // Ollama's reasoning (why correct/incorrect)
  userTranscript: string;          // what STT heard
}
```

#### Pipeline

1. Upload middleware saves audio → `temp/{workflowId}/input/original.webm`.
2. `audioService.transcribe(audioPath, ctx)` → user answer text.
3. Build Ollama evaluation prompt with `questionText` + `userTranscript`, call `llmService.chat(messages)`.
4. Parse Ollama response → extract `correct: boolean` and `explanation: string`.
5. Return `{ correct, explanation, userTranscript }`.

#### Error cases

| Case | Status | Body |
|------|--------|------|
| Missing questionText | 400 | `{ error: "questionText is required" }` |
| STT / LLM failure | 500 | `{ error: "..." }` |

---

## Ollama Evaluation Prompt

```
System:
Te egy kvíz értékelő asszisztens vagy. A felhasználó egy kérdésre válaszolt.
Döntsd el, hogy a válasz elfogadható-e. A válasznak nem kell tökéletesnek lennie,
de relevánsnak és értelmesnek kell lennie a kérdés kontextusában.
Adj egy rövid magyarázatot is, hogy miért helyes vagy helytelen a válasz.

Válaszolj PONTOSAN ebben a JSON formátumban:
{"correct": true/false, "explanation": "rövid magyarázat"}

User:
Kérdés: {questionText}
Válasz: {userTranscript}
```

The LLM response is parsed as JSON. If parsing fails, fall back to `{ correct: false, explanation: "" }`.

---

## New File Structure

```
backend/src/
├── routes/
│   └── quiz.routes.ts          # GET /quiz/start, GET /quiz/start/test, POST /quiz/evaluate
├── controllers/
│   └── quiz.controller.ts      # handleQuizStart, handleQuizEvaluate
├── services/
│   └── quiz.service.ts         # question selection, evaluation orchestration
├── types/
│   └── quiz.types.ts           # QuizQuestion, QuizStartResponse, QuizEvaluateRequest, QuizEvaluateResponse
```

---

## Service Reuse

| Existing Service | Reused In | How |
|---|---|---|
| `audioService.synthesize()` | Preparation script | TTS for each question (one-time) |
| `audioService.saveToFile()` | Preparation script | Save MP3 to assets dir |
| `lipsyncService.generateLipsync()` | Preparation script | Generate lipsync JSON (one-time) |
| `audioService.transcribe()` | `/quiz/evaluate` | STT on user's voice answer |
| `llmService.chat()` | `/quiz/evaluate` | Evaluate user answer via Ollama |
| Upload middleware (`uploadAudio`) | `/quiz/evaluate` | Handle audio file upload |
| `WorkflowContext` / file utils | `/quiz/evaluate` | Temp directory organization |

Note: `audioService.synthesize()`, `audioService.saveToFile()`, and `lipsyncService.generateLipsync()` are **not** called at runtime — only in the preparation script. `/quiz/start` reads pre-generated files from disk.

---

## Implementation Order

0. **Add `id` to `questions.json`** — Assign UUID v4 to each question via `crypto.randomUUID()`.
1. **`scripts/generate-question-audio.ts`** — Preparation script. Run with `--limit 5` for initial testing.
2. **`quiz.types.ts`** — Define `QuizQuestion`, `QuizStartResponse`, `QuizEvaluateRequest`, `QuizEvaluateResponse`.
3. **`quiz.service.ts`** — Load `questions.json`, random selection, read pre-generated audio/lipsync from disk, Ollama evaluation prompt builder, response parser.
4. **`quiz.controller.ts`** — Wire up the two handlers, orchestrate service calls (disk reads, STT, LLM).
5. **`quiz.routes.ts`** — Define Express routes, attach upload middleware to `/quiz/evaluate`.
6. **Register routes in `app.ts`** — Add `app.use('/quiz', quizRoutes)`.
7. **Manual testing** — curl / Postman against both endpoints.

---

## Open Questions

1. **Question count configurable?** Hardcoded to 5. Accept `?count=N` query param on `/quiz/start`?
2. **Answer field in questions.json** — All `"a"` fields empty. Pre-fill expected answers to give Ollama better eval context, or open-ended eval sufficient?
3. **Frontend scope** — This PRD is backend-only. Frontend needs quiz UI (start button, progress, answer recording, result display). Separate PRD?
4. **Question categories** — `questions.json` has implicit categories (hobbies, work, travel). Support filtering by category on `/quiz/start`?
5. **Retry / skip** — Can user skip a question or re-record answer before submitting?
