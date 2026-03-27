const skillFiles = import.meta.glob('/src/knowledge/**/*.md', {
  query: '?raw',
  import: 'default',
});

/**
 * Convert PascalCase to kebab-case.
 * EnemyAI → enemy-ai, WaveSpawner → wave-spawner, IFrames → i-frames
 */
export function toKebabCase(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

export class SkillLoader {
  private cache = new Map<string, string>();

  async load(path: string): Promise<string> {
    if (this.cache.has(path)) return this.cache.get(path)!;
    const key = `/src/knowledge/${path}`;
    const loader = skillFiles[key];
    if (!loader) throw new Error(`Skill not found: ${path}`);
    const content = (await loader()) as string;
    this.cache.set(path, content);
    return content;
  }

  async loadForGameCreation(gameType: string): Promise<string> {
    const gameSkill = await this.load(`game-types/${gameType}.md`);
    const moduleNames = this.parseRequiredModules(gameSkill);
    const moduleSkills = await Promise.all(
      moduleNames.map((name) =>
        this.load(`modules/${name}.md`).catch(() => ''),
      ),
    );
    const wiring = await this.load('relations/module-wiring.md').catch(
      () => '',
    );
    return [gameSkill, ...moduleSkills.filter(Boolean), wiring].join('\n---\n');
  }

  async loadForModuleAdd(moduleType: string): Promise<string> {
    const category = this.findCategory(moduleType);
    const filename = toKebabCase(moduleType);
    const modSkill = await this.load(
      `modules/${category}/${filename}.md`,
    ).catch(() => '');
    const synergies = await this.load('relations/module-synergies.md').catch(
      () => '',
    );
    return [modSkill, synergies].filter(Boolean).join('\n---\n');
  }

  async loadForRecommendation(): Promise<string> {
    const synergies = await this.load('relations/module-synergies.md').catch(
      () => '',
    );
    const conflicts = await this.load('relations/module-conflicts.md').catch(
      () => '',
    );
    return [synergies, conflicts].filter(Boolean).join('\n---\n');
  }

  /**
   * Load a single module's knowledge document.
   * Converts PascalCase module name to kebab-case filename.
   */
  async loadModuleDoc(moduleType: string): Promise<string> {
    const category = this.findCategory(moduleType);
    const filename = toKebabCase(moduleType);
    return this.load(`modules/${category}/${filename}.md`).catch(() => '');
  }

  /**
   * Load contextually relevant knowledge for ConversationAgent.
   * Returns game-type doc + filtered wiring + filtered synergies.
   */
  async loadForConversation(
    gameType: string | null,
    currentModules: string[],
  ): Promise<string> {
    const sections: string[] = [];

    // 1. Game type document
    if (gameType) {
      const gameDoc = await this.load(`game-types/${gameType}.md`).catch(() => '');
      if (gameDoc) sections.push(gameDoc);
    }

    // 2. Module wiring filtered to relevant modules
    if (currentModules.length > 0) {
      const wiring = await this.load('relations/module-wiring.md').catch(() => '');
      if (wiring) {
        const filtered = this.filterSectionsByModules(wiring, currentModules);
        if (filtered) sections.push(filtered);
      }

      // 3. Module synergies filtered to relevant modules
      const synergies = await this.load('relations/module-synergies.md').catch(() => '');
      if (synergies) {
        const filtered = this.filterSectionsByModules(synergies, currentModules);
        if (filtered) sections.push(filtered);
      }
    }

    return sections.filter(Boolean).join('\n\n---\n\n');
  }

  /**
   * Filter markdown content to only include ### sections that mention
   * at least one module from the given list.
   * Splits on ### headings, keeps only sections with matching module names.
   */
  private filterSectionsByModules(
    content: string,
    modules: string[],
  ): string {
    // Split on both ## and ### headings to isolate sections
    const parts = content.split(/(?=^#{2,3} )/m);

    // Keep only ### sections mentioning at least one module (word-boundary match)
    const relevant = parts.filter((part) => {
      if (!part.startsWith('### ')) return false;
      return modules.some((mod) =>
        new RegExp(`\\b${mod}\\b`).test(part),
      );
    });

    if (relevant.length === 0) return '';

    return relevant.join('\n').trim();
  }

  private parseRequiredModules(skillContent: string): string[] {
    const match = skillContent.match(/##\s*必需模块[\s\S]*?\|([^|]+)\|/g);
    if (!match) return [];
    return match
      .map((m) => m.match(/\|\s*(\w+)\s*\|/)?.[1])
      .filter(Boolean) as string[];
  }

  private findCategory(moduleType: string): string {
    const input = [
      'FaceInput',
      'HandInput',
      'BodyInput',
      'TouchInput',
      'DeviceInput',
      'AudioInput',
    ];
    const feedback = [
      'GameFlow',
      'UIOverlay',
      'ResultScreen',
      'ParticleVFX',
      'SoundFX',
      'CameraFollow',
    ];
    if (input.includes(moduleType)) return 'input';
    if (feedback.includes(moduleType)) return 'feedback';
    return 'mechanic';
  }
}
