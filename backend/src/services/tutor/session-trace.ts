import { promises as fs } from 'fs';
import path from 'path';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { ToolCallTrace, TurnTrace } from '../../types/tutor.types.js';

const TRACE_DIR = path.resolve('logs/tutor-sessions');
const turnCounters = new Map<string, number>();
const headerWritten = new Set<string>();

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

function renderTurn(n: number, t: TurnTrace): string {
  const ts = new Date(t.startedAt).toISOString();
  const lines: string[] = [];
  lines.push(`## Turn ${n} — ${ts} (${t.durationMs}ms)`);
  lines.push(`**Learner:** ${t.userText}`);
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
  const header = `# Tutor session ${sessionId}\nstarted: ${new Date().toISOString()}\nmodel: ${config.anthropic.model}\n\n`;
  await fs.writeFile(fp, header, 'utf8');
  headerWritten.add(sessionId);
}

export async function appendTurnTrace(sessionId: string, trace: TurnTrace): Promise<void> {
  try {
    await ensureDir();
    await writeHeaderIfNeeded(sessionId);
    const n = (turnCounters.get(sessionId) ?? 0) + 1;
    turnCounters.set(sessionId, n);
    await fs.appendFile(filePath(sessionId), renderTurn(n, trace), 'utf8');
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
      turnCounters.delete(sessionId);
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
    turnCounters.delete(sessionId);
    headerWritten.delete(sessionId);
  }
}
