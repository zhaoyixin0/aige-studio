import { describe, it, expect } from 'vitest';
import { loadInventory, type Inventory } from '../io/expert-inventory';
import path from 'path';

const EXPERT_DIR = path.resolve(__dirname, '../../../../expert-data/json');

describe('Expert JSON Inventory', () => {
  let inventory: Inventory;

  beforeAll(async () => {
    inventory = await loadInventory(EXPERT_DIR);
  });

  it('loads all 80 JSON files', () => {
    const total =
      inventory.knowledge.length +
      inventory.commands.length +
      inventory.templates.length +
      inventory.snapshots.length;
    expect(total).toBe(80);
  });

  it('categorizes knowledge files (>= 40)', () => {
    expect(inventory.knowledge.length).toBeGreaterThanOrEqual(40);
  });

  it('categorizes command files (>= 19)', () => {
    expect(inventory.commands.length).toBeGreaterThanOrEqual(19);
  });

  it('categorizes template files (>= 7)', () => {
    expect(inventory.templates.length).toBeGreaterThanOrEqual(7);
  });

  it('categorizes snapshot files (>= 9)', () => {
    expect(inventory.snapshots.length).toBeGreaterThanOrEqual(9);
  });

  it('every item has filename and raw data', () => {
    const allItems = [
      ...inventory.knowledge,
      ...inventory.commands,
      ...inventory.templates,
      ...inventory.snapshots,
    ];
    for (const item of allItems) {
      expect(item.filename).toBeTruthy();
      expect(item.filename.endsWith('.json')).toBe(true);
      expect(item.raw).toBeDefined();
      expect(typeof item.raw).toBe('object');
    }
  });

  it('knowledge items have game_type field', () => {
    for (const item of inventory.knowledge) {
      expect(item.raw).toHaveProperty('game_type');
    }
  });

  it('command items have command_sequence field', () => {
    for (const item of inventory.commands) {
      expect(item.raw).toHaveProperty('command_sequence');
      expect(Array.isArray(item.raw.command_sequence)).toBe(true);
    }
  });

  it('no duplicate filenames', () => {
    const allItems = [
      ...inventory.knowledge,
      ...inventory.commands,
      ...inventory.templates,
      ...inventory.snapshots,
    ];
    const filenames = allItems.map((i) => i.filename);
    expect(new Set(filenames).size).toBe(filenames.length);
  });
});
