import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';

export interface WorkflowContext {
  workflowId: string;
}

export function createWorkflowContext(): WorkflowContext {
  return { workflowId: uuidv4() };
}

export function getWorkflowInputDir(ctx: WorkflowContext): string {
  return path.join(config.paths.temp, ctx.workflowId, 'input');
}

export function getWorkflowOutputDir(ctx: WorkflowContext): string {
  return path.join(config.paths.temp, ctx.workflowId, 'output');
}

export async function createWorkflowFile(
  ctx: WorkflowContext,
  type: 'input' | 'output',
  filename: string,
  content?: Buffer | string
): Promise<string> {
  const dir = type === 'input' ? getWorkflowInputDir(ctx) : getWorkflowOutputDir(ctx);
  await ensureDir(dir);
  const filepath = path.join(dir, filename);
  if (content !== undefined) {
    await fs.writeFile(filepath, content);
  }
  return filepath;
}

export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

export async function createTempFile(
  extension: string,
  content?: Buffer
): Promise<string> {
  await ensureDir(config.paths.temp);
  const filename = `${uuidv4()}${extension}`;
  const filepath = path.join(config.paths.temp, filename);

  if (content) {
    await fs.writeFile(filepath, content);
  }

  return filepath;
}

export async function deleteTempFile(filepath: string): Promise<void> {
  try {
    await fs.unlink(filepath);
  } catch {
    // Ignore errors if file doesn't exist
  }
}

export async function readFileAsBase64(filepath: string): Promise<string> {
  const buffer = await fs.readFile(filepath);
  return buffer.toString('base64');
}

export async function writeBase64ToFile(
  base64: string,
  filepath: string
): Promise<void> {
  const buffer = Buffer.from(base64, 'base64');
  await fs.writeFile(filepath, buffer);
}
