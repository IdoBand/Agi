import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config/index.js';
import { KnowledgeEntry, KnowledgeManifest } from '../../types/tutor.types.js';
import { logger } from '../../utils/logger.js';

let manifestCache: KnowledgeManifest | null = null;

async function loadManifest(): Promise<KnowledgeManifest> {
  if (manifestCache) return manifestCache;
  const manifestPath = path.join(config.tutor.knowledgeDir, 'manifest.json');
  const raw = await fs.readFile(manifestPath, 'utf-8');
  manifestCache = JSON.parse(raw) as KnowledgeManifest;
  logger.info(`[knowledge] loaded ${manifestCache.entries.length} entries from ${manifestPath}`);
  return manifestCache;
}

export async function listKnowledge(): Promise<KnowledgeEntry[]> {
  const m = await loadManifest();
  return m.entries;
}

export async function getKnowledgeFile(requestedPath: string): Promise<string> {
  const m = await loadManifest();
  const entry = m.entries.find((e) => e.path === requestedPath);
  if (!entry) throw new Error(`Unknown knowledge path: ${requestedPath}`);

  const root = path.resolve(config.tutor.knowledgeDir);
  const resolved = path.resolve(root, entry.path);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error(`Path traversal blocked: ${requestedPath}`);
  }
  return fs.readFile(resolved, 'utf-8');
}
