export interface KnowledgeEntry {
  path: string;
  title: string;
  summary: string;
  tags: string[];
}

export interface KnowledgeManifest {
  entries: KnowledgeEntry[];
}

export type TurnEvent =
  | { type: 'transcript'; text: string }
  | { type: 'sentence'; idx: number; hu: string }
  | { type: 'audio'; idx: number; base64: string }
  | { type: 'done'; fullHu: string };

export interface TutorEvalLogEntry {
  topic: string;
  correct: boolean;
  note: string;
  at: number;
}

export interface ToolCallTrace {
  name: string;
  input: unknown;
  output?: string;
  isError?: boolean;
}

export interface TurnTrace {
  userText: string;
  replyText: string;
  replyEn?: string;
  toolCalls: ToolCallTrace[];
  startedAt: number;
  durationMs: number;
}
