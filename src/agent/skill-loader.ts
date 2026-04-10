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

// Expert knowledge cards from M0 pipeline
const expertCardFiles = import.meta.glob('/src/knowledge/cards/**/*.card.json', {
  query: '?raw',
  import: 'default',
  eager: false,
});

/** Raw shape of an expert card JSON file (see /src/knowledge/cards/game-type). */
export interface ExpertCardRaw {
  readonly id?: string;
  readonly displayName?: string;
  readonly group?: string;
  readonly expertDataCount?: number;
  readonly topModules?: readonly string[];
  readonly signatureParams?: Readonly<
    Record<string, { suggested: number; confidence: number }>
  >;
  readonly missingModules?: readonly string[];
  readonly supportedToday?: boolean;
}

export class SkillLoader {
  private cache = new Map<string, string>();
  private cardCache = new Map<string, string>();

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

  /**
   * Load a summary of expert knowledge cards for the given game type.
   * Returns a text prompt fragment for ConversationAgent, or empty string.
   */
  async loadExpertCardSummary(gameType: string): Promise<string> {
    const key = `/src/knowledge/cards/game-type/gametype-${gameType}.card.json`;
    const loader = expertCardFiles[key];
    if (!loader) return '';

    if (this.cardCache.has(key)) return this.cardCache.get(key)!;

    try {
      const raw = (await loader()) as string;
      const card = JSON.parse(raw);
      const summary = `[Expert Data: ${card.displayName ?? gameType}] ` +
        `Group: ${card.group ?? '?'}, ` +
        `Top modules: ${(card.topModules ?? []).join(', ')}, ` +
        `Supported: ${card.supportedToday ? 'yes' : 'no'}`;
      this.cardCache.set(key, summary);
      return summary;
    } catch {
      return '';
    }
  }

  /**
   * Load the raw expert card JSON for a game type.
   * Returns null when the card does not exist or parsing fails.
   *
   * Unlike loadExpertCardSummary / loadExpertCardRich, this exposes the full
   * structured data (including signatureParams with confidence scores) for
   * programmatic consumers such as preset-advice.detectSignatureDrift().
   */
  async loadExpertCardRaw(gameType: string): Promise<ExpertCardRaw | null> {
    const key = `/src/knowledge/cards/game-type/gametype-${gameType}.card.json`;
    const loader = expertCardFiles[key];
    if (!loader) return null;

    try {
      const raw = (await loader()) as string;
      return JSON.parse(raw) as ExpertCardRaw;
    } catch {
      return null;
    }
  }

  /**
   * Load a rich expert card summary for ConversationAgent system prompt.
   * Returns a multi-line text block with top modules, signature params, and gaps.
   */
  async loadExpertCardRich(gameType: string): Promise<string> {
    const key = `/src/knowledge/cards/game-type/gametype-${gameType}.card.json`;
    const loader = expertCardFiles[key];
    if (!loader) return '';

    const richKey = `rich:${key}`;
    if (this.cardCache.has(richKey)) return this.cardCache.get(richKey)!;

    try {
      const raw = (await loader()) as string;
      const card = JSON.parse(raw) as {
        displayName?: string;
        group?: string;
        expertDataCount?: number;
        topModules?: string[];
        signatureParams?: Record<string, { suggested: number; confidence: number }>;
        missingModules?: string[];
        supportedToday?: boolean;
      };
      const top = (card.topModules ?? []).slice(0, 6).join(', ');
      const sig = Object.entries(card.signatureParams ?? {})
        .filter(([, v]) => (v?.confidence ?? 0) >= 0.3)
        .slice(0, 6)
        .map(([k, v]) => `${k}: ${Math.round((v.suggested ?? 0) * 10) / 10}`)
        .join(', ');
      const missing = (card.missingModules ?? []).slice(0, 5).join(', ');
      const supported = card.supportedToday !== false;
      const lines = [
        `[Expert: ${card.displayName ?? gameType} (${card.expertDataCount ?? 0} games)]`,
        !supported ? '!! 注意: 引擎暂不完全支持该游戏类型，功能可能受限 !!' : '',
        top ? `推荐模块: ${top}` : '',
        sig ? `参考参数: ${sig}` : '',
        missing ? `缺失模块: ${missing}` : '',
      ].filter(Boolean).join('\n');
      this.cardCache.set(richKey, lines);
      return lines;
    } catch {
      return '';
    }
  }

  /**
   * Load compact summaries of recipe cards relevant to a game type.
   * Returns ≤ limit bullet-point lines, each ≤ 140 chars.
   */
  async loadRecipeCardSummaries(gameType: string, limit = 3): Promise<string[]> {
    const prefix = '/src/knowledge/cards/recipe/';
    const entries = Object.entries(expertCardFiles)
      .filter(([p]) => p.startsWith(prefix));

    const cards = await Promise.all(
      entries.map(async ([, loader]) => {
        try { return JSON.parse((await loader()) as string); }
        catch { return null; }
      }),
    );

    const terms = [gameType, ...gameType.split(/[-_]/)].map((t) => t.toLowerCase());
    const ranked = cards
      .filter(Boolean)
      .map((c: Record<string, unknown>) => ({
        c,
        score: terms.reduce(
          (s, t) => s + (`${String(c.id)} ${String(c.source)} ${String(c.description ?? '')}`.toLowerCase().includes(t) ? 1 : 0),
          0,
        ),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || String(a.c.id).localeCompare(String(b.c.id)))
      .slice(0, limit);

    return ranked.map(({ c }) => {
      const desc = String(c.description ?? '').slice(0, 80);
      const line = `- ${String(c.id)}: ${desc} (${String(c.stepCount ?? '?')} steps, ${String(c.complexity ?? '?')})`;
      return line.slice(0, 140);
    });
  }

  /**
   * Returns the list of game types that have expert card data available.
   */
  getAvailableExpertTypes(): string[] {
    const prefix = '/src/knowledge/cards/game-type/gametype-';
    return Object.keys(expertCardFiles)
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length).replace('.card.json', ''));
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
