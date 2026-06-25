import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../../utils/logger.js';
import { ToolCallTrace, TurnTrace } from '../../types/tutor.types.js';
import { llmProvider } from './providers/llm-provider.factory.js';

const TRACE_DIR = path.resolve('logs/tutor-sessions');
const headerWritten = new Set<string>();

function formatNum(n: number): string {
  return n.toLocaleString('en-US');
}

function filePath(sessionId: string): string {
  return path.join(TRACE_DIR, `${sessionId}.md`);
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(TRACE_DIR, { recursive: true });
}

function truncate(s: string, max = 500): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}… [+${s.length - max} chars]`;
}

function formatTool(tc: ToolCallTrace): string {
  const args = JSON.stringify(tc.input);
  const out = tc.output === undefined ? '(no result)' : truncate(tc.output);
  const status = tc.isError ? ' ⚠ error' : '';
  return `- \`${tc.name}\` (${truncate(args, 300)}) →${status} ${out}`;
}

function renderTurn(t: TurnTrace): string {
  const ts = new Date(t.startedAt).toISOString();
  const lines: string[] = [];
  lines.push(`## Turn ${t.turnIndex} — ${ts} (${t.durationMs}ms)`);
  lines.push(`**Learner:** ${t.userText}`);
  if (t.llmUsage) {
    const u = t.llmUsage;
    lines.push(
      `**LLM:** ${u.sonnetCalls} LLM call${u.sonnetCalls === 1 ? '' : 's'} · ${formatNum(u.inputTokens)} in / ${formatNum(u.outputTokens)} out tokens`,
    );
  }
  if (t.toolCalls.length > 0) {
    lines.push('**Tools:**');
    for (const tc of t.toolCalls) lines.push(formatTool(tc));
  }
  lines.push(`**Examiner:** ${t.replyText}`);
  lines.push('');
  return lines.join('\n');
}

async function writeHeaderIfNeeded(sessionId: string): Promise<void> {
  if (headerWritten.has(sessionId)) return;
  const fp = filePath(sessionId);
  try {
    await fs.access(fp);
    headerWritten.add(sessionId);
    return;
  } catch {
    // file does not exist; write header
  }
  const header = `# Tutor session ${sessionId}\nstarted: ${new Date().toISOString()}\nprovider: ${llmProvider.name}\nmodel: ${llmProvider.model}\n\n`;
  await fs.writeFile(fp, header, 'utf8');
  headerWritten.add(sessionId);
}

export async function appendTurnTrace(sessionId: string, trace: TurnTrace): Promise<void> {
  try {
    await ensureDir();
    await writeHeaderIfNeeded(sessionId);
    await fs.appendFile(filePath(sessionId), renderTurn(trace), 'utf8');
  } catch (e) {
    logger.warn(`[tutor-trace] append failed: ${e}`);
  }
}

export async function rotateSessionTrace(sessionId: string): Promise<void> {
  try {
    const fp = filePath(sessionId);
    try {
      await fs.access(fp);
    } catch {
      headerWritten.delete(sessionId);
      return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotated = path.join(TRACE_DIR, `${sessionId}.${stamp}.md`);
    await fs.appendFile(fp, `\n--- session reset ---\n`, 'utf8');
    await fs.rename(fp, rotated);
  } catch (e) {
    logger.warn(`[tutor-trace] rotate failed: ${e}`);
  } finally {
    headerWritten.delete(sessionId);
  }
}
