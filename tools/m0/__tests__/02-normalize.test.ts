import { describe, it, expect } from 'vitest';
import { loadInventory } from '../io/expert-inventory';
import {
  normalizeExpert,
  isKnowledge,
  isCommand,
  isTemplate,
  isSnapshot,
  type NormalizedExpert,
} from '../schema/guards';
import { EXPERT_DATA_DIR, canRunOfflinePipelineTests } from './test-helpers';

const EXPERT_DIR = EXPERT_DATA_DIR;

describe.skipIf(!canRunOfflinePipelineTests())('Schema Guards & Normalizer', () => {
  let allDocs: Array<{ filename: string; raw: Record<string, unknown>; category: string }>;

  beforeAll(async () => {
    const inv = await loadInventory(EXPERT_DIR);
    allDocs = [
      ...inv.knowledge.map((i) => ({ ...i, category: 'knowledge' })),
      ...inv.commands.map((i) => ({ ...i, category: 'command' })),
      ...inv.templates.map((i) => ({ ...i, category: 'template' })),
      ...inv.snapshots.map((i) => ({ ...i, category: 'snapshot' })),
    ];
  });

  describe('type guards', () => {
    it('isKnowledge matches knowledge docs', () => {
      const knowledgeDocs = allDocs.filter((d) => d.category === 'knowledge');
      for (const doc of knowledgeDocs) {
        expect(isKnowledge(doc.raw), `${doc.filename} should be knowledge`).toBe(true);
      }
    });

    it('isCommand matches command docs', () => {
      const cmdDocs = allDocs.filter((d) => d.category === 'command');
      for (const doc of cmdDocs) {
        expect(isCommand(doc.raw), `${doc.filename} should be command`).toBe(true);
      }
    });
  });

  describe('normalizeExpert', () => {
    it('normalizes all 80 docs without throwing', () => {
      for (const doc of allDocs) {
        expect(() => normalizeExpert(doc.raw, doc.filename)).not.toThrow();
      }
    });

    it('every normalized doc has kind and filename', () => {
      for (const doc of allDocs) {
        const norm = normalizeExpert(doc.raw, doc.filename);
        expect(norm.kind).toBeTruthy();
        expect(norm.filename).toBe(doc.filename);
        expect(['knowledge', 'command', 'template', 'snapshot']).toContain(norm.kind);
      }
    });

    it('knowledge docs get game_type lowercased and trimmed', () => {
      const knowledgeDocs = allDocs.filter((d) => d.category === 'knowledge');
      for (const doc of knowledgeDocs) {
        const norm = normalizeExpert(doc.raw, doc.filename);
        if (norm.kind === 'knowledge') {
          expect(norm.gameType).toBeTruthy();
          expect(norm.gameType).toBe(norm.gameType.trim().toLowerCase());
        }
      }
    });

    it('applies 1.5x scale to knowledge scene tree positions', () => {
      // MazeChase has position [0, 130] on Maze Background
      const mazeDoc = allDocs.find((d) => d.filename === 'MazeChase_knowledge.json');
      expect(mazeDoc).toBeDefined();
      const norm = normalizeExpert(mazeDoc!.raw, mazeDoc!.filename);
      if (norm.kind === 'knowledge' && norm.sceneTree) {
        // Find a node with non-zero position
        const bg = findNode(norm.sceneTree, 'Maze Background');
        expect(bg).toBeDefined();
        // Original: [0, 130] -> scaled: [0, 195]
        expect(bg!.position[1]).toBe(195);
      }
    });

    it('applies 1.5x scale to knowledge scene tree sizes', () => {
      const mazeDoc = allDocs.find((d) => d.filename === 'MazeChase_knowledge.json');
      const norm = normalizeExpert(mazeDoc!.raw, mazeDoc!.filename);
      if (norm.kind === 'knowledge' && norm.sceneTree) {
        const bg = findNode(norm.sceneTree, 'Maze Background');
        expect(bg).toBeDefined();
        // Original: [680, 720] -> scaled: [1020, 1080]
        expect(bg!.size[0]).toBe(1020);
        expect(bg!.size[1]).toBe(1080);
      }
    });

    it('command docs preserve command_sequence length', () => {
      const cmdDocs = allDocs.filter((d) => d.category === 'command');
      for (const doc of cmdDocs) {
        const norm = normalizeExpert(doc.raw, doc.filename);
        if (norm.kind === 'command') {
          const origLen = (doc.raw.command_sequence as unknown[]).length;
          expect(norm.steps.length).toBe(origLen);
        }
      }
    });
  });
});

// Helper to find a node by name in scene tree
function findNode(
  node: { objectName?: string; children?: unknown[] },
  name: string,
): { position: number[]; size: number[] } | undefined {
  if (node.objectName === name) return node as { position: number[]; size: number[] };
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findNode(child as { objectName?: string; children?: unknown[] }, name);
      if (found) return found;
    }
  }
  return undefined;
}
