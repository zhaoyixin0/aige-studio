// tools/m0/cli/build-knowledge.ts
// Materializes M0 knowledge pipeline into src/knowledge/ JSON artifacts.
// Idempotent & deterministic (stable stringify, sorted outputs).

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import crypto from 'crypto';

import {
  loadInventory,
  normalizeExpert,
  extractParams,
  buildPresetOverlays,
  loadTaxonomy,
  buildRecipes,
  generateGameTypeCards,
  generateRecipeCards,
} from '../index';

interface FileHashEntry {
  readonly path: string;
  readonly sha256: string;
}

interface KnowledgeIndex {
  readonly generatedAt: string;
  readonly files: readonly FileHashEntry[];
}

function sortKeysDeep<T>(v: T): T {
  if (Array.isArray(v)) return v.map(sortKeysDeep) as unknown as T;
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    const obj = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      out[k] = sortKeysDeep(obj[k]);
    }
    return out as T;
  }
  return v;
}

function stableStringify(obj: unknown): string {
  return JSON.stringify(sortKeysDeep(obj), null, 2) + '\n';
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeTracked(
  filePath: string,
  content: string,
  tracked: FileHashEntry[],
  rootDir: string,
) {
  await fs.writeFile(filePath, content, 'utf8');
  tracked.push({
    path: path.relative(rootDir, filePath).replace(/\\/g, '/'),
    sha256: sha256(content),
  });
}

export async function buildKnowledgeArtifacts(
  expertDir: string,
  outDir: string,
): Promise<KnowledgeIndex> {
  const OUT_OVERLAYS = path.join(outDir, 'overlays');
  const OUT_CARDS_GT = path.join(outDir, 'cards', 'game-type');
  const OUT_CARDS_RE = path.join(outDir, 'cards', 'recipe');
  const OUT_INDEX = path.join(outDir, 'index');
  await Promise.all([
    ensureDir(OUT_OVERLAYS),
    ensureDir(OUT_CARDS_GT),
    ensureDir(OUT_CARDS_RE),
    ensureDir(OUT_INDEX),
  ]);

  const tracked: FileHashEntry[] = [];

  // 1. Load + normalize
  const inv = await loadInventory(expertDir);
  const taxonomy = loadTaxonomy();

  const knowledgeDocs = inv.knowledge.map((i) => normalizeExpert(i.raw, i.filename));
  const commandDocs = inv.commands.map((i) => normalizeExpert(i.raw, i.filename));
  const templateDocs = inv.templates.map((i) => normalizeExpert(i.raw, i.filename));

  // 2. Extract params, group by expert type
  const paramsByType = new Map<string, ReturnType<typeof extractParams>[]>();
  const knowledgeWithParams = knowledgeDocs
    .filter((d) => d.kind === 'knowledge')
    .map((doc) => {
      const params = extractParams(doc);
      const list = paramsByType.get(doc.gameType) ?? [];
      list.push(params);
      paramsByType.set(doc.gameType, list);
      return { doc, params };
    });

  // 3. Overlays
  const overlays = buildPresetOverlays(knowledgeWithParams);
  await writeTracked(
    path.join(OUT_OVERLAYS, 'presets.overlay.json'),
    stableStringify(overlays),
    tracked,
    outDir,
  );

  // 4. Cards
  const recipes = buildRecipes(commandDocs, templateDocs);
  const gameTypeCards = generateGameTypeCards(taxonomy, paramsByType);
  const recipeCards = generateRecipeCards(recipes);

  for (const c of [...gameTypeCards].sort((a, b) => a.id.localeCompare(b.id))) {
    await writeTracked(
      path.join(OUT_CARDS_GT, `${c.id}.card.json`),
      stableStringify(c),
      tracked,
      outDir,
    );
  }

  for (const c of [...recipeCards].sort((a, b) => a.id.localeCompare(b.id))) {
    await writeTracked(
      path.join(OUT_CARDS_RE, `${c.id}.card.json`),
      stableStringify(c),
      tracked,
      outDir,
    );
  }

  // 5. Index (written last, not included in own listing)
  tracked.sort((a, b) => a.path.localeCompare(b.path));
  const index: KnowledgeIndex = {
    generatedAt: new Date().toISOString(),
    files: tracked,
  };
  await fs.writeFile(
    path.join(OUT_INDEX, 'expert-knowledge.index.json'),
    stableStringify(index),
    'utf8',
  );

  return index;
}

// CLI entry point
async function runCli() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const expertDir = path.resolve(repoRoot, '..', 'expert-data', 'json');
  const outDir = path.join(repoRoot, 'src', 'knowledge');

  const start = Date.now();
  const index = await buildKnowledgeArtifacts(expertDir, outDir);
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  const gtCount = index.files.filter((f) => f.path.startsWith('cards/game-type/')).length;
  const reCount = index.files.filter((f) => f.path.startsWith('cards/recipe/')).length;

  // eslint-disable-next-line no-console
  console.log(`[build:knowledge] Done in ${elapsed}s`);
  // eslint-disable-next-line no-console
  console.log(`[build:knowledge] overlays: 1, game-type-cards: ${gtCount}, recipe-cards: ${reCount}, total: ${index.files.length}`);
}

if (typeof process !== 'undefined' && Array.isArray(process.argv)) {
  const invoked = process.argv[1] ?? '';
  if (/build-knowledge\.ts$/.test(invoked)) {
    runCli().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[build:knowledge] Failed:', err);
      process.exit(1);
    });
  }
}
