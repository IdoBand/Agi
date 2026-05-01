import { LipsyncData, FacialExpression } from './message.types.js';

export interface KnowledgeEntry {
  path: string;
  title: string;
  summary: string;
  tags: string[];
}

export interface KnowledgeManifest {
  entries: KnowledgeEntry[];
}

export interface TutorTurnResponse {
  content: string;
  audio: string;
  lipsync: LipsyncData;
  facialExpression: FacialExpression;
  userTranscript: string;
}

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
  toolCalls: ToolCallTrace[];
  startedAt: number;
  durationMs: number;
}
