# AIGE Studio Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a modular social platform game creation tool where pre-built game modules are assembled via AI Agent and visual editor, with real-time camera-based preview and dual export (Web + .apjs).

**Architecture:** Web-first app using React + TypeScript. Runtime Engine dynamically instantiates pre-built GameModule classes based on a JSON Config. Agent (Claude API) only outputs structured configs, never writes game code. Modules communicate via EventBus (zero direct references). Skill-based knowledge base loaded on demand.

**Tech Stack:** React 18, TypeScript, Vite, PixiJS 8, MediaPipe (Face/Hands/Pose), Claude API, Zustand, Radix UI, Tailwind CSS, Vitest

**Design Doc:** `docs/plans/2026-03-22-aige-studio-design.md`

---

## Task 1: Project Scaffolding

**Files:**
- Create: `aige-studio/package.json`
- Create: `aige-studio/tsconfig.json`
- Create: `aige-studio/vite.config.ts`
- Create: `aige-studio/tailwind.config.ts`
- Create: `aige-studio/postcss.config.js`
- Create: `aige-studio/index.html`
- Create: `aige-studio/src/main.tsx`
- Create: `aige-studio/src/app/App.tsx`
- Create: `aige-studio/src/app/globals.css`
- Create: `aige-studio/vitest.config.ts`

**Step 1: Initialize project with Vite**

```bash
cd "G:/claude code/AIGE_DEMO"
npm create vite@latest aige-studio -- --template react-ts
cd aige-studio
```

**Step 2: Install core dependencies**

```bash
npm install pixi.js@^8 zustand @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-switch @radix-ui/react-slider @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-tooltip @anthropic-ai/sdk class-variance-authority clsx tailwind-merge lucide-react
npm install -D tailwindcss @tailwindcss/vite postcss vitest @testing-library/react @testing-library/jest-dom jsdom @types/node
```

**Step 3: Configure Tailwind CSS v4**

`aige-studio/src/app/globals.css`:
```css
@import "tailwindcss";
```

`aige-studio/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Step 4: Configure Vitest**

`aige-studio/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

`aige-studio/src/test-setup.ts`:
```typescript
import '@testing-library/jest-dom/vitest';
```

**Step 5: Create minimal App shell**

`aige-studio/src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import './app/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

`aige-studio/src/app/App.tsx`:
```tsx
export function App() {
  return (
    <div className="h-screen w-screen bg-gray-950 text-white flex items-center justify-center">
      <h1 className="text-2xl font-bold">AIGE Studio</h1>
    </div>
  );
}
```

**Step 6: Verify build and test run**

```bash
npm run dev        # Should open at localhost:5173 with "AIGE Studio"
npm run build      # Should succeed
npx vitest run     # Should pass (0 tests, no failures)
```

**Step 7: Commit**

```bash
git init
echo "node_modules\ndist\n.env\n*.local" > .gitignore
git add .
git commit -m "feat: scaffold AIGE Studio with Vite + React + TS + Tailwind + Vitest"
```

---

## Task 2: Engine Core — Types, EventBus, Engine

**Files:**
- Create: `src/engine/core/types.ts`
- Create: `src/engine/core/event-bus.ts`
- Create: `src/engine/core/engine.ts`
- Create: `src/engine/core/module-registry.ts`
- Create: `src/engine/core/index.ts`
- Test: `src/engine/core/__tests__/event-bus.test.ts`
- Test: `src/engine/core/__tests__/engine.test.ts`

**Step 1: Write EventBus test**

```typescript
// src/engine/core/__tests__/event-bus.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../event-bus';

describe('EventBus', () => {
  it('should emit and receive events', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('test', handler);
    bus.emit('test', { value: 42 });
    expect(handler).toHaveBeenCalledWith({ value: 42 });
  });

  it('should unsubscribe with off()', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('test', handler);
    bus.off('test', handler);
    bus.emit('test');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should support wildcard listeners', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('collision:*', handler);
    bus.emit('collision:hit', { a: 'bullet', b: 'enemy' });
    expect(handler).toHaveBeenCalledWith({ a: 'bullet', b: 'enemy' });
  });

  it('should clear all listeners for an event', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('test', h1);
    bus.on('test', h2);
    bus.clear('test');
    bus.emit('test');
    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it('should clear all listeners with clearAll()', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('a', handler);
    bus.on('b', handler);
    bus.clearAll();
    bus.emit('a');
    bus.emit('b');
    expect(handler).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/engine/core/__tests__/event-bus.test.ts
```
Expected: FAIL — module not found

**Step 3: Implement types**

```typescript
// src/engine/core/types.ts
export type EventHandler = (data?: any) => void;

export interface SchemaField {
  type: 'range' | 'number' | 'boolean' | 'select' | 'asset' | 'color' | 'rect' | 'enum[]' | 'asset[]' | 'collision-layers' | 'collision-rules' | 'object' | 'string';
  label: string;
  default?: any;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: string[];
  assetType?: string;
  fields?: Record<string, SchemaField>; // for nested objects
}

export type ModuleSchema = Record<string, SchemaField>;

export interface ModuleConfig {
  id: string;
  type: string;
  enabled: boolean;
  params: Record<string, any>;
}

export interface AssetEntry {
  type: 'sprite' | 'sound' | 'background' | 'particle';
  src: string;
}

export interface CanvasConfig {
  width: number;
  height: number;
  background?: string;
}

export interface GameMeta {
  name: string;
  description: string;
  thumbnail: string | null;
  createdAt: string;
}

export interface GameConfig {
  version: string;
  meta: GameMeta;
  canvas: CanvasConfig;
  modules: ModuleConfig[];
  assets: Record<string, AssetEntry>;
}

export interface GameModule {
  id: string;
  type: string;

  init(engine: GameEngine): void;
  update(dt: number): void;
  destroy(): void;

  getSchema(): ModuleSchema;
  configure(params: Record<string, any>): void;
  getParams(): Record<string, any>;

  onAttach(engine: GameEngine): void;
  onDetach(engine: GameEngine): void;
}

// Forward reference — full interface defined in engine.ts
export interface GameEngine {
  eventBus: EventBus;
  getModule(id: string): GameModule | undefined;
  getModulesByType(type: string): GameModule[];
  getAllModules(): GameModule[];
  getConfig(): GameConfig;
  getCanvas(): CanvasConfig;
}

// Re-export for convenience
import type { EventBus } from './event-bus';
```

**Step 4: Implement EventBus**

```typescript
// src/engine/core/event-bus.ts
import type { EventHandler } from './types';

export class EventBus {
  private listeners = new Map<string, Set<EventHandler>>();
  private wildcardListeners = new Map<string, Set<EventHandler>>();

  on(event: string, handler: EventHandler): void {
    if (event.endsWith(':*')) {
      const prefix = event.slice(0, -1); // "collision:" from "collision:*"
      if (!this.wildcardListeners.has(prefix)) {
        this.wildcardListeners.set(prefix, new Set());
      }
      this.wildcardListeners.get(prefix)!.add(handler);
    } else {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, new Set());
      }
      this.listeners.get(event)!.add(handler);
    }
  }

  off(event: string, handler: EventHandler): void {
    if (event.endsWith(':*')) {
      const prefix = event.slice(0, -1);
      this.wildcardListeners.get(prefix)?.delete(handler);
    } else {
      this.listeners.get(event)?.delete(handler);
    }
  }

  emit(event: string, data?: any): void {
    // Exact match
    this.listeners.get(event)?.forEach(handler => handler(data));

    // Wildcard match: "collision:hit" matches "collision:*"
    for (const [prefix, handlers] of this.wildcardListeners) {
      if (event.startsWith(prefix)) {
        handlers.forEach(handler => handler(data));
      }
    }
  }

  clear(event: string): void {
    this.listeners.delete(event);
  }

  clearAll(): void {
    this.listeners.clear();
    this.wildcardListeners.clear();
  }
}
```

**Step 5: Run EventBus tests**

```bash
npx vitest run src/engine/core/__tests__/event-bus.test.ts
```
Expected: All 5 tests PASS

**Step 6: Write Engine test**

```typescript
// src/engine/core/__tests__/engine.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '../engine';
import { ModuleRegistry } from '../module-registry';
import type { GameModule, GameEngine, ModuleSchema } from '../types';

// Test module factory
function createTestModule(id: string, type: string): GameModule {
  return {
    id,
    type,
    init: vi.fn(),
    update: vi.fn(),
    destroy: vi.fn(),
    getSchema: () => ({}),
    configure: vi.fn(),
    getParams: () => ({}),
    onAttach: vi.fn(),
    onDetach: vi.fn(),
  };
}

describe('Engine', () => {
  it('should add and retrieve modules', () => {
    const engine = new Engine();
    const mod = createTestModule('scorer_1', 'Scorer');
    engine.addModule(mod);
    expect(engine.getModule('scorer_1')).toBe(mod);
    expect(mod.onAttach).toHaveBeenCalledWith(engine);
  });

  it('should remove modules and call onDetach', () => {
    const engine = new Engine();
    const mod = createTestModule('scorer_1', 'Scorer');
    engine.addModule(mod);
    engine.removeModule('scorer_1');
    expect(engine.getModule('scorer_1')).toBeUndefined();
    expect(mod.onDetach).toHaveBeenCalledWith(engine);
    expect(mod.destroy).toHaveBeenCalled();
  });

  it('should call update on all modules each tick', () => {
    const engine = new Engine();
    const m1 = createTestModule('a', 'A');
    const m2 = createTestModule('b', 'B');
    engine.addModule(m1);
    engine.addModule(m2);
    engine.tick(16);
    expect(m1.update).toHaveBeenCalledWith(16);
    expect(m2.update).toHaveBeenCalledWith(16);
  });

  it('should get modules by type', () => {
    const engine = new Engine();
    const m1 = createTestModule('s1', 'Spawner');
    const m2 = createTestModule('s2', 'Spawner');
    const m3 = createTestModule('c1', 'Collision');
    engine.addModule(m1);
    engine.addModule(m2);
    engine.addModule(m3);
    expect(engine.getModulesByType('Spawner')).toEqual([m1, m2]);
  });
});
```

**Step 7: Implement Engine**

```typescript
// src/engine/core/engine.ts
import { EventBus } from './event-bus';
import type { GameModule, GameEngine, GameConfig, CanvasConfig } from './types';

const DEFAULT_CONFIG: GameConfig = {
  version: '1.0',
  meta: { name: '', description: '', thumbnail: null, createdAt: new Date().toISOString() },
  canvas: { width: 1080, height: 1920 },
  modules: [],
  assets: {},
};

export class Engine implements GameEngine {
  public eventBus = new EventBus();
  private modules = new Map<string, GameModule>();
  private config: GameConfig = DEFAULT_CONFIG;
  private running = false;
  private animFrameId: number | null = null;
  private lastTime = 0;

  // --- Module management ---

  addModule(module: GameModule): void {
    this.modules.set(module.id, module);
    module.init(this);
    module.onAttach(this);
  }

  removeModule(id: string): void {
    const module = this.modules.get(id);
    if (module) {
      module.onDetach(this);
      module.destroy();
      this.modules.delete(id);
    }
  }

  getModule(id: string): GameModule | undefined {
    return this.modules.get(id);
  }

  getModulesByType(type: string): GameModule[] {
    return Array.from(this.modules.values()).filter(m => m.type === type);
  }

  getAllModules(): GameModule[] {
    return Array.from(this.modules.values());
  }

  // --- Config ---

  loadConfig(config: GameConfig): void {
    this.config = config;
  }

  getConfig(): GameConfig {
    return this.config;
  }

  getCanvas(): CanvasConfig {
    return this.config.canvas;
  }

  // --- Game Loop ---

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }

  stop(): void {
    this.running = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  /** Manual tick for testing */
  tick(dt: number): void {
    for (const module of this.modules.values()) {
      module.update(dt);
    }
  }

  restart(): void {
    this.stop();
    // Destroy all modules
    for (const module of this.modules.values()) {
      module.destroy();
    }
    this.modules.clear();
    this.eventBus.clearAll();
  }

  private loop = (): void => {
    if (!this.running) return;
    const now = performance.now();
    const dt = (now - this.lastTime) / 1000; // seconds
    this.lastTime = now;
    this.tick(dt);
    this.animFrameId = requestAnimationFrame(this.loop);
  };
}
```

**Step 8: Implement ModuleRegistry**

```typescript
// src/engine/core/module-registry.ts
import type { GameModule } from './types';

type ModuleConstructor = new (id: string, params: Record<string, any>) => GameModule;

export class ModuleRegistry {
  private registry = new Map<string, ModuleConstructor>();

  register(type: string, ctor: ModuleConstructor): void {
    this.registry.set(type, ctor);
  }

  create(type: string, id: string, params: Record<string, any>): GameModule {
    const Ctor = this.registry.get(type);
    if (!Ctor) {
      throw new Error(`Unknown module type: ${type}`);
    }
    const module = new Ctor(id, params);
    return module;
  }

  has(type: string): boolean {
    return this.registry.has(type);
  }

  getTypes(): string[] {
    return Array.from(this.registry.keys());
  }
}
```

**Step 9: Create barrel export**

```typescript
// src/engine/core/index.ts
export { EventBus } from './event-bus';
export { Engine } from './engine';
export { ModuleRegistry } from './module-registry';
export type {
  EventHandler,
  SchemaField,
  ModuleSchema,
  ModuleConfig,
  AssetEntry,
  CanvasConfig,
  GameMeta,
  GameConfig,
  GameModule,
  GameEngine,
} from './types';
```

**Step 10: Run all tests**

```bash
npx vitest run
```
Expected: All tests PASS

**Step 11: Commit**

```bash
git add src/engine/
git commit -m "feat: implement engine core — EventBus, Engine, ModuleRegistry, types"
```

---

## Task 3: Base Module Class + First Modules (Scorer, Timer, Lives)

**Files:**
- Create: `src/engine/modules/base-module.ts`
- Create: `src/engine/modules/mechanic/scorer.ts`
- Create: `src/engine/modules/mechanic/timer.ts`
- Create: `src/engine/modules/mechanic/lives.ts`
- Test: `src/engine/modules/__tests__/scorer.test.ts`
- Test: `src/engine/modules/__tests__/timer.test.ts`
- Test: `src/engine/modules/__tests__/lives.test.ts`

**Step 1: Write BaseModule**

```typescript
// src/engine/modules/base-module.ts
import type { GameModule, GameEngine, ModuleSchema } from '../core';

export abstract class BaseModule implements GameModule {
  public id: string;
  public abstract type: string;
  protected engine!: GameEngine;
  protected params: Record<string, any>;

  constructor(id: string, params: Record<string, any> = {}) {
    this.id = id;
    const schema = this.getSchema();
    // Merge defaults from schema with provided params
    this.params = {};
    for (const [key, field] of Object.entries(schema)) {
      this.params[key] = params[key] ?? field.default;
    }
    // Also include params not in schema (passthrough)
    for (const [key, value] of Object.entries(params)) {
      if (!(key in this.params)) {
        this.params[key] = value;
      }
    }
  }

  init(engine: GameEngine): void {
    this.engine = engine;
  }

  abstract update(dt: number): void;
  abstract getSchema(): ModuleSchema;

  configure(params: Record<string, any>): void {
    Object.assign(this.params, params);
  }

  getParams(): Record<string, any> {
    return { ...this.params };
  }

  destroy(): void {
    // Override in subclass if needed
  }

  onAttach(engine: GameEngine): void {
    this.engine = engine;
  }

  onDetach(_engine: GameEngine): void {
    // Override in subclass if needed
  }

  protected emit(event: string, data?: any): void {
    this.engine.eventBus.emit(event, data);
  }

  protected on(event: string, handler: (data?: any) => void): void {
    this.engine.eventBus.on(event, handler);
  }
}
```

**Step 2: Write Scorer test**

```typescript
// src/engine/modules/__tests__/scorer.test.ts
import { describe, it, expect } from 'vitest';
import { Engine } from '../../core';
import { Scorer } from '../mechanic/scorer';

describe('Scorer', () => {
  it('should start with score 0', () => {
    const engine = new Engine();
    const scorer = new Scorer('scorer_1', { perHit: 10 });
    engine.addModule(scorer);
    expect(scorer.getScore()).toBe(0);
  });

  it('should increase score on hit event', () => {
    const engine = new Engine();
    const scorer = new Scorer('scorer_1', { perHit: 10 });
    engine.addModule(scorer);
    engine.eventBus.emit('collision:hit', {});
    expect(scorer.getScore()).toBe(10);
  });

  it('should track combo within time window', () => {
    const engine = new Engine();
    const scorer = new Scorer('scorer_1', {
      perHit: 10,
      combo: { enabled: true, window: 2, multiplier: [1, 1.5, 2, 3] },
    });
    engine.addModule(scorer);
    // First hit: 10 * 1 = 10
    engine.eventBus.emit('collision:hit', {});
    expect(scorer.getScore()).toBe(10);
    // Second hit within window: 10 * 1.5 = 15, total = 25
    engine.eventBus.emit('collision:hit', {});
    expect(scorer.getScore()).toBe(25);
  });

  it('should emit scorer:update on score change', () => {
    const engine = new Engine();
    const scorer = new Scorer('scorer_1', { perHit: 10 });
    engine.addModule(scorer);
    let emitted: any = null;
    engine.eventBus.on('scorer:update', (data) => { emitted = data; });
    engine.eventBus.emit('collision:hit', {});
    expect(emitted).toEqual({ score: 10, delta: 10, combo: 1 });
  });
});
```

**Step 3: Implement Scorer**

```typescript
// src/engine/modules/mechanic/scorer.ts
import { BaseModule } from '../base-module';
import type { ModuleSchema } from '../../core';

export class Scorer extends BaseModule {
  type = 'Scorer';
  private score = 0;
  private comboCount = 0;
  private lastHitTime = 0;

  getSchema(): ModuleSchema {
    return {
      perHit: { type: 'number', label: '每次命中得分', min: 1, max: 1000, default: 10 },
      combo: {
        type: 'object', label: '连击系统', default: { enabled: false, window: 2, multiplier: [1, 1.5, 2, 3] },
        fields: {
          enabled: { type: 'boolean', label: '启用连击', default: false },
          window: { type: 'range', label: '连击时间窗口', min: 0.5, max: 5, step: 0.5, default: 2, unit: '秒' },
          multiplier: { type: 'string', label: '连击倍率', default: '1,1.5,2,3' },
        },
      },
      deductOnMiss: { type: 'boolean', label: '漏接扣分', default: false },
      deductAmount: { type: 'number', label: '扣分数', min: 0, max: 100, default: 5 },
    };
  }

  init(engine: any): void {
    super.init(engine);
    this.on('collision:hit', (data) => this.onHit(data));
    if (this.params.deductOnMiss) {
      this.on('spawner:destroyed', (data) => {
        if (data?.reason === 'outOfBounds') this.onMiss();
      });
    }
  }

  update(_dt: number): void {
    // Combo timeout check
    if (this.params.combo?.enabled && this.comboCount > 0) {
      const now = performance.now() / 1000;
      if (now - this.lastHitTime > this.params.combo.window) {
        this.comboCount = 0;
      }
    }
  }

  private onHit(_data?: any): void {
    const now = performance.now() / 1000;
    const combo = this.params.combo;

    if (combo?.enabled) {
      if (now - this.lastHitTime <= combo.window) {
        this.comboCount++;
      } else {
        this.comboCount = 1;
      }
      this.lastHitTime = now;

      const multipliers = combo.multiplier;
      const idx = Math.min(this.comboCount - 1, multipliers.length - 1);
      const mult = multipliers[idx];
      const delta = Math.round(this.params.perHit * mult);
      this.score += delta;

      this.emit('scorer:update', { score: this.score, delta, combo: this.comboCount });
      if (this.comboCount >= 3) {
        this.emit(`scorer:combo:${this.comboCount}`, { combo: this.comboCount });
      }
    } else {
      this.comboCount = 1;
      this.score += this.params.perHit;
      this.emit('scorer:update', { score: this.score, delta: this.params.perHit, combo: 1 });
    }
  }

  private onMiss(): void {
    if (this.params.deductOnMiss) {
      this.score = Math.max(0, this.score - this.params.deductAmount);
      this.emit('scorer:update', { score: this.score, delta: -this.params.deductAmount, combo: 0 });
    }
  }

  getScore(): number {
    return this.score;
  }

  reset(): void {
    this.score = 0;
    this.comboCount = 0;
  }
}
```

**Step 4: Write Timer test**

```typescript
// src/engine/modules/__tests__/timer.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '../../core';
import { Timer } from '../mechanic/timer';

describe('Timer', () => {
  it('should count down and emit timer:end', () => {
    const engine = new Engine();
    const timer = new Timer('timer_1', { mode: 'countdown', duration: 3 });
    engine.addModule(timer);
    const endHandler = vi.fn();
    engine.eventBus.on('timer:end', endHandler);

    timer.update(1); // 2s left
    timer.update(1); // 1s left
    timer.update(1); // 0s left → emit
    expect(endHandler).toHaveBeenCalled();
  });

  it('should emit timer:tick every second', () => {
    const engine = new Engine();
    const timer = new Timer('timer_1', { mode: 'countdown', duration: 10 });
    engine.addModule(timer);
    const tickHandler = vi.fn();
    engine.eventBus.on('timer:tick', tickHandler);

    timer.update(0.5);
    timer.update(0.5); // 1 second passed
    expect(tickHandler).toHaveBeenCalledWith({ remaining: 9, elapsed: 1 });
  });

  it('should not go below zero', () => {
    const engine = new Engine();
    const timer = new Timer('timer_1', { mode: 'countdown', duration: 2 });
    engine.addModule(timer);
    timer.update(5);
    expect(timer.getRemaining()).toBe(0);
  });
});
```

**Step 5: Implement Timer**

```typescript
// src/engine/modules/mechanic/timer.ts
import { BaseModule } from '../base-module';
import type { ModuleSchema } from '../../core';

export class Timer extends BaseModule {
  type = 'Timer';
  private elapsed = 0;
  private finished = false;
  private lastTickSecond = 0;
  private paused = false;

  getSchema(): ModuleSchema {
    return {
      mode: { type: 'select', label: '模式', options: ['countdown', 'stopwatch'], default: 'countdown' },
      duration: { type: 'range', label: '时长', min: 5, max: 300, step: 5, default: 30, unit: '秒' },
      onEnd: { type: 'select', label: '结束时', options: ['finish', 'none'], default: 'finish' },
    };
  }

  init(engine: any): void {
    super.init(engine);
    this.on('gameflow:pause', () => { this.paused = true; });
    this.on('gameflow:resume', () => { this.paused = false; });
  }

  update(dt: number): void {
    if (this.finished || this.paused) return;

    this.elapsed += dt;

    const currentSecond = Math.floor(this.elapsed);
    if (currentSecond > this.lastTickSecond) {
      this.lastTickSecond = currentSecond;
      this.emit('timer:tick', {
        remaining: this.getRemaining(),
        elapsed: currentSecond,
      });
    }

    if (this.params.mode === 'countdown' && this.elapsed >= this.params.duration) {
      this.elapsed = this.params.duration;
      this.finished = true;
      this.emit('timer:end', {});
    }
  }

  getRemaining(): number {
    if (this.params.mode === 'countdown') {
      return Math.max(0, Math.ceil(this.params.duration - this.elapsed));
    }
    return Math.floor(this.elapsed);
  }

  getElapsed(): number {
    return this.elapsed;
  }

  reset(): void {
    this.elapsed = 0;
    this.finished = false;
    this.lastTickSecond = 0;
  }
}
```

**Step 6: Write Lives test**

```typescript
// src/engine/modules/__tests__/lives.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '../../core';
import { Lives } from '../mechanic/lives';

describe('Lives', () => {
  it('should start with configured count', () => {
    const engine = new Engine();
    const lives = new Lives('lives_1', { count: 3 });
    engine.addModule(lives);
    expect(lives.getCurrent()).toBe(3);
  });

  it('should decrease on damage event', () => {
    const engine = new Engine();
    const lives = new Lives('lives_1', { count: 3, events: { damage: -1 } });
    engine.addModule(lives);
    engine.eventBus.emit('collision:damage');
    expect(lives.getCurrent()).toBe(2);
  });

  it('should emit lives:zero when depleted', () => {
    const engine = new Engine();
    const lives = new Lives('lives_1', { count: 1, events: { damage: -1 } });
    engine.addModule(lives);
    const zeroHandler = vi.fn();
    engine.eventBus.on('lives:zero', zeroHandler);
    engine.eventBus.emit('collision:damage');
    expect(zeroHandler).toHaveBeenCalled();
  });

  it('should not go below zero', () => {
    const engine = new Engine();
    const lives = new Lives('lives_1', { count: 1, events: { damage: -1 } });
    engine.addModule(lives);
    engine.eventBus.emit('collision:damage');
    engine.eventBus.emit('collision:damage');
    expect(lives.getCurrent()).toBe(0);
  });
});
```

**Step 7: Implement Lives**

```typescript
// src/engine/modules/mechanic/lives.ts
import { BaseModule } from '../base-module';
import type { ModuleSchema } from '../../core';

export class Lives extends BaseModule {
  type = 'Lives';
  private current = 0;

  getSchema(): ModuleSchema {
    return {
      count: { type: 'number', label: '生命数', min: 1, max: 10, default: 3 },
      events: {
        type: 'object', label: '事件响应', default: { damage: -1 },
        fields: {
          damage: { type: 'number', label: 'damage 事件扣血', min: -5, max: 0, default: -1 },
        },
      },
      onZero: { type: 'select', label: '归零时', options: ['finish', 'none'], default: 'finish' },
    };
  }

  init(engine: any): void {
    super.init(engine);
    this.current = this.params.count;

    // Listen for configured damage events
    this.on('collision:damage', () => {
      this.decrease(Math.abs(this.params.events?.damage ?? 1));
    });
  }

  update(_dt: number): void {
    // Lives is event-driven, no per-frame logic
  }

  decrease(amount: number): void {
    if (this.current <= 0) return;
    this.current = Math.max(0, this.current - amount);
    this.emit('lives:change', { current: this.current, max: this.params.count });

    if (this.current <= 0) {
      this.emit('lives:zero', {});
    }
  }

  increase(amount: number): void {
    this.current = Math.min(this.params.count, this.current + amount);
    this.emit('lives:change', { current: this.current, max: this.params.count });
  }

  getCurrent(): number {
    return this.current;
  }

  reset(): void {
    this.current = this.params.count;
  }
}
```

**Step 8: Run all tests**

```bash
npx vitest run
```
Expected: All tests PASS

**Step 9: Commit**

```bash
git add src/engine/modules/
git commit -m "feat: add BaseModule, Scorer, Timer, Lives modules with tests"
```

---

## Task 4: GameFlow + Spawner + Collision Modules

**Files:**
- Create: `src/engine/modules/feedback/game-flow.ts`
- Create: `src/engine/modules/mechanic/spawner.ts`
- Create: `src/engine/modules/mechanic/collision.ts`
- Test: `src/engine/modules/__tests__/game-flow.test.ts`
- Test: `src/engine/modules/__tests__/spawner.test.ts`
- Test: `src/engine/modules/__tests__/collision.test.ts`

**Step 1: Write GameFlow test**

```typescript
// src/engine/modules/__tests__/game-flow.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '../../core';
import { GameFlow } from '../feedback/game-flow';

describe('GameFlow', () => {
  it('should start in ready state', () => {
    const engine = new Engine();
    const flow = new GameFlow('flow_1', {});
    engine.addModule(flow);
    expect(flow.getState()).toBe('ready');
  });

  it('should transition through states', () => {
    const engine = new Engine();
    const flow = new GameFlow('flow_1', { countdown: 0 });
    engine.addModule(flow);
    const stateHandler = vi.fn();
    engine.eventBus.on('gameflow:state', stateHandler);

    flow.transition('playing');
    expect(flow.getState()).toBe('playing');
    expect(stateHandler).toHaveBeenCalledWith({ state: 'playing', previous: 'ready' });
  });

  it('should transition to finished on timer:end', () => {
    const engine = new Engine();
    const flow = new GameFlow('flow_1', {});
    engine.addModule(flow);
    flow.transition('playing');
    engine.eventBus.emit('timer:end');
    expect(flow.getState()).toBe('finished');
  });

  it('should transition to finished on lives:zero', () => {
    const engine = new Engine();
    const flow = new GameFlow('flow_1', {});
    engine.addModule(flow);
    flow.transition('playing');
    engine.eventBus.emit('lives:zero');
    expect(flow.getState()).toBe('finished');
  });
});
```

**Step 2: Implement GameFlow**

```typescript
// src/engine/modules/feedback/game-flow.ts
import { BaseModule } from '../base-module';
import type { ModuleSchema } from '../../core';

export type GameState = 'ready' | 'countdown' | 'playing' | 'finished';

export class GameFlow extends BaseModule {
  type = 'GameFlow';
  private state: GameState = 'ready';
  private countdownRemaining = 0;

  getSchema(): ModuleSchema {
    return {
      countdown: { type: 'number', label: '开始倒计时', min: 0, max: 10, default: 3, unit: '秒' },
      onFinish: { type: 'select', label: '结束后', options: ['show_result', 'restart', 'none'], default: 'show_result' },
    };
  }

  init(engine: any): void {
    super.init(engine);
    this.on('timer:end', () => {
      if (this.state === 'playing') this.transition('finished');
    });
    this.on('lives:zero', () => {
      if (this.state === 'playing') this.transition('finished');
    });
  }

  update(dt: number): void {
    if (this.state === 'countdown') {
      this.countdownRemaining -= dt;
      if (this.countdownRemaining <= 0) {
        this.transition('playing');
      }
    }
  }

  transition(newState: GameState): void {
    const previous = this.state;
    this.state = newState;

    if (newState === 'countdown') {
      this.countdownRemaining = this.params.countdown;
      if (this.countdownRemaining <= 0) {
        this.state = 'playing';
        this.emit('gameflow:state', { state: 'playing', previous });
        return;
      }
    }

    this.emit('gameflow:state', { state: newState, previous });

    if (newState === 'playing') {
      this.emit('gameflow:resume', {});
    }
    if (newState === 'finished') {
      this.emit('gameflow:pause', {});
    }
  }

  getState(): GameState {
    return this.state;
  }

  reset(): void {
    this.state = 'ready';
    this.countdownRemaining = 0;
  }
}
```

**Step 3: Write Spawner test**

```typescript
// src/engine/modules/__tests__/spawner.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '../../core';
import { Spawner } from '../mechanic/spawner';

describe('Spawner', () => {
  it('should spawn objects at configured frequency', () => {
    const engine = new Engine();
    const spawner = new Spawner('spawner_1', {
      items: [{ asset: 'apple', weight: 100 }],
      speed: { min: 3, max: 5 },
      frequency: 1,
      spawnArea: { x: 0, y: 0, w: 1080, h: 100 },
      direction: 'down',
      maxCount: 10,
    });
    engine.addModule(spawner);

    const createdHandler = vi.fn();
    engine.eventBus.on('spawner:created', createdHandler);

    spawner.update(0.5); // Not yet
    expect(createdHandler).not.toHaveBeenCalled();
    spawner.update(0.5); // 1 second passed
    expect(createdHandler).toHaveBeenCalledTimes(1);
  });

  it('should respect maxCount', () => {
    const engine = new Engine();
    const spawner = new Spawner('spawner_1', {
      items: [{ asset: 'apple', weight: 100 }],
      speed: { min: 3, max: 5 },
      frequency: 0.1,
      spawnArea: { x: 0, y: 0, w: 100, h: 10 },
      direction: 'down',
      maxCount: 2,
    });
    engine.addModule(spawner);

    const createdHandler = vi.fn();
    engine.eventBus.on('spawner:created', createdHandler);

    // Enough time for many spawns, but maxCount=2
    for (let i = 0; i < 50; i++) {
      spawner.update(0.1);
    }
    expect(createdHandler.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('should pause on gameflow:pause', () => {
    const engine = new Engine();
    const spawner = new Spawner('spawner_1', {
      items: [{ asset: 'apple', weight: 100 }],
      speed: { min: 3, max: 5 },
      frequency: 0.5,
      spawnArea: { x: 0, y: 0, w: 100, h: 10 },
      direction: 'down',
      maxCount: 10,
    });
    engine.addModule(spawner);

    const createdHandler = vi.fn();
    engine.eventBus.on('spawner:created', createdHandler);

    engine.eventBus.emit('gameflow:pause');
    spawner.update(1);
    spawner.update(1);
    expect(createdHandler).not.toHaveBeenCalled();
  });
});
```

**Step 4: Implement Spawner**

```typescript
// src/engine/modules/mechanic/spawner.ts
import { BaseModule } from '../base-module';
import type { ModuleSchema } from '../../core';

export interface SpawnedObject {
  id: string;
  asset: string;
  x: number;
  y: number;
  speed: number;
  direction: string;
  rotation: number;
  rotationSpeed: number;
}

export class Spawner extends BaseModule {
  type = 'Spawner';
  private timer = 0;
  private objects: SpawnedObject[] = [];
  private paused = false;
  private nextId = 0;

  getSchema(): ModuleSchema {
    return {
      items: { type: 'asset[]', label: '生成物体', default: [] },
      speed: { type: 'object', label: '速度范围', default: { min: 2, max: 5 },
        fields: {
          min: { type: 'range', label: '最低', min: 0.5, max: 20, step: 0.5, default: 2 },
          max: { type: 'range', label: '最高', min: 0.5, max: 20, step: 0.5, default: 5 },
        },
      },
      frequency: { type: 'range', label: '生成间隔', min: 0.3, max: 5, step: 0.1, default: 1.5, unit: '秒' },
      spawnArea: { type: 'rect', label: '生成区域', default: { x: 0, y: 0, w: 1080, h: 100 } },
      direction: { type: 'select', label: '移动方向', options: ['down', 'up', 'left', 'right', 'random'], default: 'down' },
      maxCount: { type: 'number', label: '最大同屏数', min: 1, max: 50, default: 10 },
      rotation: { type: 'boolean', label: '物体自旋', default: false },
      rotationSpeed: { type: 'range', label: '自旋速度', min: 0.1, max: 10, step: 0.1, default: 1 },
    };
  }

  init(engine: any): void {
    super.init(engine);
    this.on('gameflow:pause', () => { this.paused = true; });
    this.on('gameflow:resume', () => { this.paused = false; });
    this.on('collision:hit', (data) => {
      // Remove hit objects
      if (data?.targetId) {
        this.removeObject(data.targetId);
      }
    });
  }

  update(dt: number): void {
    if (this.paused) return;

    // Spawn logic
    this.timer += dt;
    if (this.timer >= this.params.frequency && this.objects.length < this.params.maxCount) {
      this.timer = 0;
      this.spawn();
    }

    // Move objects
    const canvasH = this.engine?.getCanvas().height ?? 1920;
    const canvasW = this.engine?.getCanvas().width ?? 1080;
    const toRemove: string[] = [];

    for (const obj of this.objects) {
      const speed = obj.speed * 100; // pixels per second
      switch (obj.direction) {
        case 'down': obj.y += speed * dt; break;
        case 'up': obj.y -= speed * dt; break;
        case 'left': obj.x -= speed * dt; break;
        case 'right': obj.x += speed * dt; break;
      }

      if (this.params.rotation) {
        obj.rotation += obj.rotationSpeed * dt;
      }

      // Out of bounds check
      if (obj.y > canvasH + 100 || obj.y < -100 || obj.x > canvasW + 100 || obj.x < -100) {
        toRemove.push(obj.id);
      }
    }

    for (const id of toRemove) {
      this.removeObject(id);
      this.emit('spawner:destroyed', { objectId: id, reason: 'outOfBounds' });
    }
  }

  private spawn(): void {
    const area = this.params.spawnArea;
    const x = area.x + Math.random() * area.w;
    const y = area.y + Math.random() * area.h;
    const speed = this.params.speed.min + Math.random() * (this.params.speed.max - this.params.speed.min);
    const item = this.weightedRandom(this.params.items);
    const id = `${this.id}_obj_${this.nextId++}`;

    const obj: SpawnedObject = {
      id,
      asset: item?.asset ?? 'default',
      x,
      y,
      speed,
      direction: this.params.direction === 'random'
        ? ['down', 'up', 'left', 'right'][Math.floor(Math.random() * 4)]
        : this.params.direction,
      rotation: 0,
      rotationSpeed: this.params.rotation ? this.params.rotationSpeed : 0,
    };

    this.objects.push(obj);
    this.emit('spawner:created', { objectId: id, asset: obj.asset, x: obj.x, y: obj.y });
  }

  private weightedRandom(items: Array<{ asset: string; weight: number }>): { asset: string; weight: number } | undefined {
    if (!items || items.length === 0) return undefined;
    const totalWeight = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
    let r = Math.random() * totalWeight;
    for (const item of items) {
      r -= item.weight ?? 1;
      if (r <= 0) return item;
    }
    return items[items.length - 1];
  }

  removeObject(id: string): void {
    this.objects = this.objects.filter(o => o.id !== id);
  }

  getObjects(): SpawnedObject[] {
    return this.objects;
  }

  reset(): void {
    this.objects = [];
    this.timer = 0;
    this.nextId = 0;
  }
}
```

**Step 5: Write Collision test**

```typescript
// src/engine/modules/__tests__/collision.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '../../core';
import { Collision } from '../mechanic/collision';

describe('Collision', () => {
  it('should detect circle-circle collision', () => {
    const engine = new Engine();
    const collision = new Collision('collision_1', {
      rules: [{ a: 'player', b: 'items', event: 'hit', destroy: ['b'] }],
    });
    engine.addModule(collision);

    const hitHandler = vi.fn();
    engine.eventBus.on('collision:hit', hitHandler);

    collision.registerObject('player_1', 'player', { x: 100, y: 100, radius: 40 });
    collision.registerObject('item_1', 'items', { x: 110, y: 110, radius: 20 });

    collision.update(0.016);
    expect(hitHandler).toHaveBeenCalledWith(
      expect.objectContaining({ objectA: 'player_1', objectB: 'item_1' })
    );
  });

  it('should NOT detect collision when objects are far apart', () => {
    const engine = new Engine();
    const collision = new Collision('collision_1', {
      rules: [{ a: 'player', b: 'items', event: 'hit', destroy: ['b'] }],
    });
    engine.addModule(collision);

    const hitHandler = vi.fn();
    engine.eventBus.on('collision:hit', hitHandler);

    collision.registerObject('player_1', 'player', { x: 0, y: 0, radius: 20 });
    collision.registerObject('item_1', 'items', { x: 500, y: 500, radius: 20 });

    collision.update(0.016);
    expect(hitHandler).not.toHaveBeenCalled();
  });

  it('should unregister destroyed objects', () => {
    const engine = new Engine();
    const collision = new Collision('collision_1', {
      rules: [{ a: 'player', b: 'items', event: 'hit', destroy: ['b'] }],
    });
    engine.addModule(collision);

    collision.registerObject('player_1', 'player', { x: 100, y: 100, radius: 40 });
    collision.registerObject('item_1', 'items', { x: 100, y: 100, radius: 20 });

    collision.update(0.016); // Hit → item_1 destroyed
    const hitHandler = vi.fn();
    engine.eventBus.on('collision:hit', hitHandler);
    collision.update(0.016); // No more collision
    expect(hitHandler).not.toHaveBeenCalled();
  });
});
```

**Step 6: Implement Collision**

```typescript
// src/engine/modules/mechanic/collision.ts
import { BaseModule } from '../base-module';
import type { ModuleSchema } from '../../core';

interface CollisionObject {
  id: string;
  layer: string;
  x: number;
  y: number;
  radius: number;
}

interface CollisionRule {
  a: string;
  b: string;
  event: string;
  destroy?: string[]; // ['a'], ['b'], or ['a','b']
}

export class Collision extends BaseModule {
  type = 'Collision';
  private objects = new Map<string, CollisionObject>();
  private paused = false;

  getSchema(): ModuleSchema {
    return {
      rules: {
        type: 'collision-rules', label: '碰撞规则',
        default: [{ a: 'player', b: 'items', event: 'hit', destroy: ['b'] }],
      },
    };
  }

  init(engine: any): void {
    super.init(engine);
    this.on('gameflow:pause', () => { this.paused = true; });
    this.on('gameflow:resume', () => { this.paused = false; });
  }

  update(_dt: number): void {
    if (this.paused) return;

    const rules: CollisionRule[] = this.params.rules ?? [];
    const toDestroy = new Set<string>();

    for (const rule of rules) {
      const layerA = this.getObjectsByLayer(rule.a);
      const layerB = this.getObjectsByLayer(rule.b);

      for (const a of layerA) {
        if (toDestroy.has(a.id)) continue;
        for (const b of layerB) {
          if (toDestroy.has(b.id)) continue;
          if (a.id === b.id) continue;

          if (this.circlesOverlap(a, b)) {
            this.emit(`collision:${rule.event}`, {
              objectA: a.id,
              objectB: b.id,
              layerA: rule.a,
              layerB: rule.b,
              targetId: b.id,
              x: (a.x + b.x) / 2,
              y: (a.y + b.y) / 2,
            });

            if (rule.destroy?.includes('a')) toDestroy.add(a.id);
            if (rule.destroy?.includes('b')) toDestroy.add(b.id);
          }
        }
      }
    }

    for (const id of toDestroy) {
      this.objects.delete(id);
    }
  }

  registerObject(id: string, layer: string, shape: { x: number; y: number; radius: number }): void {
    this.objects.set(id, { id, layer, ...shape });
  }

  updateObject(id: string, position: { x: number; y: number }): void {
    const obj = this.objects.get(id);
    if (obj) {
      obj.x = position.x;
      obj.y = position.y;
    }
  }

  unregisterObject(id: string): void {
    this.objects.delete(id);
  }

  private getObjectsByLayer(layer: string): CollisionObject[] {
    return Array.from(this.objects.values()).filter(o => o.layer === layer);
  }

  private circlesOverlap(a: CollisionObject, b: CollisionObject): boolean {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < a.radius + b.radius;
  }

  reset(): void {
    this.objects.clear();
  }
}
```

**Step 7: Run all tests**

```bash
npx vitest run
```
Expected: All tests PASS

**Step 8: Commit**

```bash
git add src/engine/modules/
git commit -m "feat: add GameFlow, Spawner, Collision modules with tests"
```

---

## Task 5: Auto-Wiring + Config Loader

**Files:**
- Create: `src/engine/core/auto-wirer.ts`
- Create: `src/engine/core/config-loader.ts`
- Test: `src/engine/core/__tests__/auto-wirer.test.ts`
- Test: `src/engine/core/__tests__/config-loader.test.ts`
- Modify: `src/engine/core/index.ts` — add exports

**Step 1: Write AutoWirer test**

```typescript
// src/engine/core/__tests__/auto-wirer.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '../engine';
import { AutoWirer } from '../auto-wirer';
import { Spawner } from '../../modules/mechanic/spawner';
import { Collision } from '../../modules/mechanic/collision';
import { Scorer } from '../../modules/mechanic/scorer';
import { Lives } from '../../modules/mechanic/lives';

describe('AutoWirer', () => {
  it('should wire Spawner objects to Collision', () => {
    const engine = new Engine();
    const wirer = new AutoWirer();

    const spawner = new Spawner('s1', {
      items: [{ asset: 'apple', weight: 100 }],
      speed: { min: 3, max: 5 },
      frequency: 0.5,
      spawnArea: { x: 0, y: 0, w: 100, h: 10 },
      direction: 'down',
      maxCount: 10,
    });
    const collision = new Collision('c1', {
      rules: [{ a: 'player', b: 'items', event: 'hit', destroy: ['b'] }],
    });

    engine.addModule(spawner);
    engine.addModule(collision);
    wirer.wire(engine);

    // When spawner creates object, it should auto-register in collision
    const registerSpy = vi.spyOn(collision, 'registerObject');
    engine.eventBus.emit('spawner:created', { objectId: 'obj_1', asset: 'apple', x: 50, y: 10 });
    expect(registerSpy).toHaveBeenCalled();
  });
});
```

**Step 2: Implement AutoWirer**

```typescript
// src/engine/core/auto-wirer.ts
import type { Engine } from './engine';
import type { GameModule } from './types';

interface WiringRule {
  requires: string[];
  setup: (engine: Engine, modules: Map<string, GameModule>) => void;
}

const WIRING_RULES: WiringRule[] = [
  {
    // Spawner → Collision: auto-register spawned objects
    requires: ['Spawner', 'Collision'],
    setup: (engine, modules) => {
      const collisions = Array.from(modules.values()).filter(m => m.type === 'Collision');
      engine.eventBus.on('spawner:created', (data) => {
        for (const col of collisions) {
          (col as any).registerObject(data.objectId, 'items', {
            x: data.x, y: data.y, radius: 20,
          });
        }
      });
      engine.eventBus.on('spawner:destroyed', (data) => {
        for (const col of collisions) {
          (col as any).unregisterObject(data.objectId);
        }
      });
    },
  },
  {
    // Timer → GameFlow: timer end triggers finish
    // (Already handled in GameFlow.init via event listener)
    requires: ['Timer', 'GameFlow'],
    setup: () => { /* Handled internally */ },
  },
  {
    // Lives → GameFlow: lives zero triggers finish
    // (Already handled in GameFlow.init via event listener)
    requires: ['Lives', 'GameFlow'],
    setup: () => { /* Handled internally */ },
  },
];

export class AutoWirer {
  wire(engine: Engine): void {
    const modules = new Map<string, GameModule>();
    for (const mod of engine.getAllModules()) {
      modules.set(mod.id, mod);
    }

    const types = new Set(Array.from(modules.values()).map(m => m.type));

    for (const rule of WIRING_RULES) {
      if (rule.requires.every(t => types.has(t))) {
        rule.setup(engine, modules);
      }
    }
  }
}
```

**Step 3: Write ConfigLoader test**

```typescript
// src/engine/core/__tests__/config-loader.test.ts
import { describe, it, expect } from 'vitest';
import { Engine } from '../engine';
import { ModuleRegistry } from '../module-registry';
import { ConfigLoader } from '../config-loader';
import { Scorer } from '../../modules/mechanic/scorer';
import { Timer } from '../../modules/mechanic/timer';
import { Lives } from '../../modules/mechanic/lives';
import type { GameConfig } from '../types';

describe('ConfigLoader', () => {
  it('should create modules from config', () => {
    const registry = new ModuleRegistry();
    registry.register('Scorer', Scorer);
    registry.register('Timer', Timer);
    registry.register('Lives', Lives);

    const engine = new Engine();
    const loader = new ConfigLoader(registry);

    const config: GameConfig = {
      version: '1.0',
      meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
      canvas: { width: 1080, height: 1920 },
      modules: [
        { id: 'scorer_1', type: 'Scorer', enabled: true, params: { perHit: 20 } },
        { id: 'timer_1', type: 'Timer', enabled: true, params: { mode: 'countdown', duration: 30 } },
        { id: 'lives_1', type: 'Lives', enabled: false, params: { count: 3 } },
      ],
      assets: {},
    };

    loader.load(engine, config);

    expect(engine.getModule('scorer_1')).toBeDefined();
    expect(engine.getModule('timer_1')).toBeDefined();
    // Lives is disabled → should NOT be instantiated
    expect(engine.getModule('lives_1')).toBeUndefined();
  });
});
```

**Step 4: Implement ConfigLoader**

```typescript
// src/engine/core/config-loader.ts
import type { Engine } from './engine';
import type { GameConfig } from './types';
import type { ModuleRegistry } from './module-registry';
import { AutoWirer } from './auto-wirer';

export class ConfigLoader {
  private registry: ModuleRegistry;
  private wirer = new AutoWirer();

  constructor(registry: ModuleRegistry) {
    this.registry = registry;
  }

  load(engine: Engine, config: GameConfig): void {
    engine.loadConfig(config);

    // Create and add enabled modules
    for (const moduleConfig of config.modules) {
      if (!moduleConfig.enabled) continue;
      if (!this.registry.has(moduleConfig.type)) {
        console.warn(`Unknown module type: ${moduleConfig.type}, skipping`);
        continue;
      }
      const module = this.registry.create(moduleConfig.type, moduleConfig.id, moduleConfig.params);
      engine.addModule(module);
    }

    // Auto-wire modules
    this.wirer.wire(engine);
  }

  /** Apply incremental config changes without full reload */
  applyChanges(engine: Engine, changes: ConfigChange[]): void {
    for (const change of changes) {
      switch (change.op) {
        case 'add_module': {
          const mod = this.registry.create(change.type!, change.id!, change.params ?? {});
          engine.addModule(mod);
          this.wirer.wire(engine);
          break;
        }
        case 'remove_module': {
          engine.removeModule(change.id!);
          break;
        }
        case 'update_param': {
          const module = engine.getModule(change.moduleId!);
          if (module) module.configure(change.params!);
          break;
        }
        case 'enable_module': {
          // Re-create from config
          const config = engine.getConfig();
          const modConfig = config.modules.find(m => m.id === change.id);
          if (modConfig && this.registry.has(modConfig.type)) {
            const mod = this.registry.create(modConfig.type, modConfig.id, modConfig.params);
            engine.addModule(mod);
            this.wirer.wire(engine);
          }
          break;
        }
        case 'disable_module': {
          engine.removeModule(change.id!);
          break;
        }
      }
    }
  }
}

export interface ConfigChange {
  op: 'add_module' | 'remove_module' | 'update_param' | 'enable_module' | 'disable_module';
  id?: string;
  moduleId?: string;
  type?: string;
  params?: Record<string, any>;
}
```

**Step 5: Update barrel export**

Add to `src/engine/core/index.ts`:
```typescript
export { AutoWirer } from './auto-wirer';
export { ConfigLoader } from './config-loader';
export type { ConfigChange } from './config-loader';
```

**Step 6: Run all tests**

```bash
npx vitest run
```
Expected: All tests PASS

**Step 7: Commit**

```bash
git add src/engine/
git commit -m "feat: add AutoWirer and ConfigLoader for config-driven module assembly"
```

---

## Task 6: Remaining Mechanic Modules (DifficultyRamp, Randomizer, QuizEngine)

**Files:**
- Create: `src/engine/modules/mechanic/difficulty-ramp.ts`
- Create: `src/engine/modules/mechanic/randomizer.ts`
- Create: `src/engine/modules/mechanic/quiz-engine.ts`
- Test: `src/engine/modules/__tests__/difficulty-ramp.test.ts`
- Test: `src/engine/modules/__tests__/randomizer.test.ts`
- Test: `src/engine/modules/__tests__/quiz-engine.test.ts`

Follow the same TDD pattern as Task 3. Each module:
1. Write failing test → 2. Implement module → 3. Verify tests pass

**DifficultyRamp key behavior:**
- Listens to `timer:tick` or uses internal timer
- Every N seconds, adjusts a target module's params (e.g., increase speed, decrease frequency)
- Emits `difficulty:update` with changed values
- Target module receives changes via `configure()`

**Randomizer key behavior:**
- Holds an items array with weights
- On trigger (touch/timer), runs weighted random selection with optional spin animation
- Emits `randomizer:result` with selected item
- Supports wheel/slot-machine/card-flip visual modes

**QuizEngine key behavior:**
- Holds a questions array, each with text + options + correctIndex
- Cycles through questions on user answer
- Emits `quiz:question` (new question), `quiz:correct`, `quiz:wrong`
- Tracks score internally or delegates to Scorer

**Step (final): Commit**

```bash
git add src/engine/modules/mechanic/
git commit -m "feat: add DifficultyRamp, Randomizer, QuizEngine modules"
```

---

## Task 7: Feedback Modules (ParticleVFX, SoundFX, UIOverlay, ResultScreen)

**Files:**
- Create: `src/engine/modules/feedback/particle-vfx.ts`
- Create: `src/engine/modules/feedback/sound-fx.ts`
- Create: `src/engine/modules/feedback/ui-overlay.ts`
- Create: `src/engine/modules/feedback/result-screen.ts`
- Create: `src/engine/modules/index.ts` — barrel export for all modules

Follow same TDD pattern. These modules are event listeners that trigger visual/audio feedback:

**ParticleVFX:** Maps events to particle effect configs. In update(), advances particle lifecycles. Renderer reads particle state to draw them.

**SoundFX:** Maps events to sound asset IDs. Plays sounds via Web Audio API.

**UIOverlay:** Listens to `scorer:update`, `timer:tick`, `lives:change`, `scorer:combo:*`. Maintains HUD state (score display, timer display, hearts, combo popup). Renderer reads state to draw HUD.

**ResultScreen:** Activated on `gameflow:state` = finished. Collects final score, combo stats, rating. Exposes state for renderer.

**Step (final): Commit**

```bash
git add src/engine/modules/
git commit -m "feat: add feedback modules — ParticleVFX, SoundFX, UIOverlay, ResultScreen"
```

---

## Task 8: Input Modules + MediaPipe Tracking

**Files:**
- Create: `src/engine/tracking/face-tracker.ts`
- Create: `src/engine/tracking/hand-tracker.ts`
- Create: `src/engine/tracking/body-tracker.ts`
- Create: `src/engine/tracking/index.ts`
- Create: `src/engine/modules/input/face-input.ts`
- Create: `src/engine/modules/input/hand-input.ts`
- Create: `src/engine/modules/input/body-input.ts`
- Create: `src/engine/modules/input/touch-input.ts`
- Create: `src/engine/modules/input/device-input.ts`
- Create: `src/engine/modules/input/audio-input.ts`

**Step 1: Install MediaPipe**

```bash
npm install @mediapipe/tasks-vision
```

**Step 2: Implement FaceTracker wrapper**

```typescript
// src/engine/tracking/face-tracker.ts
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export interface FaceTrackingResult {
  headX: number;      // normalized 0-1
  headY: number;      // normalized 0-1
  headRotation: number;
  mouthOpen: number;  // 0-1
  leftEyeBlink: number;
  rightEyeBlink: number;
  smile: number;
  eyebrowRaise: number;
}

export class FaceTracker {
  private landmarker: FaceLandmarker | null = null;
  private lastResult: FaceTrackingResult | null = null;

  async init(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
    );
    this.landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      outputFaceBlendshapes: true,
      runningMode: 'VIDEO',
      numFaces: 1,
    });
  }

  detect(video: HTMLVideoElement, timestamp: number): FaceTrackingResult | null {
    if (!this.landmarker) return null;
    const result = this.landmarker.detectForVideo(video, timestamp);

    if (result.faceLandmarks.length === 0) return null;

    const landmarks = result.faceLandmarks[0];
    const blendshapes = result.faceBlendshapes?.[0]?.categories ?? [];

    const getBlendshape = (name: string): number => {
      return blendshapes.find(b => b.categoryName === name)?.score ?? 0;
    };

    // Nose tip position as head position
    const nose = landmarks[1];

    this.lastResult = {
      headX: nose.x,
      headY: nose.y,
      headRotation: 0, // simplified
      mouthOpen: getBlendshape('jawOpen'),
      leftEyeBlink: getBlendshape('eyeBlinkLeft'),
      rightEyeBlink: getBlendshape('eyeBlinkRight'),
      smile: getBlendshape('mouthSmileLeft') * 0.5 + getBlendshape('mouthSmileRight') * 0.5,
      eyebrowRaise: getBlendshape('browOuterUpLeft') * 0.5 + getBlendshape('browOuterUpRight') * 0.5,
    };

    return this.lastResult;
  }

  getLastResult(): FaceTrackingResult | null {
    return this.lastResult;
  }

  destroy(): void {
    this.landmarker?.close();
    this.landmarker = null;
  }
}
```

**Step 3: Implement FaceInput module**

```typescript
// src/engine/modules/input/face-input.ts
import { BaseModule } from '../base-module';
import type { ModuleSchema } from '../../core';
import type { FaceTracker, FaceTrackingResult } from '../../tracking/face-tracker';

export class FaceInput extends BaseModule {
  type = 'FaceInput';
  private tracker: FaceTracker | null = null;
  private smoothedX = 0.5;
  private smoothedY = 0.5;

  getSchema(): ModuleSchema {
    return {
      tracking: { type: 'select', label: '追踪模式', options: ['headXY', 'mouthOpen', 'eyeBlink', 'smile'], default: 'headXY' },
      smoothing: { type: 'range', label: '平滑系数', min: 0, max: 0.95, step: 0.05, default: 0.3 },
      sensitivity: { type: 'range', label: '灵敏度', min: 0.5, max: 3, step: 0.1, default: 1 },
      outputTo: { type: 'string', label: '输出目标', default: 'player' },
    };
  }

  setTracker(tracker: FaceTracker): void {
    this.tracker = tracker;
  }

  update(_dt: number): void {
    const result = this.tracker?.getLastResult();
    if (!result) return;

    const s = this.params.smoothing;
    const sens = this.params.sensitivity;
    const canvas = this.engine?.getCanvas();
    const w = canvas?.width ?? 1080;
    const h = canvas?.height ?? 1920;

    // Map normalized head position to canvas coordinates
    // Mirror X so moving head left → player moves left
    const rawX = (1 - result.headX) * w * sens;
    const rawY = result.headY * h * sens;

    this.smoothedX = this.smoothedX * s + rawX * (1 - s);
    this.smoothedY = this.smoothedY * s + rawY * (1 - s);

    this.emit('input:face:move', {
      x: this.smoothedX,
      y: this.smoothedY,
      raw: result,
    });

    // Emit specific face events
    if (result.mouthOpen > 0.5) {
      this.emit('input:face:mouthOpen', { value: result.mouthOpen });
    }
    if (result.leftEyeBlink > 0.5 && result.rightEyeBlink > 0.5) {
      this.emit('input:face:blink', {});
    }
    if (result.smile > 0.5) {
      this.emit('input:face:smile', { value: result.smile });
    }
  }

  getPosition(): { x: number; y: number } {
    return { x: this.smoothedX, y: this.smoothedY };
  }
}
```

**Step 4: Implement TouchInput, HandInput, BodyInput, DeviceInput, AudioInput**

Follow the same pattern. Each wraps its tracking source and emits standardized events.

**Step 5: Commit**

```bash
git add src/engine/tracking/ src/engine/modules/input/
git commit -m "feat: add MediaPipe tracking + input modules (Face, Hand, Body, Touch, Device, Audio)"
```

---

## Task 9: PixiJS Renderer

**Files:**
- Create: `src/engine/renderer/pixi-renderer.ts`
- Create: `src/engine/renderer/game-object.ts`
- Create: `src/engine/renderer/hud-renderer.ts`
- Create: `src/engine/renderer/camera-layer.ts`
- Create: `src/engine/renderer/index.ts`

**Step 1: Implement PixiRenderer**

```typescript
// src/engine/renderer/pixi-renderer.ts
import { Application, Container, Sprite, Text, Graphics } from 'pixi.js';
import type { Engine } from '../core/engine';
import type { SpawnedObject } from '../modules/mechanic/spawner';

export class PixiRenderer {
  private app: Application;
  private gameLayer = new Container();
  private hudLayer = new Container();
  private cameraLayer = new Container();
  private objectSprites = new Map<string, Sprite | Graphics>();
  private playerSprite: Graphics | null = null;

  constructor() {
    this.app = new Application();
  }

  async init(canvas: HTMLCanvasElement, width: number, height: number): Promise<void> {
    await this.app.init({
      canvas,
      width,
      height,
      backgroundColor: 0x111111,
      antialias: true,
    });

    // Layer order: camera (back) → game objects → HUD (front)
    this.app.stage.addChild(this.cameraLayer);
    this.app.stage.addChild(this.gameLayer);
    this.app.stage.addChild(this.hudLayer);
  }

  /** Called each frame to sync engine state → visual state */
  render(engine: Engine): void {
    // Sync spawned objects
    const spawners = engine.getModulesByType('Spawner');
    const activeIds = new Set<string>();

    for (const spawner of spawners) {
      const objects: SpawnedObject[] = (spawner as any).getObjects();
      for (const obj of objects) {
        activeIds.add(obj.id);
        let sprite = this.objectSprites.get(obj.id);
        if (!sprite) {
          // Create new sprite (placeholder circle for now)
          sprite = new Graphics();
          (sprite as Graphics).circle(0, 0, 20).fill({ color: 0xff6644 });
          this.gameLayer.addChild(sprite);
          this.objectSprites.set(obj.id, sprite);
        }
        sprite.x = obj.x;
        sprite.y = obj.y;
        sprite.rotation = obj.rotation;
      }
    }

    // Remove sprites for destroyed objects
    for (const [id, sprite] of this.objectSprites) {
      if (!activeIds.has(id)) {
        this.gameLayer.removeChild(sprite);
        sprite.destroy();
        this.objectSprites.delete(id);
      }
    }

    // Sync player position (from FaceInput)
    const faceInput = engine.getModulesByType('FaceInput')[0];
    if (faceInput) {
      const pos = (faceInput as any).getPosition();
      if (!this.playerSprite) {
        this.playerSprite = new Graphics();
        this.playerSprite.circle(0, 0, 40).fill({ color: 0x00ff88 });
        this.gameLayer.addChild(this.playerSprite);
      }
      this.playerSprite.x = pos.x;
      this.playerSprite.y = pos.y;

      // Update collision position
      const collision = engine.getModulesByType('Collision')[0];
      if (collision) {
        (collision as any).updateObject('player_1', pos);
      }
    }
  }

  setCameraFeed(video: HTMLVideoElement): void {
    // Render camera as background texture
    // Implementation uses PixiJS VideoSource
  }

  getApp(): Application {
    return this.app;
  }

  destroy(): void {
    this.app.destroy(true);
  }
}
```

**Step 2: Implement HUD renderer, camera layer**

These read UIOverlay module state and render score/timer/lives/combo text.

**Step 3: Commit**

```bash
git add src/engine/renderer/
git commit -m "feat: add PixiJS renderer with game objects, HUD, camera layers"
```

---

## Task 10: Zustand Store + Module Registry Setup

**Files:**
- Create: `src/store/game-store.ts`
- Create: `src/store/editor-store.ts`
- Create: `src/store/index.ts`
- Create: `src/engine/module-setup.ts` — registers all modules

**Step 1: Implement game store**

```typescript
// src/store/game-store.ts
import { create } from 'zustand';
import type { GameConfig, ModuleConfig } from '@/engine/core';

interface GameStore {
  config: GameConfig | null;
  setConfig: (config: GameConfig) => void;
  updateModuleParam: (moduleId: string, param: string, value: any) => void;
  addModule: (module: ModuleConfig) => void;
  removeModule: (moduleId: string) => void;
  toggleModule: (moduleId: string) => void;
  updateAsset: (assetId: string, src: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  config: null,

  setConfig: (config) => set({ config }),

  updateModuleParam: (moduleId, param, value) => set((state) => {
    if (!state.config) return state;
    const modules = state.config.modules.map(m => {
      if (m.id !== moduleId) return m;
      return { ...m, params: { ...m.params, [param]: value } };
    });
    return { config: { ...state.config, modules } };
  }),

  addModule: (module) => set((state) => {
    if (!state.config) return state;
    return { config: { ...state.config, modules: [...state.config.modules, module] } };
  }),

  removeModule: (moduleId) => set((state) => {
    if (!state.config) return state;
    const modules = state.config.modules.map(m =>
      m.id === moduleId ? { ...m, enabled: false } : m
    );
    return { config: { ...state.config, modules } };
  }),

  toggleModule: (moduleId) => set((state) => {
    if (!state.config) return state;
    const modules = state.config.modules.map(m =>
      m.id === moduleId ? { ...m, enabled: !m.enabled } : m
    );
    return { config: { ...state.config, modules } };
  }),

  updateAsset: (assetId, src) => set((state) => {
    if (!state.config) return state;
    const assets = { ...state.config.assets };
    if (assets[assetId]) {
      assets[assetId] = { ...assets[assetId], src };
    }
    return { config: { ...state.config, assets } };
  }),
}));
```

**Step 2: Create module-setup.ts**

```typescript
// src/engine/module-setup.ts
import { ModuleRegistry } from './core';
import { Scorer } from './modules/mechanic/scorer';
import { Timer } from './modules/mechanic/timer';
import { Lives } from './modules/mechanic/lives';
import { Spawner } from './modules/mechanic/spawner';
import { Collision } from './modules/mechanic/collision';
import { DifficultyRamp } from './modules/mechanic/difficulty-ramp';
import { Randomizer } from './modules/mechanic/randomizer';
import { QuizEngine } from './modules/mechanic/quiz-engine';
import { GameFlow } from './modules/feedback/game-flow';
import { ParticleVFX } from './modules/feedback/particle-vfx';
import { SoundFX } from './modules/feedback/sound-fx';
import { UIOverlay } from './modules/feedback/ui-overlay';
import { ResultScreen } from './modules/feedback/result-screen';
import { FaceInput } from './modules/input/face-input';
import { HandInput } from './modules/input/hand-input';
import { BodyInput } from './modules/input/body-input';
import { TouchInput } from './modules/input/touch-input';
import { DeviceInput } from './modules/input/device-input';
import { AudioInput } from './modules/input/audio-input';

export function createModuleRegistry(): ModuleRegistry {
  const registry = new ModuleRegistry();

  // Input
  registry.register('FaceInput', FaceInput as any);
  registry.register('HandInput', HandInput as any);
  registry.register('BodyInput', BodyInput as any);
  registry.register('TouchInput', TouchInput as any);
  registry.register('DeviceInput', DeviceInput as any);
  registry.register('AudioInput', AudioInput as any);

  // Mechanic
  registry.register('Spawner', Spawner as any);
  registry.register('Collision', Collision as any);
  registry.register('Scorer', Scorer as any);
  registry.register('Timer', Timer as any);
  registry.register('Lives', Lives as any);
  registry.register('DifficultyRamp', DifficultyRamp as any);
  registry.register('Randomizer', Randomizer as any);
  registry.register('QuizEngine', QuizEngine as any);

  // Feedback
  registry.register('GameFlow', GameFlow as any);
  registry.register('ParticleVFX', ParticleVFX as any);
  registry.register('SoundFX', SoundFX as any);
  registry.register('UIOverlay', UIOverlay as any);
  registry.register('ResultScreen', ResultScreen as any);

  return registry;
}
```

**Step 3: Commit**

```bash
git add src/store/ src/engine/module-setup.ts
git commit -m "feat: add Zustand game store and module registry setup"
```

---

## Task 11: UI Shell — 3-Panel Layout + Preview Canvas

**Files:**
- Create: `src/ui/layout/main-layout.tsx`
- Create: `src/ui/chat/chat-panel.tsx`
- Create: `src/ui/editor/editor-panel.tsx`
- Create: `src/ui/editor/module-list.tsx`
- Create: `src/ui/editor/properties-panel.tsx`
- Create: `src/ui/editor/schema-renderer.tsx`
- Create: `src/ui/preview/preview-canvas.tsx`
- Create: `src/ui/preview/preview-toolbar.tsx`
- Modify: `src/app/App.tsx` — use MainLayout

**Step 1: Build MainLayout (3-panel)**

```tsx
// src/ui/layout/main-layout.tsx
import { ChatPanel } from '../chat/chat-panel';
import { EditorPanel } from '../editor/editor-panel';
import { PreviewCanvas } from '../preview/preview-canvas';

export function MainLayout() {
  return (
    <div className="h-screen w-screen flex bg-gray-950 text-white overflow-hidden">
      {/* Left: Chat Panel */}
      <div className="w-80 border-r border-white/5 flex flex-col">
        <ChatPanel />
      </div>

      {/* Center: Preview */}
      <div className="flex-1 flex flex-col">
        <PreviewCanvas />
      </div>

      {/* Right: Editor Panel */}
      <div className="w-80 border-l border-white/5 flex flex-col">
        <EditorPanel />
      </div>
    </div>
  );
}
```

**Step 2: Build PreviewCanvas with PixiJS + camera**

```tsx
// src/ui/preview/preview-canvas.tsx
import { useRef, useEffect } from 'react';
import { PreviewToolbar } from './preview-toolbar';

export function PreviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  return (
    <div className="flex-1 flex flex-col">
      <PreviewToolbar />
      <div className="flex-1 relative bg-black flex items-center justify-center">
        <canvas ref={canvasRef} className="max-h-full max-w-full" />
      </div>
    </div>
  );
}
```

**Step 3: Build SchemaRenderer — auto-generates UI from module schema**

```tsx
// src/ui/editor/schema-renderer.tsx
import { Slider } from '@radix-ui/react-slider';
import { Switch } from '@radix-ui/react-switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@radix-ui/react-select';
import type { ModuleSchema, SchemaField } from '@/engine/core';

interface Props {
  schema: ModuleSchema;
  values: Record<string, any>;
  onChange: (param: string, value: any) => void;
}

export function SchemaRenderer({ schema, values, onChange }: Props) {
  return (
    <div className="space-y-4">
      {Object.entries(schema).map(([key, field]) => (
        <FieldRenderer
          key={key}
          name={key}
          field={field}
          value={values[key] ?? field.default}
          onChange={(v) => onChange(key, v)}
        />
      ))}
    </div>
  );
}

function FieldRenderer({ name, field, value, onChange }: {
  name: string; field: SchemaField; value: any; onChange: (v: any) => void;
}) {
  switch (field.type) {
    case 'range':
      return (
        <div>
          <label className="text-xs text-gray-400 mb-1 block">{field.label}</label>
          <div className="flex items-center gap-3">
            <Slider
              value={[value]}
              min={field.min}
              max={field.max}
              step={field.step}
              onValueChange={([v]) => onChange(v)}
              className="flex-1"
            />
            <span className="text-xs text-gray-300 w-12 text-right">
              {value}{field.unit ?? ''}
            </span>
          </div>
        </div>
      );
    case 'number':
      return (
        <div>
          <label className="text-xs text-gray-400 mb-1 block">{field.label}</label>
          <input
            type="number"
            value={value}
            min={field.min}
            max={field.max}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm"
          />
        </div>
      );
    case 'boolean':
      return (
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-400">{field.label}</label>
          <Switch checked={value} onCheckedChange={onChange} />
        </div>
      );
    case 'select':
      return (
        <div>
          <label className="text-xs text-gray-400 mb-1 block">{field.label}</label>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm"
          >
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      );
    default:
      return (
        <div>
          <label className="text-xs text-gray-400 mb-1 block">{field.label}</label>
          <input
            type="text"
            value={typeof value === 'object' ? JSON.stringify(value) : value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm"
          />
        </div>
      );
  }
}
```

**Step 4: Build ModuleList and PropertiesPanel**

ModuleList shows all enabled modules as cards. Clicking one opens PropertiesPanel, which uses SchemaRenderer with the selected module's schema.

**Step 5: Build ChatPanel shell**

Simple chat UI: message list + input field. Messages stored in a Zustand store. Agent integration comes in Task 13.

**Step 6: Commit**

```bash
git add src/ui/ src/app/
git commit -m "feat: build 3-panel UI shell — chat, editor, preview canvas"
```

---

## Task 12: Integrate Engine ↔ UI ↔ Preview

**Files:**
- Create: `src/app/hooks/use-engine.ts`
- Create: `src/app/hooks/use-camera.ts`
- Create: `src/app/hooks/use-game-loop.ts`
- Modify: `src/ui/preview/preview-canvas.tsx` — connect to engine
- Modify: `src/ui/editor/properties-panel.tsx` — connect to engine

**Step 1: Create useEngine hook**

```typescript
// src/app/hooks/use-engine.ts
import { useRef, useEffect, useCallback } from 'react';
import { Engine, ConfigLoader } from '@/engine/core';
import { createModuleRegistry } from '@/engine/module-setup';
import { PixiRenderer } from '@/engine/renderer/pixi-renderer';
import type { GameConfig } from '@/engine/core';

export function useEngine(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const engineRef = useRef<Engine | null>(null);
  const rendererRef = useRef<PixiRenderer | null>(null);
  const registryRef = useRef(createModuleRegistry());
  const loaderRef = useRef(new ConfigLoader(registryRef.current));

  useEffect(() => {
    const engine = new Engine();
    engineRef.current = engine;

    const renderer = new PixiRenderer();
    rendererRef.current = renderer;

    if (canvasRef.current) {
      renderer.init(canvasRef.current, 1080, 1920).then(() => {
        // Game loop: engine tick + render
        const loop = () => {
          engine.tick(1 / 60);
          renderer.render(engine);
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      });
    }

    return () => {
      engine.stop();
      renderer.destroy();
    };
  }, []);

  const loadConfig = useCallback((config: GameConfig) => {
    if (engineRef.current) {
      engineRef.current.restart();
      loaderRef.current.load(engineRef.current, config);
    }
  }, []);

  return { engineRef, rendererRef, loadConfig };
}
```

**Step 2: Create useCamera hook**

```typescript
// src/app/hooks/use-camera.ts
import { useRef, useEffect, useState } from 'react';
import { FaceTracker } from '@/engine/tracking/face-tracker';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackerRef = useRef<FaceTracker | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = document.createElement('video');
    video.playsInline = true;
    videoRef.current = video;

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then(stream => {
        video.srcObject = stream;
        video.play();
        return new FaceTracker().init().then(tracker => {
          trackerRef.current = tracker as any; // init returns void, tracker is the instance
        });
      })
      .then(() => setReady(true))
      .catch(err => console.error('Camera init failed:', err));

    return () => {
      const stream = video.srcObject as MediaStream;
      stream?.getTracks().forEach(t => t.stop());
      trackerRef.current?.destroy();
    };
  }, []);

  return { videoRef, trackerRef, ready };
}
```

**Step 3: Wire everything together in PreviewCanvas**

Connect engine → renderer → camera tracking → modules → UI updates.

When user changes a param in PropertiesPanel, it:
1. Updates Zustand store
2. Calls `engine.getModule(id).configure(newParams)`
3. Preview updates immediately on next frame

**Step 4: Commit**

```bash
git add src/app/hooks/ src/ui/
git commit -m "feat: integrate engine with UI — real-time preview with camera"
```

---

## Task 13: Agent System — Skill Loader + Intent Parser + Recipe Generator

**Files:**
- Create: `src/agent/skill-loader.ts`
- Create: `src/agent/intent-parser.ts`
- Create: `src/agent/recipe-generator.ts`
- Create: `src/agent/recommender.ts`
- Create: `src/agent/local-patterns.ts`
- Create: `src/agent/agent.ts` — orchestrator
- Create: `src/agent/index.ts`
- Test: `src/agent/__tests__/local-patterns.test.ts`
- Test: `src/agent/__tests__/intent-parser.test.ts`

**Step 1: Install Anthropic SDK**

```bash
npm install @anthropic-ai/sdk
```

**Step 2: Implement SkillLoader**

```typescript
// src/agent/skill-loader.ts
const skillFiles = import.meta.glob('/src/knowledge/**/*.md', { query: '?raw', import: 'default' });

export class SkillLoader {
  private cache = new Map<string, string>();

  async load(path: string): Promise<string> {
    if (this.cache.has(path)) return this.cache.get(path)!;
    const key = `/src/knowledge/${path}`;
    const loader = skillFiles[key];
    if (!loader) throw new Error(`Skill not found: ${path}`);
    const content = await loader() as string;
    this.cache.set(path, content);
    return content;
  }

  async loadForGameCreation(gameType: string): Promise<string> {
    const gameSkill = await this.load(`game-types/${gameType}.md`);
    // Parse required modules from skill
    const moduleNames = this.parseRequiredModules(gameSkill);
    const moduleSkills = await Promise.all(
      moduleNames.map(name => this.load(`modules/${name}.md`).catch(() => ''))
    );
    const wiring = await this.load('relations/module-wiring.md').catch(() => '');
    return [gameSkill, ...moduleSkills.filter(Boolean), wiring].join('\n---\n');
  }

  async loadForModuleAdd(moduleType: string): Promise<string> {
    const category = this.findCategory(moduleType);
    const modSkill = await this.load(`modules/${category}/${moduleType.toLowerCase()}.md`).catch(() => '');
    const synergies = await this.load('relations/module-synergies.md').catch(() => '');
    return [modSkill, synergies].filter(Boolean).join('\n---\n');
  }

  async loadForRecommendation(): Promise<string> {
    const synergies = await this.load('relations/module-synergies.md').catch(() => '');
    const conflicts = await this.load('relations/module-conflicts.md').catch(() => '');
    return [synergies, conflicts].filter(Boolean).join('\n---\n');
  }

  private parseRequiredModules(skillContent: string): string[] {
    // Parse "## 必需模块" section and extract module names
    const match = skillContent.match(/##\s*必需模块[\s\S]*?\|([^|]+)\|/g);
    if (!match) return [];
    return match
      .map(m => m.match(/\|\s*(\w+)\s*\|/)?.[1])
      .filter(Boolean) as string[];
  }

  private findCategory(moduleType: string): string {
    const input = ['FaceInput', 'HandInput', 'BodyInput', 'TouchInput', 'DeviceInput', 'AudioInput'];
    const mechanic = ['Spawner', 'Collision', 'Scorer', 'Timer', 'Lives', 'DifficultyRamp', 'Randomizer', 'QuizEngine'];
    if (input.includes(moduleType)) return 'input';
    if (mechanic.includes(moduleType)) return 'mechanic';
    return 'feedback';
  }
}
```

**Step 3: Implement IntentParser + RecipeGenerator + Recommender**

Each uses Claude API with Tool Use as designed in the design doc (Section 6).

**Step 4: Implement local patterns for simple commands**

```typescript
// src/agent/local-patterns.ts
import type { GameConfig } from '@/engine/core';

interface LocalMatch {
  moduleId: string;
  param: string;
  action: 'increase' | 'decrease' | 'set' | 'enable' | 'disable';
  value?: any;
}

const PATTERNS: Array<{ regex: RegExp; extract: (match: RegExpMatchArray, config: GameConfig) => LocalMatch | null }> = [
  {
    regex: /(?:把)?(.+?)(?:调高|增加|加大|提高|调快)/,
    extract: (match, config) => findModuleParam(match[1], config, 'increase'),
  },
  {
    regex: /(?:把)?(.+?)(?:调低|减少|降低|减小|调慢)/,
    extract: (match, config) => findModuleParam(match[1], config, 'decrease'),
  },
  {
    regex: /(?:把)?(.+?)(?:改成|设为|设置为)\s*(\d+)/,
    extract: (match, config) => {
      const result = findModuleParam(match[1], config, 'set');
      if (result) result.value = Number(match[2]);
      return result;
    },
  },
  {
    regex: /(?:开启|打开|启用)(.+)/,
    extract: (match, config) => findModule(match[1], config, 'enable'),
  },
  {
    regex: /(?:关闭|禁用|去掉|移除)(.+)/,
    extract: (match, config) => findModule(match[1], config, 'disable'),
  },
];

export function tryLocalMatch(input: string, config: GameConfig): LocalMatch | null {
  for (const pattern of PATTERNS) {
    const match = input.match(pattern.regex);
    if (match) {
      return pattern.extract(match, config);
    }
  }
  return null;
}

function findModuleParam(text: string, config: GameConfig, action: string): LocalMatch | null {
  // Fuzzy match module params based on Chinese labels in schema
  // Implementation searches through all module schemas for matching label
  return null; // Simplified — full implementation matches against module schemas
}

function findModule(text: string, config: GameConfig, action: 'enable' | 'disable'): LocalMatch | null {
  // Fuzzy match module name
  return null; // Simplified
}
```

**Step 5: Implement Agent orchestrator**

```typescript
// src/agent/agent.ts
import { SkillLoader } from './skill-loader';
import { IntentParser } from './intent-parser';
import { RecipeGenerator } from './recipe-generator';
import { Recommender } from './recommender';
import { tryLocalMatch } from './local-patterns';
import type { GameConfig } from '@/engine/core';

export class Agent {
  private skillLoader = new SkillLoader();
  private intentParser: IntentParser;
  private recipeGenerator: RecipeGenerator;
  private recommender: Recommender;

  constructor(apiKey: string) {
    this.intentParser = new IntentParser(apiKey);
    this.recipeGenerator = new RecipeGenerator(apiKey);
    this.recommender = new Recommender(apiKey);
  }

  async process(userMessage: string, currentConfig: GameConfig | null): Promise<AgentResponse> {
    // Step 0: Try local pattern match first (no API call)
    if (currentConfig) {
      const localMatch = tryLocalMatch(userMessage, currentConfig);
      if (localMatch) {
        return this.applyLocalMatch(localMatch, currentConfig);
      }
    }

    // Step 1: Intent parsing
    const intent = await this.intentParser.parse(userMessage);

    // Step 2: Load relevant skills
    let skills = '';
    if (intent.intent === 'create_game' && intent.gameType) {
      skills = await this.skillLoader.loadForGameCreation(intent.gameType);
    } else if (intent.intent === 'add_module' && intent.targetModule) {
      skills = await this.skillLoader.loadForModuleAdd(intent.targetModule);
    }

    // Step 3: Generate/update config
    const result = await this.recipeGenerator.generate(intent, currentConfig, skills);

    // Step 4: Get recommendations
    const recSkills = await this.skillLoader.loadForRecommendation();
    const suggestions = await this.recommender.suggest(result.config, recSkills);

    return {
      message: result.message,
      config: result.config,
      suggestions,
    };
  }

  private applyLocalMatch(match: any, config: GameConfig): AgentResponse {
    // Apply local change directly to config
    // Return updated config + confirmation message
    return { message: '已更新', config, suggestions: [] };
  }
}

export interface AgentResponse {
  message: string;
  config: GameConfig;
  suggestions: Array<{ moduleType: string; reason: string }>;
}
```

**Step 6: Connect Agent to ChatPanel**

Wire the ChatPanel to call `agent.process()` on user input, update config store, and display AI response + suggestions.

**Step 7: Commit**

```bash
git add src/agent/ src/ui/chat/
git commit -m "feat: implement AI Agent — skill loader, intent parser, recipe generator, recommender"
```

---

## Task 14: Knowledge Base — Game Type & Module Skills

**Files:**
- Create: `src/knowledge/game-types/catch.md`
- Create: `src/knowledge/game-types/dodge.md`
- Create: `src/knowledge/game-types/quiz.md`
- Create: `src/knowledge/game-types/random-wheel.md`
- Create: `src/knowledge/game-types/tap.md`
- Create: `src/knowledge/game-types/shooting.md`
- Create: `src/knowledge/game-types/expression.md`
- Create: `src/knowledge/game-types/runner.md`
- Create: `src/knowledge/game-types/puzzle.md`
- Create: `src/knowledge/game-types/rhythm.md`
- Create: `src/knowledge/game-types/gesture.md`
- Create: `src/knowledge/game-types/world-ar.md`
- Create: `src/knowledge/game-types/dress-up.md`
- Create: `src/knowledge/game-types/narrative.md`
- Create: `src/knowledge/modules/input/face-input.md` (+ 5 more)
- Create: `src/knowledge/modules/mechanic/spawner.md` (+ 7 more)
- Create: `src/knowledge/modules/feedback/game-flow.md` (+ 4 more)
- Create: `src/knowledge/relations/module-wiring.md`
- Create: `src/knowledge/relations/module-conflicts.md`
- Create: `src/knowledge/relations/module-synergies.md`
- Create: `src/knowledge/index.md`

Each skill file follows the standardized template from the design doc (Section 6.2):

**Game type skill template:** 游戏定义, 核心体验, 必需模块+推荐配置, 推荐增强模块+建议话术, 模块连线图, 素材需求, 跨平台兼容性

**Module skill template:** 基本信息, 功能原理, 完整参数表, 事件通信(发出/监听), 与其他模块连接方式, 适用游戏类型, 常见问题 & 边界情况

**This is a content-heavy task.** Each file is ~100-300 lines of structured markdown. Total: ~40 files.

**Step (final): Commit**

```bash
git add src/knowledge/
git commit -m "feat: add complete knowledge base — 14 game types, 19 modules, 3 relation skills"
```

---

## Task 15: Extended Modules (P1 — ExpressionDetector, ComboSystem, Jump, PowerUp)

**Files:**
- Create: `src/engine/modules/mechanic/expression-detector.ts`
- Create: `src/engine/modules/mechanic/combo-system.ts`
- Create: `src/engine/modules/mechanic/jump.ts`
- Create: `src/engine/modules/mechanic/power-up.ts`
- Tests for each

Follow same TDD pattern. Update module-setup.ts to register these.

**Commit**

```bash
git commit -m "feat: add P1 modules — ExpressionDetector, ComboSystem, Jump, PowerUp"
```

---

## Task 16: Extended Modules (P2 — BeatMap, GestureMatch, MatchEngine, Runner)

Same pattern as Task 15 for P2 modules.

```bash
git commit -m "feat: add P2 modules — BeatMap, GestureMatch, MatchEngine, Runner"
```

---

## Task 17: Extended Modules (P3 — PlaneDetection, BranchStateMachine, DressUpEngine)

Same pattern for P3 modules.

```bash
git commit -m "feat: add P3 modules — PlaneDetection, BranchStateMachine, DressUpEngine"
```

---

## Task 18: Web Exporter

**Files:**
- Create: `src/exporters/web-exporter.ts`
- Create: `src/exporters/runtime-bundler.ts`
- Test: `src/exporters/__tests__/web-exporter.test.ts`

**Step 1: Implement WebExporter**

Collects Config + enabled module code + assets → bundles into a standalone HTML file.

Key sub-tasks:
1. Runtime bundler: tree-shakes unused modules, outputs minimal JS
2. Asset resolver: converts prebuilt:// refs to base64 or CDN URLs
3. HTML template: embeds everything into a single playable file

**Commit**

```bash
git commit -m "feat: add Web exporter — generates standalone HTML game files"
```

---

## Task 19: .apjs Exporter

**Files:**
- Create: `src/exporters/apjs-exporter.ts`
- Create: `src/exporters/apjs-translators/index.ts`
- Create: `src/exporters/apjs-translators/spawner.ts` (+ one per module)

**Step 1: Research Effect House .apjs format**

Document the .apjs script structure and API surface.

**Step 2: Implement module translators**

Each module type gets a translator that converts Config params → Effect House API calls.

**Step 3: Implement ApjsExporter**

Orchestrates: collect modules → translate each → generate main.apjs → bundle assets.

**Commit**

```bash
git commit -m "feat: add .apjs exporter for Effect House"
```

---

## Task 20: Asset System — Prebuilt Library + Upload + AI Generation

**Files:**
- Create: `src/ui/assets/asset-browser.tsx`
- Create: `src/ui/assets/asset-upload.tsx`
- Create: `src/ui/assets/ai-generate-dialog.tsx`
- Create: `src/assets/sprites/` — placeholder sprite files
- Create: `src/assets/sounds/` — placeholder sound files
- Create: `src/assets/themes/` — theme pack definitions

**Step 1: Build AssetBrowser UI**

Grid of asset thumbnails, filterable by type (sprite/sound/background). Click to select, drag to replace.

**Step 2: Build asset upload**

File input that accepts images + audio. Stores locally and adds to config with `user://` prefix.

**Step 3: Build AI generate dialog**

Text input for description → calls image generation API → saves result with `ai-generated://` prefix.

**Commit**

```bash
git commit -m "feat: add asset system — browser, upload, AI generation"
```

---

## Task 21: Preview Modes + Share

**Files:**
- Modify: `src/ui/preview/preview-toolbar.tsx` — add mode buttons
- Modify: `src/ui/preview/preview-canvas.tsx` — mode switching
- Create: `src/ui/preview/fullscreen-mode.tsx`
- Create: `src/ui/export/export-dialog.tsx`

**Step 1: Implement 3 preview modes**

- Edit mode: default, all panels visible
- Play mode: hide editor panels, game area expands
- Fullscreen mode: browser fullscreen, pure game experience

**Step 2: Implement export dialog**

Two-column dialog: Web export (generate link / download HTML) + .apjs export (download package).

**Step 3: Implement share link generation**

Config + assets → upload → generate shareable URL. Receiver loads a lightweight player page.

**Commit**

```bash
git commit -m "feat: add preview modes (edit/play/fullscreen) and share/export functionality"
```

---

## Task 22: Integration Testing + Polish

**Files:**
- Create: `src/__tests__/integration/catch-game.test.ts`
- Create: `src/__tests__/integration/shooting-game.test.ts`

**Step 1: Write integration test — complete "catch" game**

Test the full pipeline: load a catch game config → engine creates modules → simulate face input → spawner creates objects → collision detects hits → scorer updates → timer ends → gameflow finishes.

**Step 2: Write integration test — complete "shooting" game**

Similar end-to-end test for shooting game type.

**Step 3: Manual testing checklist**

- [ ] Create game via chat: "做一个接水果游戏"
- [ ] Preview shows game running with camera
- [ ] Add module via suggestion button
- [ ] Adjust parameter via slider → preview updates immediately
- [ ] Replace asset via asset browser
- [ ] Switch to play mode → full game experience
- [ ] Export to Web HTML → open in browser → playable
- [ ] Export to .apjs → valid package structure
- [ ] Share link → open on phone → playable

**Step 4: Commit**

```bash
git commit -m "feat: add integration tests and polish"
```

---

## Dependency Graph

```
Task 1: Scaffolding
  └→ Task 2: Engine Core (types, EventBus, Engine)
       ├→ Task 3: Base modules (Scorer, Timer, Lives)
       │    └→ Task 4: GameFlow, Spawner, Collision
       │         └→ Task 5: AutoWirer + ConfigLoader
       │              ├→ Task 6: Remaining mechanic modules
       │              ├→ Task 7: Feedback modules
       │              └→ Task 15-17: Extended modules (P1/P2/P3)
       ├→ Task 8: Input modules + MediaPipe
       ├→ Task 9: PixiJS Renderer
       └→ Task 10: Zustand Store
            └→ Task 11: UI Shell
                 └→ Task 12: Engine ↔ UI integration
                      ├→ Task 13: Agent System
                      │    └→ Task 14: Knowledge Base
                      ├→ Task 18: Web Exporter
                      ├→ Task 19: .apjs Exporter
                      ├→ Task 20: Asset System
                      └→ Task 21: Preview Modes + Share
                           └→ Task 22: Integration Testing
```

## Parallelizable Tasks

Once Task 5 is complete, these can run in parallel:
- Task 6 + Task 7 + Task 8 (module implementations)
- Task 9 + Task 10 (renderer + store, independent of each other)

Once Task 12 is complete:
- Task 13/14 + Task 18 + Task 19 + Task 20 (all independent)
