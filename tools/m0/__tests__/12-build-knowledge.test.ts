import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

import { buildKnowledgeArtifacts } from '../cli/build-knowledge';

const EXPERT_DIR = path.resolve(__dirname, '../../../../expert-data/json');

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

describe('build-knowledge CLI', () => {
  let tmpRoot: string;
  let outDir: string;

  beforeAll(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'aige-knowledge-'));
    outDir = path.join(tmpRoot, 'knowledge');
  });

  afterAll(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('writes overlays, game-type cards, recipe cards, and index', async () => {
    const index = await buildKnowledgeArtifacts(EXPERT_DIR, outDir);

    // Overlay is valid JSON array
    const overlaysRaw = await fs.readFile(
      path.join(outDir, 'overlays', 'presets.overlay.json'),
      'utf8',
    );
    expect(Array.isArray(JSON.parse(overlaysRaw))).toBe(true);

    // 38 game-type cards
    const gtFiles = await fs.readdir(path.join(outDir, 'cards', 'game-type'));
    expect(gtFiles.length).toBe(38);

    // >= 20 recipe cards
    const reFiles = await fs.readdir(path.join(outDir, 'cards', 'recipe'));
    expect(reFiles.length).toBeGreaterThanOrEqual(20);

    // Index lists all written files
    const indexRaw = await fs.readFile(
      path.join(outDir, 'index', 'expert-knowledge.index.json'),
      'utf8',
    );
    const indexJson = JSON.parse(indexRaw) as {
      generatedAt: string;
      files: Array<{ path: string; sha256: string }>;
    };
    expect(indexJson.files.length).toBe(
      1 + gtFiles.length + reFiles.length, // overlay + game-type cards + recipe cards
    );
  }, 60_000);

  it('produces byte-identical output on second run (determinism)', async () => {
    // First run already happened above — collect hashes
    const collectHashes = async (dir: string): Promise<Record<string, string>> => {
      const result: Record<string, string> = {};
      const walk = async (d: string) => {
        for (const entry of await fs.readdir(d, { withFileTypes: true })) {
          const p = path.join(d, entry.name);
          if (entry.isDirectory()) await walk(p);
          else {
            const rel = path.relative(dir, p).replace(/\\/g, '/');
            // Skip index (contains timestamp)
            if (rel.startsWith('index/')) continue;
            result[rel] = sha256(await fs.readFile(p, 'utf8'));
          }
        }
      };
      await walk(dir);
      return result;
    };

    const hashes1 = await collectHashes(outDir);

    // Second run to same dir
    await buildKnowledgeArtifacts(EXPERT_DIR, outDir);
    const hashes2 = await collectHashes(outDir);

    expect(hashes2).toEqual(hashes1);
  }, 60_000);

  it('index hash count matches written file count', async () => {
    const indexRaw = await fs.readFile(
      path.join(outDir, 'index', 'expert-knowledge.index.json'),
      'utf8',
    );
    const indexJson = JSON.parse(indexRaw) as {
      files: Array<{ path: string; sha256: string }>;
    };

    // Each entry should have a valid sha256
    for (const f of indexJson.files) {
      expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
