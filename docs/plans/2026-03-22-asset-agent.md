# Asset Agent — 自动素材搜索/生成/去背/入库

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 游戏创建后自动为所有 asset 引用匹配或生成素材，经过背景移除处理后存入持久素材库，实现"创建即可视化"。

**Architecture:** AssetAgent 分析 GameConfig 中所有模块的 asset 引用，按优先级查找：素材库精确匹配 → 标签模糊匹配 → Gemini 生成。生成的图片经 `@imgly/background-removal` 去背（背景图除外），自动命名后存入 localStorage 持久素材库。PromptBuilder 根据游戏类型、主题、物品角色（好/坏/玩家/子弹）生成精准提示词。

**Tech Stack:** @imgly/background-removal (ONNX WASM), Gemini 2.0 Flash API, localStorage, TypeScript

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/services/asset-library.ts` (create) | 持久素材库 — localStorage 存储/搜索/命名 |
| `src/services/bg-remover.ts` (create) | 背景移除 — @imgly/background-removal 封装 |
| `src/services/prompt-builder.ts` (create) | 精准提示词生成 — 根据上下文构建 Gemini prompt |
| `src/services/asset-agent.ts` (create) | 素材 Agent 主控 — 搜索/生成/去背/入库 pipeline |
| `src/services/gemini-image.ts` (modify) | 添加 style 参数优化 |
| `src/ui/assets/asset-browser.tsx` (modify) | 显示素材库中的持久素材 |
| `src/ui/chat/chat-panel.tsx` (modify) | 游戏创建后自动触发 Asset Agent |
| `src/store/game-store.ts` (modify) | 添加批量更新 assets 方法 |

---

## Task 1: 素材库 — AssetLibrary

**Files:**
- Create: `src/services/asset-library.ts`
- Test: `src/services/__tests__/asset-library.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/services/__tests__/asset-library.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { AssetLibrary } from '../asset-library';

describe('AssetLibrary', () => {
  let lib: AssetLibrary;

  beforeEach(() => {
    lib = new AssetLibrary();
    lib.clear();
  });

  it('should save and retrieve an asset', () => {
    lib.save({ name: '金色星星', tags: ['star', 'gold', 'catch'], type: 'sprite', src: 'data:image/png;base64,abc' });
    const results = lib.search('星星');
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('金色星星');
  });

  it('should search by tag', () => {
    lib.save({ name: '红色炸弹', tags: ['bomb', 'danger', 'dodge'], type: 'sprite', src: 'data:...' });
    lib.save({ name: '金色星星', tags: ['star', 'gold'], type: 'sprite', src: 'data:...' });
    const results = lib.searchByTag('bomb');
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('红色炸弹');
  });

  it('should find by asset key', () => {
    lib.save({ name: 'star', tags: ['star'], type: 'sprite', src: 'data:...' });
    const found = lib.findByKey('star');
    expect(found).toBeDefined();
  });

  it('should auto-generate unique name', () => {
    const name = lib.generateName('star', 'space');
    expect(name).toContain('star');
  });

  it('should persist across instances', () => {
    lib.save({ name: 'test', tags: ['test'], type: 'sprite', src: 'data:...' });
    const lib2 = new AssetLibrary();
    expect(lib2.getAll().length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Implement AssetLibrary**

```typescript
// src/services/asset-library.ts
export interface LibraryAsset {
  id: string;
  name: string;
  tags: string[];
  type: 'sprite' | 'sound' | 'background' | 'particle';
  src: string;          // data URL
  createdAt: string;
  gameType?: string;    // which game type it was created for
  theme?: string;       // which theme
}

const STORAGE_KEY = 'aige-asset-library';

export class AssetLibrary {
  private assets: LibraryAsset[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      this.assets = data ? JSON.parse(data) : [];
    } catch {
      this.assets = [];
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.assets));
    } catch {
      // Storage full — remove oldest assets
      if (this.assets.length > 50) {
        this.assets = this.assets.slice(-50);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.assets));
      }
    }
  }

  save(asset: Omit<LibraryAsset, 'id' | 'createdAt'>): LibraryAsset {
    const entry: LibraryAsset = {
      ...asset,
      id: `lib-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    this.assets.push(entry);
    this.persist();
    return entry;
  }

  /** Search by name (Chinese or English, fuzzy) */
  search(query: string): LibraryAsset[] {
    const q = query.toLowerCase();
    return this.assets.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  /** Search by exact tag match */
  searchByTag(tag: string): LibraryAsset[] {
    return this.assets.filter(a => a.tags.includes(tag));
  }

  /** Find by asset key (e.g., 'star', 'bomb') — exact match on tags or name */
  findByKey(key: string): LibraryAsset | undefined {
    return this.assets.find(a =>
      a.tags.includes(key) || a.name === key
    );
  }

  /** Find by key + theme for best match */
  findByKeyAndTheme(key: string, theme?: string): LibraryAsset | undefined {
    // Prefer same-theme match
    if (theme) {
      const themed = this.assets.find(a =>
        (a.tags.includes(key) || a.name === key) && a.theme === theme
      );
      if (themed) return themed;
    }
    return this.findByKey(key);
  }

  /** Generate a descriptive name for a new asset */
  generateName(assetKey: string, theme?: string): string {
    const NAMES: Record<string, string> = {
      star: '星星', apple: '苹果', coin: '金币', bomb: '炸弹',
      meteor: '流星', heart: '爱心', ghost: '幽灵', diamond: '钻石',
      gift: '礼物', rocket: '火箭', obstacle: '障碍物',
      target_normal: '标靶', target_gold: '金色标靶', target_small: '小标靶',
      bubble_red: '红泡泡', bubble_blue: '蓝泡泡', bubble_gold: '金泡泡',
    };
    const baseName = NAMES[assetKey] ?? assetKey;
    const themeName = theme ? `${theme}_` : '';
    return `${themeName}${baseName}`;
  }

  getAll(): LibraryAsset[] {
    return [...this.assets];
  }

  remove(id: string): void {
    this.assets = this.assets.filter(a => a.id !== id);
    this.persist();
  }

  clear(): void {
    this.assets = [];
    this.persist();
  }
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run src/services/__tests__/asset-library.test.ts
git add src/services/asset-library.ts src/services/__tests__/asset-library.test.ts
git commit -m "feat: add persistent AssetLibrary with search and auto-naming"
```

---

## Task 2: 背景移除 — BgRemover

**Files:**
- Create: `src/services/bg-remover.ts`

- [ ] **Step 1: Install @imgly/background-removal**

```bash
cd "G:/claude code/AIGE_DEMO/aige-studio"
npm install @imgly/background-removal
```

- [ ] **Step 2: Create BgRemover wrapper**

```typescript
// src/services/bg-remover.ts
import { removeBackground } from '@imgly/background-removal';

export class BgRemover {
  private initialized = false;

  /**
   * Remove background from a data URL image.
   * Returns a new data URL with transparent background.
   * Skips processing for 'background' type assets.
   */
  async remove(dataUrl: string): Promise<string> {
    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    // Run background removal (ONNX WASM, runs in browser)
    const resultBlob = await removeBackground(blob, {
      progress: (key: string, current: number, total: number) => {
        // Could expose progress callback in future
        console.log(`BgRemoval: ${key} ${Math.round((current / total) * 100)}%`);
      },
    });

    // Convert result blob back to data URL
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(resultBlob);
    });
  }
}
```

- [ ] **Step 3: Verify TypeScript, commit**

```bash
npx tsc --noEmit
git add src/services/bg-remover.ts
git commit -m "feat: add background removal service via @imgly/background-removal"
```

---

## Task 3: 提示词生成器 — PromptBuilder

**Files:**
- Create: `src/services/prompt-builder.ts`
- Test: `src/services/__tests__/prompt-builder.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/services/__tests__/prompt-builder.test.ts
import { describe, it, expect } from 'vitest';
import { PromptBuilder } from '../prompt-builder';

describe('PromptBuilder', () => {
  it('should build prompt for a good item in fruit theme', () => {
    const prompt = PromptBuilder.build('star', {
      gameType: 'catch',
      theme: 'fruit',
      role: 'good',
      style: 'cartoon',
    });
    expect(prompt).toContain('star');
    expect(prompt).toContain('cartoon');
    expect(prompt).toContain('collectible');
  });

  it('should build prompt for a bad item', () => {
    const prompt = PromptBuilder.build('bomb', {
      gameType: 'dodge',
      theme: 'space',
      role: 'bad',
      style: 'cartoon',
    });
    expect(prompt).toContain('bomb');
    expect(prompt).toContain('dangerous');
  });

  it('should build prompt for player character', () => {
    const prompt = PromptBuilder.build('player', {
      gameType: 'catch',
      theme: 'ocean',
      role: 'player',
      style: 'cartoon',
    });
    expect(prompt).toContain('character');
  });

  it('should build prompt for background', () => {
    const prompt = PromptBuilder.build('sky', {
      gameType: 'catch',
      theme: 'space',
      role: 'background',
      style: 'cartoon',
    });
    expect(prompt).toContain('background');
    expect(prompt).toContain('1080x1920');
  });
});
```

- [ ] **Step 2: Implement PromptBuilder**

```typescript
// src/services/prompt-builder.ts

export interface PromptContext {
  gameType: string;
  theme: string;
  role: 'good' | 'bad' | 'player' | 'bullet' | 'background';
  style: 'cartoon' | 'pixel' | 'flat' | 'realistic';
}

const THEME_AESTHETICS: Record<string, string> = {
  fruit: 'colorful, juicy, fresh produce market style',
  space: 'sci-fi, cosmic, neon glow, dark starfield',
  ocean: 'underwater, blue-green, coral reef, marine life',
  halloween: 'spooky, orange-purple, gothic, playful horror',
  candy: 'pastel, sweet, bubblegum pink, sugar-coated',
};

const ITEM_DESCRIPTIONS: Record<string, string> = {
  star: 'a shining star',
  apple: 'a ripe apple',
  coin: 'a golden coin',
  bomb: 'a round bomb with fuse',
  meteor: 'a flaming meteor',
  heart: 'a red heart',
  ghost: 'a cute ghost',
  diamond: 'a sparkling diamond',
  gift: 'a wrapped gift box',
  rocket: 'a small rocket',
  obstacle: 'a rocky obstacle',
  target_normal: 'a bullseye target',
  target_gold: 'a golden bullseye target',
  target_small: 'a small target',
  bubble_red: 'a red bubble',
  bubble_blue: 'a blue bubble',
  bubble_gold: 'a golden shiny bubble',
};

const STYLE_INSTRUCTIONS: Record<string, string> = {
  cartoon: 'cartoon style, bold outlines, vibrant colors, 2D flat shading',
  pixel: 'pixel art style, 32x32 grid, retro 8-bit aesthetic',
  flat: 'flat design, minimal shadows, clean geometric shapes, material design',
  realistic: 'semi-realistic, soft lighting, detailed textures, 3D rendered look',
};

export class PromptBuilder {
  static build(assetKey: string, ctx: PromptContext): string {
    const itemDesc = ITEM_DESCRIPTIONS[assetKey] ?? assetKey;
    const aesthetic = THEME_AESTHETICS[ctx.theme] ?? '';
    const styleInst = STYLE_INSTRUCTIONS[ctx.style] ?? STYLE_INSTRUCTIONS.cartoon;

    if (ctx.role === 'background') {
      return [
        `Generate a game background image, portrait orientation (1080x1920).`,
        `Scene: ${itemDesc}, ${aesthetic}.`,
        `Style: ${styleInst}.`,
        `No text, no characters, no UI elements. Seamless, immersive game world.`,
      ].join(' ');
    }

    const roleHint = {
      good: 'This is a positive collectible item the player wants to catch.',
      bad: 'This is a dangerous obstacle the player must avoid.',
      player: 'This is the main player character, should look friendly and heroic.',
      bullet: 'This is a small projectile, should look energetic and fast.',
    }[ctx.role] ?? '';

    return [
      `Generate a single game sprite icon: ${itemDesc}.`,
      `${roleHint}`,
      `Theme: ${aesthetic}.`,
      `Style: ${styleInst}.`,
      `Requirements: centered on canvas, facing camera, solid white background,`,
      `no shadows on background, suitable for a mobile game,`,
      `icon size roughly 80% of canvas. Single object only, no text.`,
    ].join(' ');
  }

  /** Determine role of an asset key based on game presets */
  static inferRole(assetKey: string): PromptContext['role'] {
    const badKeys = ['bomb', 'meteor', 'ghost', 'obstacle', 'enemy'];
    const playerKeys = ['player', 'character', 'hero', 'avatar'];
    const bgKeys = ['sky', 'space_bg', 'ocean_bg', 'background'];
    const bulletKeys = ['bullet', 'projectile', 'shot'];

    if (badKeys.some(k => assetKey.includes(k))) return 'bad';
    if (playerKeys.some(k => assetKey.includes(k))) return 'player';
    if (bgKeys.some(k => assetKey.includes(k))) return 'background';
    if (bulletKeys.some(k => assetKey.includes(k))) return 'bullet';
    return 'good';
  }
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run src/services/__tests__/prompt-builder.test.ts
git add src/services/prompt-builder.ts src/services/__tests__/prompt-builder.test.ts
git commit -m "feat: add PromptBuilder for precise Gemini asset generation prompts"
```

---

## Task 4: 素材 Agent — AssetAgent

**Files:**
- Create: `src/services/asset-agent.ts`
- Modify: `src/store/game-store.ts` — add `batchUpdateAssets` method

- [ ] **Step 1: Add batchUpdateAssets to game store**

```typescript
// In game-store.ts, add to interface and implementation:
batchUpdateAssets: (assets: Record<string, AssetEntry>) => void;

// Implementation:
batchUpdateAssets: (assets) =>
  set((state) => {
    if (!state.config) return state;
    return {
      config: {
        ...state.config,
        assets: { ...state.config.assets, ...assets },
      },
    };
  }),
```

- [ ] **Step 2: Implement AssetAgent**

```typescript
// src/services/asset-agent.ts
import { AssetLibrary, type LibraryAsset } from './asset-library';
import { BgRemover } from './bg-remover';
import { PromptBuilder } from './prompt-builder';
import { GeminiImageService, getGeminiImageService } from './gemini-image';
import type { GameConfig, AssetEntry } from '@/engine/core';

export interface AssetFulfillProgress {
  total: number;
  completed: number;
  current: string;   // asset key being processed
  status: 'searching' | 'generating' | 'removing_bg' | 'saving' | 'done' | 'error';
  message: string;
}

export type ProgressCallback = (progress: AssetFulfillProgress) => void;

export class AssetAgent {
  private library = new AssetLibrary();
  private bgRemover = new BgRemover();

  /**
   * Analyze a GameConfig and fulfill all asset references.
   * Returns a map of assetKey → data URL for all resolved assets.
   */
  async fulfillAssets(
    config: GameConfig,
    onProgress?: ProgressCallback,
  ): Promise<Record<string, AssetEntry>> {
    // 1. Extract all asset keys from module params
    const assetKeys = this.extractAssetKeys(config);
    const theme = config.meta.theme ?? 'fruit';
    const gameType = this.inferGameType(config);
    const result: Record<string, AssetEntry> = {};
    const total = assetKeys.length;

    for (let i = 0; i < assetKeys.length; i++) {
      const key = assetKeys[i];

      // Step A: Search library (by key + theme)
      onProgress?.({
        total, completed: i, current: key,
        status: 'searching',
        message: `搜索素材库: ${key}`,
      });

      const existing = this.library.findByKeyAndTheme(key, theme);
      if (existing) {
        result[key] = { type: existing.type, src: existing.src };
        continue;
      }

      // Step B: Generate with Gemini
      const gemini = getGeminiImageService();
      if (!gemini) {
        // No API key — skip generation
        continue;
      }

      const role = PromptBuilder.inferRole(key);
      const prompt = PromptBuilder.build(key, {
        gameType,
        theme,
        role,
        style: 'cartoon',
      });

      onProgress?.({
        total, completed: i, current: key,
        status: 'generating',
        message: `AI 生成中: ${key}`,
      });

      let dataUrl: string;
      try {
        dataUrl = await gemini.generateImage(prompt);
      } catch (err) {
        onProgress?.({
          total, completed: i, current: key,
          status: 'error',
          message: `生成失败: ${key} — ${err}`,
        });
        continue;
      }

      // Step C: Remove background (unless it's a background asset)
      if (role !== 'background') {
        onProgress?.({
          total, completed: i, current: key,
          status: 'removing_bg',
          message: `去除背景: ${key}`,
        });

        try {
          dataUrl = await this.bgRemover.remove(dataUrl);
        } catch (err) {
          // Background removal failed — use original
          console.warn(`BgRemoval failed for ${key}:`, err);
        }
      }

      // Step D: Save to library
      onProgress?.({
        total, completed: i, current: key,
        status: 'saving',
        message: `保存素材: ${key}`,
      });

      const assetType: AssetEntry['type'] = role === 'background' ? 'background' : 'sprite';
      const name = this.library.generateName(key, theme);
      this.library.save({
        name,
        tags: [key, theme, gameType, role],
        type: assetType,
        src: dataUrl,
        gameType,
        theme,
      });

      result[key] = { type: assetType, src: dataUrl };
    }

    onProgress?.({
      total, completed: total, current: '',
      status: 'done',
      message: `素材处理完成！共处理 ${total} 个素材`,
    });

    return result;
  }

  /** Extract all unique asset keys from module params */
  private extractAssetKeys(config: GameConfig): string[] {
    const keys = new Set<string>();

    for (const mod of config.modules) {
      // Spawner.items[].asset
      const items = mod.params.items as Array<{ asset: string }> | undefined;
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item.asset) keys.add(item.asset);
        }
      }

      // Randomizer items
      const randItems = mod.params.items as Array<{ asset: string }> | undefined;
      if (mod.type === 'Randomizer' && Array.isArray(randItems)) {
        for (const item of randItems) {
          if (item.asset) keys.add(item.asset);
        }
      }
    }

    // Also check config.assets for any existing references
    for (const key of Object.keys(config.assets)) {
      keys.add(key);
    }

    return [...keys];
  }

  /** Infer game type from config modules */
  private inferGameType(config: GameConfig): string {
    const types = config.modules.map(m => m.type);
    if (types.includes('QuizEngine')) return 'quiz';
    if (types.includes('Randomizer')) return 'random-wheel';
    if (types.includes('Runner')) return 'runner';
    if (types.includes('ExpressionDetector')) return 'expression';
    if (types.includes('GestureMatch')) return 'gesture';
    if (types.includes('MatchEngine')) return 'puzzle';
    if (types.includes('BranchStateMachine')) return 'narrative';
    if (types.includes('DressUpEngine')) return 'dress-up';
    return 'catch';
  }

  /** Get the library instance for UI access */
  getLibrary(): AssetLibrary {
    return this.library;
  }
}
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit
git add src/services/asset-agent.ts src/store/game-store.ts
git commit -m "feat: add AssetAgent — auto search/generate/remove-bg/save pipeline"
```

---

## Task 5: 集成到 UI — 游戏创建后自动触发

**Files:**
- Modify: `src/ui/chat/chat-panel.tsx` — 游戏创建后自动调用 AssetAgent
- Modify: `src/ui/assets/asset-browser.tsx` — 显示素材库内容

- [ ] **Step 1: Add auto-fulfill after game creation**

In chat-panel.tsx, after `setConfig(config)` is called (both wizard completion and Mode B):

```typescript
// After config is set:
const assetAgent = new AssetAgent();
assetAgent.fulfillAssets(config, (progress) => {
  // Update chat with progress messages
  // "搜索素材库: star" → "AI 生成中: star" → "去除背景: star" → "保存素材: star"
}).then((assets) => {
  if (Object.keys(assets).length > 0) {
    batchUpdateAssets(assets);
    addChatMessage({
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `🎨 已自动生成 ${Object.keys(assets).length} 个游戏素材！`,
      timestamp: Date.now(),
    });
  }
});
```

Show a progress message in chat while assets are being processed.

- [ ] **Step 2: Update AssetBrowser to show library assets**

In asset-browser.tsx, merge `AssetLibrary.getAll()` alongside prebuilt and user assets.

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit
npx vitest run
git add src/ui/ src/services/
git commit -m "feat: auto-trigger AssetAgent after game creation, show library in browser"
```

---

## Dependency Graph

```
Task 1: AssetLibrary (localStorage persistence)
  └→ Task 4: AssetAgent (uses library)
       └→ Task 5: UI Integration

Task 2: BgRemover (@imgly/background-removal)
  └→ Task 4: AssetAgent (uses bg removal)

Task 3: PromptBuilder (prompt generation)
  └→ Task 4: AssetAgent (uses prompt builder)
```

Tasks 1, 2, 3 are independent. Task 4 depends on all three. Task 5 depends on Task 4.
