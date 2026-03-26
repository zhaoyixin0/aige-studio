const skillFiles = import.meta.glob('/src/knowledge/**/*.md', {
  query: '?raw',
  import: 'default',
});

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
    const modSkill = await this.load(
      `modules/${category}/${moduleType.toLowerCase()}.md`,
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
    ];
    if (input.includes(moduleType)) return 'input';
    if (feedback.includes(moduleType)) return 'feedback';
    return 'mechanic';
  }
}
