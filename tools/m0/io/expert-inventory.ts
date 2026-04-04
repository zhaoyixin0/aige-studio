// tools/m0/io/expert-inventory.ts
// Reads expert JSON files and classifies them by format.

import fs from 'fs/promises';
import path from 'path';

export interface InventoryItem {
  readonly filename: string;
  readonly category: 'knowledge' | 'command' | 'template' | 'snapshot';
  readonly raw: Record<string, unknown>;
}

export interface Inventory {
  readonly knowledge: readonly InventoryItem[];
  readonly commands: readonly InventoryItem[];
  readonly templates: readonly InventoryItem[];
  readonly snapshots: readonly InventoryItem[];
}

function classify(data: Record<string, unknown>, filename: string): InventoryItem['category'] {
  const keys = Object.keys(data);

  // Commands: have command_sequence array
  if ('command_sequence' in data && Array.isArray(data.command_sequence)) {
    return 'command';
  }

  // Knowledge: have game_type with root/examples/description
  if ('game_type' in data) {
    return 'knowledge';
  }

  // Templates: have name+data structure
  if ('name' in data && 'data' in data) {
    return 'template';
  }

  // Multi-templates: filename hint or all values are objects (reusable patterns)
  if (filename.includes('template')) {
    return 'template';
  }

  // Snapshots: typically single key with nested object, or small set of top-level configs
  if (keys.length <= 3 && keys.every((k) => typeof data[k] === 'object' && data[k] !== null)) {
    return 'snapshot';
  }

  // Fallback: treat as snapshot
  return 'snapshot';
}

export async function loadInventory(dir: string): Promise<Inventory> {
  const entries = await fs.readdir(dir);
  const jsonFiles = entries.filter((f) => f.endsWith('.json')).sort();

  const items: InventoryItem[] = [];

  for (const filename of jsonFiles) {
    const filePath = path.join(dir, filename);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const raw = JSON.parse(content) as Record<string, unknown>;
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
      const category = classify(raw, filename);
      items.push({ filename, category, raw });
    } catch {
      // Skip malformed JSON files at system boundary
    }
  }

  return {
    knowledge: items.filter((i) => i.category === 'knowledge'),
    commands: items.filter((i) => i.category === 'command'),
    templates: items.filter((i) => i.category === 'template'),
    snapshots: items.filter((i) => i.category === 'snapshot'),
  };
}
