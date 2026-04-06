// tools/m5/ir-builder.ts
// Builds ExpertIR from knowledge and sequence format expert data.

import { detectFormat } from './detector.ts';
import { mapGameType } from './game-type-mapper.ts';
import type { ExpertIR, IRAsset, IRParamSpec } from './types.ts';

/** Standard EH components that don't map to AIGE modules — filter these out. */
const STANDARD_EH_COMPONENTS = new Set([
  'ExtraDataTransform',
  'EffectNodeEditor',
  'ScreenTransformComponentEditor',
  'Transform',
  'RenderOrder',
]);

const MAX_TREE_DEPTH = 20;

interface TreeResult {
  readonly assets: readonly IRAsset[];
  readonly unmapped: readonly string[];
}

/**
 * Build an ExpertIR from a parsed expert JSON file.
 * Returns null for utility files (not convertible to presets).
 */
export function buildIR(filename: string, data: unknown): ExpertIR | null {
  const format = detectFormat(data);
  if (format === 'utility') return null;

  const obj = data as Record<string, unknown>;
  const id = filenameToId(filename);
  const title = filenameToTitle(filename);
  const description = typeof obj.description === 'string' ? obj.description : '';
  const gameTypeHint = typeof obj.game_type === 'string' ? obj.game_type : null;
  const aigeGameType = mapGameType(filename, obj);

  const tags: string[] = ['expert-import', format];
  if (gameTypeHint) tags.push(`eh:${gameTypeHint}`);

  if (format === 'knowledge') {
    return buildFromKnowledge(id, title, description, gameTypeHint, aigeGameType, tags, obj, filename);
  }
  return buildFromSequence(id, title, description, gameTypeHint, aigeGameType, tags, obj, filename);
}

function buildFromKnowledge(
  id: string,
  title: string,
  description: string,
  gameTypeHint: string | null,
  aigeGameType: string,
  tags: string[],
  data: Record<string, unknown>,
  filename: string,
): ExpertIR {
  const root = data.root as Record<string, unknown> | undefined;
  const treeResult: TreeResult = root
    ? walkSceneTree(root, 0)
    : { assets: [], unmapped: [] };

  return {
    id,
    title,
    description,
    gameTypeHint,
    aigeGameType,
    tags,
    params: [],
    assets: dedupeAssets(treeResult.assets),
    moduleHints: [],
    unmappedComponents: [...new Set(treeResult.unmapped)],
    sourcePath: filename,
    confidence: 0,
  };
}

function buildFromSequence(
  id: string,
  title: string,
  description: string,
  gameTypeHint: string | null,
  aigeGameType: string,
  tags: string[],
  data: Record<string, unknown>,
  filename: string,
): ExpertIR {
  const inputs = data.decompose_inputs;
  const params: IRParamSpec[] = Array.isArray(inputs)
    ? inputs
        .filter((v): v is string => typeof v === 'string')
        .map((name) => ({ name, type: inferParamType(name) }))
    : [];

  const commands = data.command_sequence;
  const assets: readonly IRAsset[] = Array.isArray(commands)
    ? extractAssetsFromCommands(commands)
    : [];

  return {
    id,
    title,
    description,
    gameTypeHint,
    aigeGameType,
    tags,
    params,
    assets: dedupeAssets(assets),
    moduleHints: [],
    unmappedComponents: [],
    sourcePath: filename,
    confidence: 0,
  };
}

// ── Helpers ──

function filenameToId(filename: string): string {
  return (
    'expert-' +
    filename
      .replace(/\.json$/i, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
  );
}

function filenameToTitle(filename: string): string {
  return filename
    .replace(/\.json$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferParamType(name: string): string {
  const lower = name.toLowerCase();
  if (/position|size|offset|scale/.test(lower)) return 'vec2';
  if (/texture|image|sprite|asset/.test(lower)) return 'assetId';
  if (/opacity|alpha|speed|velocity|radius|duration/.test(lower)) return 'number';
  if (/color/.test(lower)) return 'color';
  if (/enabled|visible|active/.test(lower)) return 'boolean';
  return 'string';
}

/** Recursively walk a scene tree node, returning collected assets and unmapped components. */
function walkSceneTree(node: Record<string, unknown>, depth: number): TreeResult {
  if (depth > MAX_TREE_DEPTH) return { assets: [], unmapped: [] };

  // Collect unmapped components from this node
  const components = node.components;
  const nodeUnmapped: string[] = Array.isArray(components)
    ? components.filter((c): c is string => typeof c === 'string' && !STANDARD_EH_COMPONENTS.has(c))
    : [];

  // Collect assets from componentsWithProperties
  const cwp = node.componentsWithProperties;
  const nodeAssets: IRAsset[] = (cwp && typeof cwp === 'object')
    ? extractAssetsFromObject(cwp as Record<string, unknown>)
    : [];

  // Recurse into children and merge results
  const children = node.children;
  if (!Array.isArray(children)) return { assets: nodeAssets, unmapped: nodeUnmapped };

  const childResults = children
    .filter((c): c is Record<string, unknown> => c != null && typeof c === 'object')
    .map((c) => walkSceneTree(c, depth + 1));

  return {
    assets: [
      ...nodeAssets,
      ...childResults.flatMap((r) => r.assets),
    ],
    unmapped: [
      ...nodeUnmapped,
      ...childResults.flatMap((r) => r.unmapped),
    ],
  };
}

/** Extract asset references from command sequence arguments. */
function extractAssetsFromCommands(commands: unknown[]): readonly IRAsset[] {
  return commands.flatMap((cmd) => {
    if (!cmd || typeof cmd !== 'object') return [];
    const args = (cmd as Record<string, unknown>).arguments;
    if (!args || typeof args !== 'object') return [];
    return extractAssetsFromObject(args as Record<string, unknown>);
  });
}

/** Recursively search an object for texture/asset references. Returns found assets. */
function extractAssetsFromObject(obj: Record<string, unknown>): IRAsset[] {
  const results: IRAsset[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const rec = value as Record<string, unknown>;
      if ('asset' in rec && typeof rec.asset === 'string') {
        results.push({ id: `asset-${results.length}`, type: 'image', src: rec.asset });
      } else {
        results.push(...extractAssetsFromObject(rec));
      }
    } else if (key === 'texture' && typeof value === 'string') {
      results.push({ id: `asset-${results.length}`, type: 'image', src: value });
    }
  }

  return results;
}

function dedupeAssets(assets: readonly IRAsset[]): IRAsset[] {
  const seen = new Set<string>();
  const result: IRAsset[] = [];
  for (const a of assets) {
    if (!seen.has(a.src)) {
      seen.add(a.src);
      result.push({ ...a, id: `asset-${result.length}` });
    }
  }
  return result;
}
