// src/engine/systems/recipe-runner/preset-registry.ts
// Stores and queries PresetTemplates by id, gameType, tags, and text search.

import type { PresetTemplate } from './types';

export class PresetRegistry {
  private readonly templates = new Map<string, PresetTemplate>();

  register(template: PresetTemplate): void {
    if (this.templates.has(template.id)) {
      throw new Error(`Duplicate template id: "${template.id}"`);
    }
    this.templates.set(template.id, template);
  }

  registerAll(templates: readonly PresetTemplate[]): void {
    for (const t of templates) {
      this.register(t);
    }
  }

  unregister(id: string): boolean {
    return this.templates.delete(id);
  }

  get(id: string): PresetTemplate | undefined {
    return this.templates.get(id);
  }

  size(): number {
    return this.templates.size;
  }

  listAll(): readonly PresetTemplate[] {
    return [...this.templates.values()];
  }

  findByGameType(gameType: string): readonly PresetTemplate[] {
    return [...this.templates.values()].filter((t) => t.gameType === gameType);
  }

  findByTag(tag: string): readonly PresetTemplate[] {
    return [...this.templates.values()].filter((t) => t.tags.includes(tag));
  }

  findByTags(tags: readonly string[]): readonly PresetTemplate[] {
    return [...this.templates.values()].filter((t) =>
      tags.every((tag) => t.tags.includes(tag)),
    );
  }

  search(query: string): readonly PresetTemplate[] {
    const q = query.toLowerCase();
    return [...this.templates.values()].filter((t) => {
      const haystack = [t.title, t.description ?? '', t.id, t.gameType ?? '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  allRequiredModules(): readonly string[] {
    const set = new Set<string>();
    for (const t of this.templates.values()) {
      if (t.requiredModules) {
        for (const m of t.requiredModules) {
          set.add(m);
        }
      }
    }
    return [...set];
  }
}
