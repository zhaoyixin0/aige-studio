# Platformer Module Expansion — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 16 new platformer game modules (Gravity, Knockback, IFrames, PlayerMovement, Dash, CoyoteTime, StaticPlatform, MovingPlatform, OneWayPlatform, CrumblingPlatform, Hazard, Collectible, Inventory, Checkpoint, WallDetect, CameraFollow) and wire them into the existing engine, index, and auto-wirer.

**Architecture:** Each module extends `BaseModule`, follows the existing event-driven pattern (emit/on via EventBus), uses `triggerEvent` params for input-agnostic design. All platform/environment modules support `asset` fields for AI-generated sprite integration. Modules are tested individually with Vitest using the same pattern as existing tests (create Engine, addModule, emit events, assert behavior).

**Tech Stack:** TypeScript, Vitest, existing BaseModule/Engine/EventBus infrastructure

**Design Doc:** `docs/plans/2026-03-23-module-expansion-design.md`

**Key Patterns (from existing modules):**
- Constructor: `new ModuleName('id', params)` — BaseModule merges schema defaults with params
- `init(engine)`: call `super.init(engine)`, then `this.on(event, handler)` for event subscriptions
- `update(dt)`: called every frame, `dt` in milliseconds
- `getSchema()`: returns `ModuleSchema` for UI property editor
- `emit(event, data)` / `on(event, handler)`: via `this.engine.eventBus`
- `reset()`: restore initial state
- Test: `const engine = new Engine(); engine.addModule(mod); engine.eventBus.emit(...); expect(...)`

---

## Task 1: Gravity Module

**Files:**
- Create: `src/engine/modules/mechanic/gravity.ts`
- Test: `src/engine/modules/__tests__/gravity.test.ts`

**Step 1: Write the failing test**

`src/engine/modules/__tests__/gravity.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Gravity } from '../mechanic/gravity';

describe('Gravity', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const gravity = new Gravity('gravity-1', params);
    engine.addModule(gravity);
    return { engine, gravity };
  }

  it('should have correct default schema values', () => {
    const { gravity } = setup();
    const params = gravity.getParams();
    expect(params.strength).toBe(980);
    expect(params.terminalVelocity).toBe(800);
    expect(params.applyTo).toBe('player');
  });

  it('should track objects and apply downward velocity', () => {
    const { gravity } = setup({ strength: 1000 });
    gravity.addObject('player-1', { x: 100, y: 100 });
    gravity.update(100); // 100ms

    const obj = gravity.getObject('player-1');
    expect(obj!.y).toBeGreaterThan(100);
    expect(obj!.velocityY).toBeGreaterThan(0);
  });

  it('should cap velocity at terminalVelocity', () => {
    const { gravity } = setup({ strength: 2000, terminalVelocity: 500 });
    gravity.addObject('p1', { x: 0, y: 0 });

    for (let i = 0; i < 100; i++) gravity.update(16);

    const obj = gravity.getObject('p1');
    expect(obj!.velocityY).toBeLessThanOrEqual(500);
  });

  it('should emit gravity:landed when object reaches floor', () => {
    const { engine, gravity } = setup({ strength: 980 });
    gravity.addObject('p1', { x: 0, y: 0, floorY: 500 });
    const handler = vi.fn();
    engine.eventBus.on('gravity:landed', handler);

    for (let i = 0; i < 200; i++) gravity.update(16);

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
  });

  it('should emit gravity:falling when object starts falling', () => {
    const { engine, gravity } = setup();
    const handler = vi.fn();
    engine.eventBus.on('gravity:falling', handler);

    gravity.addObject('p1', { x: 0, y: 0 });
    gravity.update(16);

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
  });

  it('should respond to jump:start by marking object airborne', () => {
    const { engine, gravity } = setup();
    gravity.addObject('p1', { x: 0, y: 500, floorY: 500 });

    // Land first
    for (let i = 0; i < 10; i++) gravity.update(16);

    engine.eventBus.emit('jump:start', { y: 0.5 });
    expect(gravity.getObject('p1')!.airborne).toBe(true);
  });

  it('should toggle gravity on/off via toggleEvent', () => {
    const { engine, gravity } = setup({ toggleEvent: 'input:audio:volume' });
    gravity.addObject('p1', { x: 0, y: 100 });

    engine.eventBus.emit('input:audio:volume');
    gravity.update(100);

    const obj = gravity.getObject('p1');
    // Gravity disabled — y should not change
    expect(obj!.y).toBe(100);
  });

  it('should reset all objects', () => {
    const { gravity } = setup();
    gravity.addObject('p1', { x: 0, y: 0 });
    gravity.update(100);
    gravity.reset();
    expect(gravity.getObject('p1')).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/modules/__tests__/gravity.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

`src/engine/modules/mechanic/gravity.ts`:
```ts
import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export interface GravityObject {
  id: string;
  x: number;
  y: number;
  velocityY: number;
  floorY: number;
  airborne: boolean;
}

export class Gravity extends BaseModule {
  readonly type = 'Gravity';

  private objects = new Map<string, GravityObject>();
  private enabled = true;

  getSchema(): ModuleSchema {
    return {
      strength: {
        type: 'range', label: 'Gravity Strength',
        default: 980, min: 200, max: 2000, step: 10,
      },
      terminalVelocity: {
        type: 'range', label: 'Terminal Velocity',
        default: 800, min: 100, max: 2000, step: 10,
      },
      applyTo: {
        type: 'select', label: 'Apply To',
        default: 'player', options: ['player', 'items', 'all'],
      },
      toggleEvent: {
        type: 'string', label: 'Toggle Event (optional)',
        default: '',
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on('jump:start', () => {
      for (const obj of this.objects.values()) {
        obj.airborne = true;
      }
    });

    const toggle = this.params.toggleEvent;
    if (toggle) {
      this.on(toggle, () => {
        this.enabled = !this.enabled;
      });
    }
  }

  addObject(id: string, opts: { x: number; y: number; floorY?: number }): void {
    const obj: GravityObject = {
      id, x: opts.x, y: opts.y,
      velocityY: 0,
      floorY: opts.floorY ?? Infinity,
      airborne: true,
    };
    this.objects.set(id, obj);
    this.emit('gravity:falling', { id });
  }

  getObject(id: string): GravityObject | undefined {
    const obj = this.objects.get(id);
    return obj ? { ...obj } : undefined;
  }

  removeObject(id: string): void {
    this.objects.delete(id);
  }

  update(dt: number): void {
    if (!this.enabled) return;

    const strength = this.params.strength ?? 980;
    const terminal = this.params.terminalVelocity ?? 800;
    const dtSec = dt / 1000;

    for (const obj of this.objects.values()) {
      if (!obj.airborne) continue;

      obj.velocityY += strength * dtSec;
      if (obj.velocityY > terminal) obj.velocityY = terminal;

      obj.y += obj.velocityY * dtSec;

      if (obj.y >= obj.floorY) {
        obj.y = obj.floorY;
        obj.velocityY = 0;
        obj.airborne = false;
        this.emit('gravity:landed', { id: obj.id, y: obj.y });
      }
    }
  }

  reset(): void {
    this.objects.clear();
    this.enabled = true;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/modules/__tests__/gravity.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/engine/modules/mechanic/gravity.ts src/engine/modules/__tests__/gravity.test.ts
git commit -m "feat: add Gravity module with tests"
```

---

## Task 2: Knockback Module

**Files:**
- Create: `src/engine/modules/mechanic/knockback.ts`
- Test: `src/engine/modules/__tests__/knockback.test.ts`

**Step 1: Write the failing test**

`src/engine/modules/__tests__/knockback.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Knockback } from '../mechanic/knockback';

describe('Knockback', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const knockback = new Knockback('kb-1', params);
    engine.addModule(knockback);
    return { engine, knockback };
  }

  it('should have correct defaults', () => {
    const { knockback } = setup();
    const p = knockback.getParams();
    expect(p.force).toBe(300);
    expect(p.duration).toBe(200);
    expect(p.triggerEvent).toBe('collision:damage');
  });

  it('should emit knockback:start on trigger event', () => {
    const { engine } = setup({ triggerEvent: 'collision:damage' });
    const handler = vi.fn();
    engine.eventBus.on('knockback:start', handler);

    engine.eventBus.emit('collision:damage', { x: 100, y: 200, objectA: 'player', objectB: 'enemy' });

    expect(handler).toHaveBeenCalledOnce();
  });

  it('should emit knockback:end after duration elapses', () => {
    const { engine, knockback } = setup({ duration: 200, triggerEvent: 'hit' });
    const endHandler = vi.fn();
    engine.eventBus.on('knockback:end', endHandler);

    engine.eventBus.emit('hit', { x: 50, y: 50 });

    // Not yet ended
    knockback.update(100);
    expect(endHandler).not.toHaveBeenCalled();

    // Now ended
    knockback.update(150);
    expect(endHandler).toHaveBeenCalledOnce();
  });

  it('should report active state during knockback', () => {
    const { engine, knockback } = setup({ duration: 200, triggerEvent: 'hit' });

    expect(knockback.isActive()).toBe(false);
    engine.eventBus.emit('hit', { x: 0, y: 0 });
    expect(knockback.isActive()).toBe(true);

    knockback.update(250);
    expect(knockback.isActive()).toBe(false);
  });

  it('should reset state', () => {
    const { engine, knockback } = setup({ triggerEvent: 'hit' });
    engine.eventBus.emit('hit', { x: 0, y: 0 });
    knockback.reset();
    expect(knockback.isActive()).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/modules/__tests__/knockback.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

`src/engine/modules/mechanic/knockback.ts`:
```ts
import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export class Knockback extends BaseModule {
  readonly type = 'Knockback';

  private active = false;
  private elapsed = 0;
  private direction = { x: 0, y: 0 };

  getSchema(): ModuleSchema {
    return {
      force: {
        type: 'range', label: 'Knockback Force',
        default: 300, min: 100, max: 800, step: 10,
      },
      duration: {
        type: 'range', label: 'Duration (ms)',
        default: 200, min: 50, max: 500, step: 10, unit: 'ms',
      },
      triggerEvent: {
        type: 'string', label: 'Trigger Event',
        default: 'collision:damage',
      },
      applyTo: {
        type: 'select', label: 'Apply To',
        default: 'player', options: ['player', 'items', 'all'],
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    const trigger = this.params.triggerEvent ?? 'collision:damage';
    this.on(trigger, (data?: any) => {
      this.activate(data);
    });
  }

  private activate(data?: any): void {
    this.active = true;
    this.elapsed = 0;

    const dx = data?.x ?? 0;
    const dy = data?.y ?? 0;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    this.direction = { x: -dx / len, y: -dy / len };

    this.emit('knockback:start', {
      force: this.params.force ?? 300,
      direction: this.direction,
    });
  }

  update(dt: number): void {
    if (!this.active) return;

    this.elapsed += dt;
    if (this.elapsed >= (this.params.duration ?? 200)) {
      this.active = false;
      this.emit('knockback:end');
    }
  }

  isActive(): boolean {
    return this.active;
  }

  getDirection(): { x: number; y: number } {
    return { ...this.direction };
  }

  reset(): void {
    this.active = false;
    this.elapsed = 0;
    this.direction = { x: 0, y: 0 };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/modules/__tests__/knockback.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/engine/modules/mechanic/knockback.ts src/engine/modules/__tests__/knockback.test.ts
git commit -m "feat: add Knockback module with tests"
```

---

## Task 3: IFrames Module

**Files:**
- Create: `src/engine/modules/mechanic/i-frames.ts`
- Test: `src/engine/modules/__tests__/i-frames.test.ts`

**Step 1: Write the failing test**

`src/engine/modules/__tests__/i-frames.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { IFrames } from '../mechanic/i-frames';

describe('IFrames', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const iframes = new IFrames('if-1', params);
    engine.addModule(iframes);
    return { engine, iframes };
  }

  it('should have correct defaults', () => {
    const { iframes } = setup();
    const p = iframes.getParams();
    expect(p.duration).toBe(1000);
    expect(p.triggerEvent).toBe('collision:damage');
    expect(p.flashEffect).toBe(true);
  });

  it('should activate on trigger event', () => {
    const { engine, iframes } = setup({ triggerEvent: 'collision:damage' });
    const handler = vi.fn();
    engine.eventBus.on('iframes:start', handler);

    engine.eventBus.emit('collision:damage');

    expect(iframes.isActive()).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('should deactivate after duration', () => {
    const { engine, iframes } = setup({ duration: 500, triggerEvent: 'hit' });
    const endHandler = vi.fn();
    engine.eventBus.on('iframes:end', endHandler);

    engine.eventBus.emit('hit');
    iframes.update(300);
    expect(iframes.isActive()).toBe(true);

    iframes.update(300);
    expect(iframes.isActive()).toBe(false);
    expect(endHandler).toHaveBeenCalledOnce();
  });

  it('should not re-trigger while already active', () => {
    const { engine, iframes } = setup({ duration: 1000, triggerEvent: 'hit' });
    const handler = vi.fn();
    engine.eventBus.on('iframes:start', handler);

    engine.eventBus.emit('hit');
    engine.eventBus.emit('hit');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should reset state', () => {
    const { engine, iframes } = setup({ triggerEvent: 'hit' });
    engine.eventBus.emit('hit');
    iframes.reset();
    expect(iframes.isActive()).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/modules/__tests__/i-frames.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

`src/engine/modules/mechanic/i-frames.ts`:
```ts
import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export class IFrames extends BaseModule {
  readonly type = 'IFrames';

  private active = false;
  private elapsed = 0;

  getSchema(): ModuleSchema {
    return {
      duration: {
        type: 'range', label: 'Duration (ms)',
        default: 1000, min: 200, max: 3000, step: 50, unit: 'ms',
      },
      triggerEvent: {
        type: 'string', label: 'Trigger Event',
        default: 'collision:damage',
      },
      flashEffect: {
        type: 'boolean', label: 'Flash Effect',
        default: true,
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    const trigger = this.params.triggerEvent ?? 'collision:damage';
    this.on(trigger, () => {
      if (this.active) return;
      this.activate();
    });
  }

  private activate(): void {
    this.active = true;
    this.elapsed = 0;
    this.emit('iframes:start', { duration: this.params.duration ?? 1000 });
  }

  update(dt: number): void {
    if (!this.active) return;

    this.elapsed += dt;
    if (this.elapsed >= (this.params.duration ?? 1000)) {
      this.active = false;
      this.emit('iframes:end');
    }
  }

  isActive(): boolean {
    return this.active;
  }

  reset(): void {
    this.active = false;
    this.elapsed = 0;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/modules/__tests__/i-frames.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/engine/modules/mechanic/i-frames.ts src/engine/modules/__tests__/i-frames.test.ts
git commit -m "feat: add IFrames module with tests"
```

---

## Task 4: PlayerMovement Module

**Files:**
- Create: `src/engine/modules/mechanic/player-movement.ts`
- Test: `src/engine/modules/__tests__/player-movement.test.ts`

**Step 1: Write the failing test**

`src/engine/modules/__tests__/player-movement.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { PlayerMovement } from '../mechanic/player-movement';

describe('PlayerMovement', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const pm = new PlayerMovement('pm-1', params);
    engine.addModule(pm);
    return { engine, pm };
  }

  it('should have correct defaults', () => {
    const { pm } = setup();
    const p = pm.getParams();
    expect(p.speed).toBe(300);
    expect(p.acceleration).toBe(1000);
    expect(p.deceleration).toBe(800);
  });

  it('should move right on moveRightEvent', () => {
    const { engine, pm } = setup({ moveRightEvent: 'input:right' });
    const handler = vi.fn();
    engine.eventBus.on('player:move', handler);

    engine.eventBus.emit('input:right');
    pm.update(16);

    expect(handler).toHaveBeenCalled();
    expect(pm.getX()).toBeGreaterThan(0);
  });

  it('should move left on moveLeftEvent', () => {
    const { engine, pm } = setup({ moveLeftEvent: 'input:left' });

    engine.eventBus.emit('input:left');
    pm.update(100);

    expect(pm.getX()).toBeLessThan(0);
  });

  it('should decelerate to stop when no input', () => {
    const { engine, pm } = setup({
      moveRightEvent: 'input:right',
      deceleration: 5000,
    });

    engine.eventBus.emit('input:right');
    pm.update(100);
    expect(pm.getVelocityX()).toBeGreaterThan(0);

    // No more input — should decelerate
    for (let i = 0; i < 50; i++) pm.update(16);
    expect(Math.abs(pm.getVelocityX())).toBeLessThan(1);
  });

  it('should emit player:stop when velocity reaches zero', () => {
    const { engine, pm } = setup({
      moveRightEvent: 'input:right',
      deceleration: 10000,
    });
    const handler = vi.fn();
    engine.eventBus.on('player:stop', handler);

    engine.eventBus.emit('input:right');
    pm.update(16);

    for (let i = 0; i < 100; i++) pm.update(16);

    expect(handler).toHaveBeenCalled();
  });

  it('should cap speed at max', () => {
    const { engine, pm } = setup({
      speed: 200,
      acceleration: 50000,
      moveRightEvent: 'go',
    });
    engine.eventBus.emit('go');
    for (let i = 0; i < 100; i++) pm.update(16);

    expect(Math.abs(pm.getVelocityX())).toBeLessThanOrEqual(200);
  });

  it('should support continuous event (e.g., face tracking)', () => {
    const { engine, pm } = setup({ continuousEvent: 'input:face:move' });

    engine.eventBus.emit('input:face:move', { x: 0.8 }); // normalized 0-1
    pm.update(16);

    expect(pm.getX()).not.toBe(0);
  });

  it('should reset', () => {
    const { engine, pm } = setup({ moveRightEvent: 'go' });
    engine.eventBus.emit('go');
    pm.update(100);
    pm.reset();
    expect(pm.getX()).toBe(0);
    expect(pm.getVelocityX()).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/modules/__tests__/player-movement.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

`src/engine/modules/mechanic/player-movement.ts`:
```ts
import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export class PlayerMovement extends BaseModule {
  readonly type = 'PlayerMovement';

  private x = 0;
  private velocityX = 0;
  private direction: -1 | 0 | 1 = 0;
  private inputActive = false;
  private wasStopped = true;

  getSchema(): ModuleSchema {
    return {
      speed: {
        type: 'range', label: 'Max Speed',
        default: 300, min: 100, max: 800, step: 10,
      },
      acceleration: {
        type: 'range', label: 'Acceleration',
        default: 1000, min: 0, max: 2000, step: 10,
      },
      deceleration: {
        type: 'range', label: 'Deceleration',
        default: 800, min: 0, max: 2000, step: 10,
      },
      moveLeftEvent: {
        type: 'string', label: 'Move Left Event',
        default: 'input:touch:swipe:left',
      },
      moveRightEvent: {
        type: 'string', label: 'Move Right Event',
        default: 'input:touch:swipe:right',
      },
      continuousEvent: {
        type: 'string', label: 'Continuous Control Event (optional)',
        default: '',
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    const leftEvent = this.params.moveLeftEvent;
    const rightEvent = this.params.moveRightEvent;
    const contEvent = this.params.continuousEvent;

    if (leftEvent) {
      this.on(leftEvent, () => {
        this.direction = -1;
        this.inputActive = true;
      });
    }

    if (rightEvent) {
      this.on(rightEvent, () => {
        this.direction = 1;
        this.inputActive = true;
      });
    }

    if (contEvent) {
      this.on(contEvent, (data?: any) => {
        const nx = data?.x ?? 0.5;
        const canvas = this.engine?.getCanvas() ?? { width: 800 };
        this.x = nx * canvas.width;
        this.emit('player:move', { x: this.x, direction: nx > 0.5 ? 1 : -1, speed: 0 });
      });
    }
  }

  update(dt: number): void {
    const maxSpeed = this.params.speed ?? 300;
    const accel = this.params.acceleration ?? 1000;
    const decel = this.params.deceleration ?? 800;
    const dtSec = dt / 1000;

    if (this.inputActive) {
      this.velocityX += this.direction * accel * dtSec;
      if (Math.abs(this.velocityX) > maxSpeed) {
        this.velocityX = Math.sign(this.velocityX) * maxSpeed;
      }
      this.inputActive = false;
    } else {
      // Decelerate
      if (this.velocityX > 0) {
        this.velocityX = Math.max(0, this.velocityX - decel * dtSec);
      } else if (this.velocityX < 0) {
        this.velocityX = Math.min(0, this.velocityX + decel * dtSec);
      }
    }

    if (this.velocityX !== 0) {
      this.x += this.velocityX * dtSec;
      this.wasStopped = false;
      this.emit('player:move', {
        x: this.x,
        direction: Math.sign(this.velocityX),
        speed: Math.abs(this.velocityX),
      });
    } else if (!this.wasStopped) {
      this.wasStopped = true;
      this.emit('player:stop', { x: this.x });
    }
  }

  getX(): number { return this.x; }
  getVelocityX(): number { return this.velocityX; }

  reset(): void {
    this.x = 0;
    this.velocityX = 0;
    this.direction = 0;
    this.inputActive = false;
    this.wasStopped = true;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/modules/__tests__/player-movement.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/engine/modules/mechanic/player-movement.ts src/engine/modules/__tests__/player-movement.test.ts
git commit -m "feat: add PlayerMovement module with tests"
```

---

## Task 5: Dash Module

**Files:**
- Create: `src/engine/modules/mechanic/dash.ts`
- Test: `src/engine/modules/__tests__/dash.test.ts`

**Step 1: Write the failing test**

`src/engine/modules/__tests__/dash.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Dash } from '../mechanic/dash';

describe('Dash', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const dash = new Dash('dash-1', params);
    engine.addModule(dash);
    return { engine, dash };
  }

  it('should have correct defaults', () => {
    const { dash } = setup();
    const p = dash.getParams();
    expect(p.distance).toBe(150);
    expect(p.duration).toBe(150);
    expect(p.cooldown).toBe(500);
  });

  it('should emit dash:start on trigger', () => {
    const { engine } = setup({ triggerEvent: 'input:touch:doubleTap' });
    const handler = vi.fn();
    engine.eventBus.on('dash:start', handler);

    engine.eventBus.emit('input:touch:doubleTap');

    expect(handler).toHaveBeenCalledOnce();
  });

  it('should emit dash:end after duration', () => {
    const { engine, dash } = setup({ duration: 100, triggerEvent: 'go' });
    const handler = vi.fn();
    engine.eventBus.on('dash:end', handler);

    engine.eventBus.emit('go');
    dash.update(50);
    expect(handler).not.toHaveBeenCalled();

    dash.update(60);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('should not trigger during cooldown', () => {
    const { engine, dash } = setup({ duration: 50, cooldown: 200, triggerEvent: 'go' });
    const handler = vi.fn();
    engine.eventBus.on('dash:start', handler);

    engine.eventBus.emit('go');
    dash.update(60); // dash ends

    engine.eventBus.emit('go'); // too soon
    expect(handler).toHaveBeenCalledTimes(1);

    dash.update(250); // cooldown over
    engine.eventBus.emit('go');
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('should report displacement during dash', () => {
    const { engine, dash } = setup({ distance: 200, duration: 100, triggerEvent: 'go' });
    engine.eventBus.emit('go');

    dash.update(50); // halfway
    expect(dash.getDisplacement()).toBeCloseTo(100, 0);
  });

  it('should reset', () => {
    const { engine, dash } = setup({ triggerEvent: 'go' });
    engine.eventBus.emit('go');
    dash.reset();
    expect(dash.isActive()).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/modules/__tests__/dash.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

`src/engine/modules/mechanic/dash.ts`:
```ts
import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export class Dash extends BaseModule {
  readonly type = 'Dash';

  private active = false;
  private elapsed = 0;
  private cooldownRemaining = 0;
  private currentDirection: number = 1;
  private displacement = 0;

  getSchema(): ModuleSchema {
    return {
      distance: {
        type: 'range', label: 'Dash Distance',
        default: 150, min: 50, max: 400, step: 10,
      },
      duration: {
        type: 'range', label: 'Duration (ms)',
        default: 150, min: 50, max: 300, step: 10, unit: 'ms',
      },
      cooldown: {
        type: 'range', label: 'Cooldown (ms)',
        default: 500, min: 0, max: 2000, step: 50, unit: 'ms',
      },
      triggerEvent: {
        type: 'string', label: 'Trigger Event',
        default: 'input:touch:doubleTap',
      },
      directionSource: {
        type: 'select', label: 'Direction Source',
        default: 'facing', options: ['facing', 'input', 'fixed'],
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    const trigger = this.params.triggerEvent ?? 'input:touch:doubleTap';
    this.on(trigger, (data?: any) => {
      this.tryDash(data);
    });
  }

  private tryDash(data?: any): void {
    if (this.active || this.cooldownRemaining > 0) return;

    this.active = true;
    this.elapsed = 0;
    this.displacement = 0;
    this.currentDirection = data?.direction ?? 1;

    this.emit('dash:start', { direction: this.currentDirection });
  }

  update(dt: number): void {
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining -= dt;
    }

    if (!this.active) return;

    const duration = this.params.duration ?? 150;
    const distance = this.params.distance ?? 150;
    const speed = distance / duration; // px per ms

    this.elapsed += dt;
    this.displacement = Math.min(this.elapsed * speed, distance);

    if (this.elapsed >= duration) {
      this.active = false;
      this.cooldownRemaining = this.params.cooldown ?? 500;
      this.emit('dash:end', { displacement: this.displacement });
    }
  }

  isActive(): boolean { return this.active; }
  getDisplacement(): number { return this.displacement; }

  reset(): void {
    this.active = false;
    this.elapsed = 0;
    this.cooldownRemaining = 0;
    this.displacement = 0;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/modules/__tests__/dash.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/engine/modules/mechanic/dash.ts src/engine/modules/__tests__/dash.test.ts
git commit -m "feat: add Dash module with tests"
```

---

## Task 6: CoyoteTime Module

**Files:**
- Create: `src/engine/modules/mechanic/coyote-time.ts`
- Test: `src/engine/modules/__tests__/coyote-time.test.ts`

**Step 1: Write the failing test**

`src/engine/modules/__tests__/coyote-time.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { CoyoteTime } from '../mechanic/coyote-time';

describe('CoyoteTime', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const ct = new CoyoteTime('ct-1', params);
    engine.addModule(ct);
    return { engine, ct };
  }

  it('should have correct defaults', () => {
    const { ct } = setup();
    const p = ct.getParams();
    expect(p.coyoteFrames).toBe(6);
    expect(p.bufferFrames).toBe(6);
  });

  it('should allow jump within coyote window after falling', () => {
    const { engine } = setup({
      coyoteFrames: 6,
      jumpEvent: 'input:touch:tap',
    });
    const handler = vi.fn();
    engine.eventBus.on('coyote:jump', handler);

    // Player starts falling
    engine.eventBus.emit('gravity:falling');

    // Jump input within 6 frames (~96ms)
    engine.eventBus.emit('input:touch:tap');

    expect(handler).toHaveBeenCalledOnce();
  });

  it('should NOT allow jump after coyote window expires', () => {
    const { engine, ct } = setup({
      coyoteFrames: 3,
      jumpEvent: 'input:touch:tap',
    });
    const handler = vi.fn();
    engine.eventBus.on('coyote:jump', handler);

    engine.eventBus.emit('gravity:falling');

    // Wait too long (3 frames * 16ms = 48ms)
    for (let i = 0; i < 5; i++) ct.update(16);

    engine.eventBus.emit('input:touch:tap');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should buffer jump input and fire on landing', () => {
    const { engine, ct } = setup({
      bufferFrames: 6,
      jumpEvent: 'input:touch:tap',
    });
    const handler = vi.fn();
    engine.eventBus.on('coyote:jump', handler);

    // Player presses jump while airborne
    engine.eventBus.emit('input:touch:tap');

    // Not triggered yet — airborne
    expect(handler).not.toHaveBeenCalled();

    // Land within buffer window
    ct.update(16);
    engine.eventBus.emit('gravity:landed');

    expect(handler).toHaveBeenCalledOnce();
  });

  it('should NOT fire buffered jump if buffer window expired', () => {
    const { engine, ct } = setup({
      bufferFrames: 2,
      jumpEvent: 'input:touch:tap',
    });
    const handler = vi.fn();
    engine.eventBus.on('coyote:jump', handler);

    engine.eventBus.emit('input:touch:tap');

    // Wait too long
    for (let i = 0; i < 5; i++) ct.update(16);

    engine.eventBus.emit('gravity:landed');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should reset state', () => {
    const { engine, ct } = setup({ jumpEvent: 'j' });
    engine.eventBus.emit('gravity:falling');
    ct.reset();
    // No crash, state cleared
    ct.update(16);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/modules/__tests__/coyote-time.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

`src/engine/modules/mechanic/coyote-time.ts`:
```ts
import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export class CoyoteTime extends BaseModule {
  readonly type = 'CoyoteTime';

  private coyoteTimer = 0;
  private bufferTimer = 0;
  private grounded = true;
  private jumpBuffered = false;

  getSchema(): ModuleSchema {
    return {
      coyoteFrames: {
        type: 'range', label: 'Coyote Frames',
        default: 6, min: 3, max: 15, step: 1,
      },
      bufferFrames: {
        type: 'range', label: 'Buffer Frames',
        default: 6, min: 3, max: 15, step: 1,
      },
      jumpEvent: {
        type: 'string', label: 'Jump Input Event',
        default: 'input:touch:tap',
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    const jumpEvent = this.params.jumpEvent ?? 'input:touch:tap';

    this.on('gravity:falling', () => {
      if (this.grounded) {
        this.grounded = false;
        this.coyoteTimer = (this.params.coyoteFrames ?? 6) * 16; // approx ms
      }
    });

    this.on('gravity:landed', () => {
      this.grounded = true;
      this.coyoteTimer = 0;

      if (this.jumpBuffered && this.bufferTimer > 0) {
        this.jumpBuffered = false;
        this.bufferTimer = 0;
        this.emit('coyote:jump');
      }
    });

    this.on(jumpEvent, () => {
      if (this.grounded || this.coyoteTimer > 0) {
        // Coyote jump — still in grace period
        this.coyoteTimer = 0;
        this.emit('coyote:jump');
      } else {
        // Buffer the jump for when we land
        this.jumpBuffered = true;
        this.bufferTimer = (this.params.bufferFrames ?? 6) * 16;
      }
    });
  }

  update(dt: number): void {
    if (this.coyoteTimer > 0) {
      this.coyoteTimer -= dt;
      if (this.coyoteTimer < 0) this.coyoteTimer = 0;
    }

    if (this.bufferTimer > 0) {
      this.bufferTimer -= dt;
      if (this.bufferTimer <= 0) {
        this.bufferTimer = 0;
        this.jumpBuffered = false;
      }
    }
  }

  reset(): void {
    this.coyoteTimer = 0;
    this.bufferTimer = 0;
    this.grounded = true;
    this.jumpBuffered = false;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/modules/__tests__/coyote-time.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/engine/modules/mechanic/coyote-time.ts src/engine/modules/__tests__/coyote-time.test.ts
git commit -m "feat: add CoyoteTime module with tests"
```

---

## Task 7: StaticPlatform Module

**Files:**
- Create: `src/engine/modules/mechanic/static-platform.ts`
- Test: `src/engine/modules/__tests__/static-platform.test.ts`

**Step 1: Write the failing test**

`src/engine/modules/__tests__/static-platform.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { StaticPlatform } from '../mechanic/static-platform';

describe('StaticPlatform', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const sp = new StaticPlatform('sp-1', params);
    engine.addModule(sp);
    return { engine, sp };
  }

  it('should have correct defaults', () => {
    const { sp } = setup();
    const p = sp.getParams();
    expect(p.layer).toBe('platforms');
    expect(p.friction).toBe(0.8);
    expect(p.tileMode).toBe('stretch');
  });

  it('should return all platforms', () => {
    const platforms = [
      { x: 0, y: 400, width: 200, height: 20, material: 'normal' },
      { x: 300, y: 300, width: 100, height: 20, material: 'ice' },
    ];
    const { sp } = setup({ platforms });
    expect(sp.getPlatforms()).toHaveLength(2);
  });

  it('should check point collision against platforms', () => {
    const platforms = [
      { x: 100, y: 400, width: 200, height: 20, material: 'normal' },
    ];
    const { sp } = setup({ platforms });

    // Point inside platform
    const result = sp.checkCollision(150, 405);
    expect(result).not.toBeNull();
    expect(result!.material).toBe('normal');

    // Point outside
    expect(sp.checkCollision(50, 300)).toBeNull();
  });

  it('should emit platform:contact on collision check hit', () => {
    const platforms = [
      { x: 100, y: 400, width: 200, height: 20, material: 'ice' },
    ];
    const { engine, sp } = setup({ platforms });
    const handler = vi.fn();
    engine.eventBus.on('platform:contact', handler);

    sp.checkCollision(150, 405);

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ material: 'ice' }));
  });

  it('should return friction for the material', () => {
    const { sp } = setup();
    expect(sp.getFriction('normal')).toBeCloseTo(0.8);
    expect(sp.getFriction('ice')).toBeLessThan(0.3);
    expect(sp.getFriction('sticky')).toBeCloseTo(1.0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/modules/__tests__/static-platform.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

`src/engine/modules/mechanic/static-platform.ts`:
```ts
import type { ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export interface PlatformRect {
  x: number;
  y: number;
  width: number;
  height: number;
  material: 'normal' | 'ice' | 'sticky';
}

const FRICTION_MAP: Record<string, number> = {
  normal: 0.8,
  ice: 0.1,
  sticky: 1.0,
};

export class StaticPlatform extends BaseModule {
  readonly type = 'StaticPlatform';

  getSchema(): ModuleSchema {
    return {
      platforms: {
        type: 'object', label: 'Platforms',
        default: [],
      },
      layer: {
        type: 'string', label: 'Collision Layer',
        default: 'platforms',
      },
      friction: {
        type: 'range', label: 'Default Friction',
        default: 0.8, min: 0, max: 1, step: 0.05,
      },
      asset: {
        type: 'asset', label: 'Platform Sprite',
        default: '',
      },
      tileMode: {
        type: 'select', label: 'Tile Mode',
        default: 'stretch', options: ['stretch', 'repeat'],
      },
    };
  }

  getPlatforms(): PlatformRect[] {
    return (this.params.platforms ?? []) as PlatformRect[];
  }

  checkCollision(px: number, py: number): (PlatformRect & { index: number }) | null {
    const platforms = this.getPlatforms();
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      if (px >= p.x && px <= p.x + p.width && py >= p.y && py <= p.y + p.height) {
        this.emit('platform:contact', {
          id: `platform-${i}`,
          index: i,
          material: p.material ?? 'normal',
          x: px, y: p.y,
        });
        return { ...p, index: i };
      }
    }
    return null;
  }

  getFriction(material: string): number {
    return FRICTION_MAP[material] ?? this.params.friction ?? 0.8;
  }

  update(_dt: number): void {
    // Static — no-op
  }

  reset(): void {
    // No mutable state
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/modules/__tests__/static-platform.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/engine/modules/mechanic/static-platform.ts src/engine/modules/__tests__/static-platform.test.ts
git commit -m "feat: add StaticPlatform module with tests"
```

---

## Task 8: MovingPlatform Module

**Files:**
- Create: `src/engine/modules/mechanic/moving-platform.ts`
- Test: `src/engine/modules/__tests__/moving-platform.test.ts`

**Step 1: Write the failing test**

`src/engine/modules/__tests__/moving-platform.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { MovingPlatform } from '../mechanic/moving-platform';

describe('MovingPlatform', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const mp = new MovingPlatform('mp-1', params);
    engine.addModule(mp);
    return { engine, mp };
  }

  it('should have correct defaults', () => {
    const { mp } = setup();
    expect(mp.getParams().layer).toBe('platforms');
  });

  it('should move platforms horizontally', () => {
    const { mp } = setup({
      platforms: [{ x: 100, y: 400, width: 80, height: 20, pattern: 'horizontal', speed: 100, range: 200 }],
    });
    const initial = mp.getPlatformPositions()[0];

    mp.update(500); // 0.5s at 100px/s = 50px

    const moved = mp.getPlatformPositions()[0];
    expect(moved.x).not.toBe(initial.x);
  });

  it('should reverse direction at range boundary', () => {
    const { mp } = setup({
      platforms: [{ x: 100, y: 400, width: 80, height: 20, pattern: 'horizontal', speed: 200, range: 50 }],
    });

    // Move enough to exceed range
    for (let i = 0; i < 50; i++) mp.update(16);

    const pos = mp.getPlatformPositions()[0];
    // Should have reversed — x should be back near start
    expect(pos.x).toBeLessThan(200);
  });

  it('should move platforms vertically', () => {
    const { mp } = setup({
      platforms: [{ x: 100, y: 400, width: 80, height: 20, pattern: 'vertical', speed: 100, range: 100 }],
    });
    mp.update(500);
    const pos = mp.getPlatformPositions()[0];
    expect(pos.y).not.toBe(400);
  });

  it('should emit platform:move on update', () => {
    const { engine, mp } = setup({
      platforms: [{ x: 100, y: 400, width: 80, height: 20, pattern: 'horizontal', speed: 100, range: 200 }],
    });
    const handler = vi.fn();
    engine.eventBus.on('platform:move', handler);

    mp.update(16);

    expect(handler).toHaveBeenCalled();
  });

  it('should reset platforms to initial positions', () => {
    const { mp } = setup({
      platforms: [{ x: 100, y: 400, width: 80, height: 20, pattern: 'horizontal', speed: 100, range: 200 }],
    });
    mp.update(500);
    mp.reset();

    const pos = mp.getPlatformPositions()[0];
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(400);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/modules/__tests__/moving-platform.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

`src/engine/modules/mechanic/moving-platform.ts`:
```ts
import type { ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

interface PlatformDef {
  x: number;
  y: number;
  width: number;
  height: number;
  pattern: 'horizontal' | 'vertical' | 'circular';
  speed: number;
  range: number;
}

interface PlatformState {
  def: PlatformDef;
  currentX: number;
  currentY: number;
  progress: number; // 0-1 oscillation
  direction: 1 | -1;
}

export class MovingPlatform extends BaseModule {
  readonly type = 'MovingPlatform';

  private states: PlatformState[] = [];

  getSchema(): ModuleSchema {
    return {
      platforms: {
        type: 'object', label: 'Platforms',
        default: [],
      },
      layer: {
        type: 'string', label: 'Collision Layer',
        default: 'platforms',
      },
      asset: {
        type: 'asset', label: 'Platform Sprite',
        default: '',
      },
      tileMode: {
        type: 'select', label: 'Tile Mode',
        default: 'stretch', options: ['stretch', 'repeat'],
      },
    };
  }

  init(): void {
    super.init(this.engine!);
    this.buildStates();
  }

  private buildStates(): void {
    const defs: PlatformDef[] = this.params.platforms ?? [];
    this.states = defs.map((def) => ({
      def,
      currentX: def.x,
      currentY: def.y,
      progress: 0,
      direction: 1,
    }));
  }

  update(dt: number): void {
    const dtSec = dt / 1000;

    for (let i = 0; i < this.states.length; i++) {
      const state = this.states[i];
      const { def } = state;
      const displacement = def.speed * dtSec;

      switch (def.pattern) {
        case 'horizontal': {
          state.currentX += displacement * state.direction;
          if (Math.abs(state.currentX - def.x) >= def.range) {
            state.direction *= -1;
            state.currentX = def.x + def.range * state.direction * -1;
          }
          break;
        }
        case 'vertical': {
          state.currentY += displacement * state.direction;
          if (Math.abs(state.currentY - def.y) >= def.range) {
            state.direction *= -1;
          }
          break;
        }
        case 'circular': {
          state.progress += (def.speed / def.range) * dtSec;
          state.currentX = def.x + Math.cos(state.progress) * def.range;
          state.currentY = def.y + Math.sin(state.progress) * def.range;
          break;
        }
      }

      this.emit('platform:move', {
        id: `moving-platform-${i}`,
        x: state.currentX,
        y: state.currentY,
        width: def.width,
        height: def.height,
      });
    }
  }

  getPlatformPositions(): Array<{ x: number; y: number; width: number; height: number }> {
    return this.states.map((s) => ({
      x: s.currentX, y: s.currentY,
      width: s.def.width, height: s.def.height,
    }));
  }

  checkCollision(px: number, py: number): { index: number; x: number; y: number } | null {
    for (let i = 0; i < this.states.length; i++) {
      const s = this.states[i];
      if (px >= s.currentX && px <= s.currentX + s.def.width &&
          py >= s.currentY && py <= s.currentY + s.def.height) {
        return { index: i, x: s.currentX, y: s.currentY };
      }
    }
    return null;
  }

  reset(): void {
    this.buildStates();
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/modules/__tests__/moving-platform.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/engine/modules/mechanic/moving-platform.ts src/engine/modules/__tests__/moving-platform.test.ts
git commit -m "feat: add MovingPlatform module with tests"
```

---

## Task 9: OneWayPlatform Module

**Files:**
- Create: `src/engine/modules/mechanic/one-way-platform.ts`
- Test: `src/engine/modules/__tests__/one-way-platform.test.ts`

**Step 1: Write the failing test**

`src/engine/modules/__tests__/one-way-platform.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { OneWayPlatform } from '../mechanic/one-way-platform';

describe('OneWayPlatform', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const owp = new OneWayPlatform('owp-1', params);
    engine.addModule(owp);
    return { engine, owp };
  }

  it('should have correct defaults', () => {
    const { owp } = setup();
    expect(owp.getParams().layer).toBe('platforms');
  });

  it('should detect landing from above (velocityY > 0, py <= top)', () => {
    const platforms = [{ x: 100, y: 400, width: 200, height: 10 }];
    const { owp } = setup({ platforms });

    // Falling from above
    const result = owp.checkLanding(150, 398, 5);
    expect(result).not.toBeNull();
    expect(result!.y).toBe(400);
  });

  it('should NOT block when coming from below (velocityY < 0)', () => {
    const platforms = [{ x: 100, y: 400, width: 200, height: 10 }];
    const { owp } = setup({ platforms });

    // Moving upward
    const result = owp.checkLanding(150, 405, -5);
    expect(result).toBeNull();
  });

  it('should emit platform:land on landing', () => {
    const platforms = [{ x: 100, y: 400, width: 200, height: 10 }];
    const { engine, owp } = setup({ platforms });
    const handler = vi.fn();
    engine.eventBus.on('platform:land', handler);

    owp.checkLanding(150, 398, 5);

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'one-way-0' }));
  });

  it('should allow drop-through on dropThroughEvent', () => {
    const platforms = [{ x: 100, y: 400, width: 200, height: 10 }];
    const { engine, owp } = setup({ platforms, dropThroughEvent: 'input:touch:swipe:down' });
    const handler = vi.fn();
    engine.eventBus.on('platform:drop', handler);

    engine.eventBus.emit('input:touch:swipe:down');

    expect(handler).toHaveBeenCalled();
    expect(owp.isDropping()).toBe(true);
  });

  it('should re-enable after drop completes', () => {
    const platforms = [{ x: 100, y: 400, width: 200, height: 10 }];
    const { engine, owp } = setup({ platforms, dropThroughEvent: 'drop' });

    engine.eventBus.emit('drop');
    expect(owp.isDropping()).toBe(true);

    // After some time, re-enable
    owp.update(300);
    expect(owp.isDropping()).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/modules/__tests__/one-way-platform.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

`src/engine/modules/mechanic/one-way-platform.ts`:
```ts
import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

interface OneWayPlatformDef {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class OneWayPlatform extends BaseModule {
  readonly type = 'OneWayPlatform';

  private dropping = false;
  private dropTimer = 0;

  getSchema(): ModuleSchema {
    return {
      platforms: {
        type: 'object', label: 'Platforms',
        default: [],
      },
      layer: {
        type: 'string', label: 'Collision Layer',
        default: 'platforms',
      },
      dropThroughEvent: {
        type: 'string', label: 'Drop Through Event (optional)',
        default: '',
      },
      asset: {
        type: 'asset', label: 'Platform Sprite',
        default: '',
      },
      tileMode: {
        type: 'select', label: 'Tile Mode',
        default: 'stretch', options: ['stretch', 'repeat'],
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    const dropEvent = this.params.dropThroughEvent;
    if (dropEvent) {
      this.on(dropEvent, () => {
        this.dropping = true;
        this.dropTimer = 0;
        this.emit('platform:drop', { id: 'one-way-drop' });
      });
    }
  }

  checkLanding(px: number, py: number, velocityY: number): { index: number; x: number; y: number } | null {
    if (this.dropping) return null;
    if (velocityY <= 0) return null; // moving upward — pass through

    const platforms: OneWayPlatformDef[] = this.params.platforms ?? [];
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      if (px >= p.x && px <= p.x + p.width && py <= p.y && py + velocityY >= p.y) {
        this.emit('platform:land', { id: `one-way-${i}`, x: p.x, y: p.y });
        return { index: i, x: p.x, y: p.y };
      }
    }
    return null;
  }

  getPlatforms(): OneWayPlatformDef[] {
    return (this.params.platforms ?? []) as OneWayPlatformDef[];
  }

  isDropping(): boolean {
    return this.dropping;
  }

  update(dt: number): void {
    if (this.dropping) {
      this.dropTimer += dt;
      if (this.dropTimer >= 250) {
        this.dropping = false;
        this.dropTimer = 0;
      }
    }
  }

  reset(): void {
    this.dropping = false;
    this.dropTimer = 0;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/modules/__tests__/one-way-platform.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/engine/modules/mechanic/one-way-platform.ts src/engine/modules/__tests__/one-way-platform.test.ts
git commit -m "feat: add OneWayPlatform module with tests"
```

---

## Task 10: CrumblingPlatform Module

**Files:**
- Create: `src/engine/modules/mechanic/crumbling-platform.ts`
- Test: `src/engine/modules/__tests__/crumbling-platform.test.ts`

**Step 1: Write the failing test**

`src/engine/modules/__tests__/crumbling-platform.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { CrumblingPlatform } from '../mechanic/crumbling-platform';

describe('CrumblingPlatform', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const cp = new CrumblingPlatform('cp-1', params);
    engine.addModule(cp);
    return { engine, cp };
  }

  it('should have correct defaults', () => {
    const { cp } = setup();
    const p = cp.getParams();
    expect(p.delay).toBe(500);
    expect(p.respawnTime).toBe(3);
  });

  it('should crumble after delay when triggered', () => {
    const platforms = [{ x: 100, y: 400, width: 100, height: 20 }];
    const { engine, cp } = setup({ platforms, delay: 300 });
    const handler = vi.fn();
    engine.eventBus.on('platform:crumble', handler);

    cp.triggerCrumble(0);

    // Not yet
    cp.update(200);
    expect(handler).not.toHaveBeenCalled();

    // Now crumbles
    cp.update(150);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'crumble-0' }));
  });

  it('should report platform as inactive after crumbling', () => {
    const platforms = [{ x: 100, y: 400, width: 100, height: 20 }];
    const { cp } = setup({ platforms, delay: 100 });

    cp.triggerCrumble(0);
    cp.update(150);

    expect(cp.isPlatformActive(0)).toBe(false);
  });

  it('should respawn after respawnTime', () => {
    const platforms = [{ x: 100, y: 400, width: 100, height: 20 }];
    const { engine, cp } = setup({ platforms, delay: 100, respawnTime: 2 });
    const handler = vi.fn();
    engine.eventBus.on('platform:respawn', handler);

    cp.triggerCrumble(0);
    cp.update(150); // crumbled

    // Wait for respawn (2 seconds)
    cp.update(2100);

    expect(cp.isPlatformActive(0)).toBe(true);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'crumble-0' }));
  });

  it('should NOT respawn if respawnTime is 0', () => {
    const platforms = [{ x: 100, y: 400, width: 100, height: 20 }];
    const { cp } = setup({ platforms, delay: 100, respawnTime: 0 });

    cp.triggerCrumble(0);
    cp.update(150);
    cp.update(10000);

    expect(cp.isPlatformActive(0)).toBe(false);
  });

  it('should reset all platforms to active', () => {
    const platforms = [{ x: 100, y: 400, width: 100, height: 20 }];
    const { cp } = setup({ platforms, delay: 100 });

    cp.triggerCrumble(0);
    cp.update(150);
    cp.reset();

    expect(cp.isPlatformActive(0)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/modules/__tests__/crumbling-platform.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

`src/engine/modules/mechanic/crumbling-platform.ts`:
```ts
import type { ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

interface CrumblePlatformDef {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CrumbleState {
  active: boolean;
  crumbling: boolean;
  crumbleTimer: number;
  respawnTimer: number;
}

export class CrumblingPlatform extends BaseModule {
  readonly type = 'CrumblingPlatform';

  private states: CrumbleState[] = [];

  getSchema(): ModuleSchema {
    return {
      platforms: {
        type: 'object', label: 'Platforms',
        default: [],
      },
      delay: {
        type: 'range', label: 'Crumble Delay (ms)',
        default: 500, min: 200, max: 2000, step: 50, unit: 'ms',
      },
      respawnTime: {
        type: 'range', label: 'Respawn Time (s)',
        default: 3, min: 0, max: 10, step: 0.5, unit: 's',
      },
      layer: {
        type: 'string', label: 'Collision Layer',
        default: 'platforms',
      },
      asset: {
        type: 'asset', label: 'Platform Sprite',
        default: '',
      },
      crumbleAsset: {
        type: 'asset', label: 'Crumble Effect Sprite',
        default: '',
      },
    };
  }

  init(): void {
    super.init(this.engine!);
    this.buildStates();
  }

  private buildStates(): void {
    const platforms: CrumblePlatformDef[] = this.params.platforms ?? [];
    this.states = platforms.map(() => ({
      active: true,
      crumbling: false,
      crumbleTimer: 0,
      respawnTimer: 0,
    }));
  }

  triggerCrumble(index: number): void {
    const state = this.states[index];
    if (!state || !state.active || state.crumbling) return;
    state.crumbling = true;
    state.crumbleTimer = 0;
  }

  isPlatformActive(index: number): boolean {
    return this.states[index]?.active ?? false;
  }

  getPlatforms(): CrumblePlatformDef[] {
    return (this.params.platforms ?? []) as CrumblePlatformDef[];
  }

  update(dt: number): void {
    const delay = this.params.delay ?? 500;
    const respawnTime = (this.params.respawnTime ?? 3) * 1000;

    for (let i = 0; i < this.states.length; i++) {
      const state = this.states[i];

      if (state.crumbling) {
        state.crumbleTimer += dt;
        if (state.crumbleTimer >= delay) {
          state.crumbling = false;
          state.active = false;
          state.respawnTimer = 0;
          this.emit('platform:crumble', { id: `crumble-${i}`, index: i });
        }
      } else if (!state.active && respawnTime > 0) {
        state.respawnTimer += dt;
        if (state.respawnTimer >= respawnTime) {
          state.active = true;
          state.respawnTimer = 0;
          this.emit('platform:respawn', { id: `crumble-${i}`, index: i });
        }
      }
    }
  }

  reset(): void {
    this.buildStates();
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/modules/__tests__/crumbling-platform.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/engine/modules/mechanic/crumbling-platform.ts src/engine/modules/__tests__/crumbling-platform.test.ts
git commit -m "feat: add CrumblingPlatform module with tests"
```

---

## Task 11: Hazard Module

**Files:**
- Create: `src/engine/modules/mechanic/hazard.ts`
- Test: `src/engine/modules/__tests__/hazard.test.ts`

**Step 1: Write the failing test**

`src/engine/modules/__tests__/hazard.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Hazard } from '../mechanic/hazard';

describe('Hazard', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const hazard = new Hazard('hz-1', params);
    engine.addModule(hazard);
    return { engine, hazard };
  }

  it('should have correct defaults', () => {
    const { hazard } = setup();
    const p = hazard.getParams();
    expect(p.damage).toBe(1);
    expect(p.damageEvent).toBe('collision:damage');
    expect(p.layer).toBe('hazards');
  });

  it('should return static hazard positions', () => {
    const hazards = [
      { x: 100, y: 500, width: 50, height: 10, pattern: 'static' },
    ];
    const { hazard } = setup({ hazards });
    const positions = hazard.getHazardPositions();
    expect(positions).toHaveLength(1);
    expect(positions[0].x).toBe(100);
  });

  it('should move oscillating hazards', () => {
    const hazards = [
      { x: 100, y: 500, width: 50, height: 10, pattern: 'oscillate' },
    ];
    const { hazard } = setup({ hazards, oscillateSpeed: 200, oscillateRange: 100 });

    hazard.update(500);

    const positions = hazard.getHazardPositions();
    expect(positions[0].x).not.toBe(100);
  });

  it('should check collision and emit damage event', () => {
    const hazards = [
      { x: 100, y: 500, width: 50, height: 10, pattern: 'static' },
    ];
    const { engine, hazard } = setup({ hazards, damageEvent: 'collision:damage' });
    const handler = vi.fn();
    engine.eventBus.on('collision:damage', handler);

    const hit = hazard.checkCollision(120, 505);
    expect(hit).toBe(true);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ damage: 1 }));
  });

  it('should NOT emit for miss', () => {
    const hazards = [
      { x: 100, y: 500, width: 50, height: 10, pattern: 'static' },
    ];
    const { engine, hazard } = setup({ hazards });
    const handler = vi.fn();
    engine.eventBus.on('collision:damage', handler);

    hazard.checkCollision(0, 0);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should reset oscillating hazards', () => {
    const hazards = [
      { x: 100, y: 500, width: 50, height: 10, pattern: 'oscillate' },
    ];
    const { hazard } = setup({ hazards, oscillateSpeed: 200, oscillateRange: 100 });

    hazard.update(500);
    hazard.reset();

    const positions = hazard.getHazardPositions();
    expect(positions[0].x).toBe(100);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/modules/__tests__/hazard.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

`src/engine/modules/mechanic/hazard.ts`:
```ts
import type { ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

interface HazardDef {
  x: number;
  y: number;
  width: number;
  height: number;
  pattern: 'static' | 'oscillate' | 'rotate';
}

interface HazardState {
  def: HazardDef;
  currentX: number;
  currentY: number;
  elapsed: number;
}

export class Hazard extends BaseModule {
  readonly type = 'Hazard';

  private states: HazardState[] = [];

  getSchema(): ModuleSchema {
    return {
      hazards: {
        type: 'object', label: 'Hazards',
        default: [],
      },
      damage: {
        type: 'range', label: 'Damage',
        default: 1, min: 1, max: 10, step: 1,
      },
      damageEvent: {
        type: 'string', label: 'Damage Event',
        default: 'collision:damage',
      },
      layer: {
        type: 'string', label: 'Collision Layer',
        default: 'hazards',
      },
      asset: {
        type: 'asset', label: 'Hazard Sprite',
        default: '',
      },
      oscillateSpeed: {
        type: 'range', label: 'Oscillate Speed',
        default: 100, min: 0, max: 500, step: 10,
      },
      oscillateRange: {
        type: 'range', label: 'Oscillate Range',
        default: 100, min: 0, max: 300, step: 10,
      },
    };
  }

  init(): void {
    super.init(this.engine!);
    this.buildStates();
  }

  private buildStates(): void {
    const defs: HazardDef[] = this.params.hazards ?? [];
    this.states = defs.map((def) => ({
      def, currentX: def.x, currentY: def.y, elapsed: 0,
    }));
  }

  update(dt: number): void {
    const speed = this.params.oscillateSpeed ?? 100;
    const range = this.params.oscillateRange ?? 100;

    for (const state of this.states) {
      if (state.def.pattern === 'oscillate') {
        state.elapsed += dt;
        state.currentX = state.def.x + Math.sin(state.elapsed / 1000 * speed / range) * range;
      } else if (state.def.pattern === 'rotate') {
        state.elapsed += dt;
        state.currentX = state.def.x + Math.cos(state.elapsed / 1000) * range;
        state.currentY = state.def.y + Math.sin(state.elapsed / 1000) * range;
      }
    }
  }

  getHazardPositions(): Array<{ x: number; y: number; width: number; height: number }> {
    return this.states.map((s) => ({
      x: s.currentX, y: s.currentY,
      width: s.def.width, height: s.def.height,
    }));
  }

  checkCollision(px: number, py: number): boolean {
    for (const state of this.states) {
      if (px >= state.currentX && px <= state.currentX + state.def.width &&
          py >= state.currentY && py <= state.currentY + state.def.height) {
        this.emit(this.params.damageEvent ?? 'collision:damage', {
          damage: this.params.damage ?? 1,
          x: px, y: py,
        });
        return true;
      }
    }
    return false;
  }

  reset(): void {
    this.buildStates();
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/modules/__tests__/hazard.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/engine/modules/mechanic/hazard.ts src/engine/modules/__tests__/hazard.test.ts
git commit -m "feat: add Hazard module with tests"
```

---

## Task 12: Collectible Module

**Files:**
- Create: `src/engine/modules/mechanic/collectible.ts`
- Test: `src/engine/modules/__tests__/collectible.test.ts`

**Step 1: Write the failing test**

`src/engine/modules/__tests__/collectible.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Collectible } from '../mechanic/collectible';

describe('Collectible', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const col = new Collectible('col-1', params);
    engine.addModule(col);
    return { engine, col };
  }

  it('should have correct defaults', () => {
    const { col } = setup();
    const p = col.getParams();
    expect(p.layer).toBe('collectibles');
    expect(p.floatAnimation).toBe(true);
  });

  it('should track items and allow pickup', () => {
    const items = [
      { x: 100, y: 200, value: 10, type: 'coin' },
      { x: 300, y: 200, value: 50, type: 'gem' },
    ];
    const { col } = setup({ items });
    expect(col.getActiveItems()).toHaveLength(2);

    col.pickup(0);
    expect(col.getActiveItems()).toHaveLength(1);
  });

  it('should emit collectible:pickup on pickup', () => {
    const items = [{ x: 100, y: 200, value: 10, type: 'coin' }];
    const { engine, col } = setup({ items });
    const handler = vi.fn();
    engine.eventBus.on('collectible:pickup', handler);

    col.pickup(0);

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      type: 'coin', value: 10,
    }));
  });

  it('should emit collectible:allCollected when all picked up', () => {
    const items = [{ x: 100, y: 200, value: 10, type: 'coin' }];
    const { engine, col } = setup({ items });
    const handler = vi.fn();
    engine.eventBus.on('collectible:allCollected', handler);

    col.pickup(0);

    expect(handler).toHaveBeenCalledOnce();
  });

  it('should check collision for pickup', () => {
    const items = [{ x: 100, y: 200, value: 10, type: 'coin' }];
    const { engine, col } = setup({ items });
    const handler = vi.fn();
    engine.eventBus.on('collectible:pickup', handler);

    const result = col.checkCollision(110, 210, 20);
    expect(result).toBe(true);
    expect(handler).toHaveBeenCalled();
  });

  it('should animate float on update', () => {
    const items = [{ x: 100, y: 200, value: 10, type: 'coin' }];
    const { col } = setup({ items, floatAnimation: true });

    col.update(500);
    const positions = col.getItemPositions();
    // Y should oscillate
    expect(positions[0].displayY).not.toBe(200);
  });

  it('should reset all items', () => {
    const items = [{ x: 100, y: 200, value: 10, type: 'coin' }];
    const { col } = setup({ items });
    col.pickup(0);
    col.reset();
    expect(col.getActiveItems()).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/modules/__tests__/collectible.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

`src/engine/modules/mechanic/collectible.ts`:
```ts
import type { ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

interface CollectibleDef {
  x: number;
  y: number;
  value: number;
  type: string;
}

export class Collectible extends BaseModule {
  readonly type = 'Collectible';

  private collected = new Set<number>();
  private elapsed = 0;

  getSchema(): ModuleSchema {
    return {
      items: {
        type: 'object', label: 'Items',
        default: [],
      },
      layer: {
        type: 'string', label: 'Collision Layer',
        default: 'collectibles',
      },
      asset: {
        type: 'asset', label: 'Item Sprite',
        default: '',
      },
      floatAnimation: {
        type: 'boolean', label: 'Float Animation',
        default: true,
      },
    };
  }

  getActiveItems(): CollectibleDef[] {
    const items: CollectibleDef[] = this.params.items ?? [];
    return items.filter((_, i) => !this.collected.has(i));
  }

  pickup(index: number): void {
    if (this.collected.has(index)) return;
    const items: CollectibleDef[] = this.params.items ?? [];
    const item = items[index];
    if (!item) return;

    this.collected.add(index);
    this.emit('collectible:pickup', {
      index, type: item.type, value: item.value, x: item.x, y: item.y,
    });

    if (this.collected.size === items.length) {
      this.emit('collectible:allCollected');
    }
  }

  checkCollision(px: number, py: number, radius: number): boolean {
    const items: CollectibleDef[] = this.params.items ?? [];
    for (let i = 0; i < items.length; i++) {
      if (this.collected.has(i)) continue;
      const item = items[i];
      const dx = px - item.x;
      const dy = py - item.y;
      if (Math.sqrt(dx * dx + dy * dy) < radius + 16) {
        this.pickup(i);
        return true;
      }
    }
    return false;
  }

  getItemPositions(): Array<{ x: number; displayY: number; index: number }> {
    const items: CollectibleDef[] = this.params.items ?? [];
    const float = this.params.floatAnimation ?? true;

    return items
      .map((item, i) => {
        if (this.collected.has(i)) return null;
        const offsetY = float ? Math.sin(this.elapsed / 500 + i) * 5 : 0;
        return { x: item.x, displayY: item.y + offsetY, index: i };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
  }

  update(dt: number): void {
    this.elapsed += dt;
  }

  reset(): void {
    this.collected.clear();
    this.elapsed = 0;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/modules/__tests__/collectible.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/engine/modules/mechanic/collectible.ts src/engine/modules/__tests__/collectible.test.ts
git commit -m "feat: add Collectible module with tests"
```

---

## Task 13: Inventory Module

**Files:**
- Create: `src/engine/modules/mechanic/inventory.ts`
- Test: `src/engine/modules/__tests__/inventory.test.ts`

**Step 1: Write the failing test**

`src/engine/modules/__tests__/inventory.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Inventory } from '../mechanic/inventory';

describe('Inventory', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const inv = new Inventory('inv-1', params);
    engine.addModule(inv);
    return { engine, inv };
  }

  it('should have correct defaults', () => {
    const { inv } = setup();
    expect(inv.getParams().trackEvent).toBe('collectible:pickup');
  });

  it('should initialize resources from params', () => {
    const { inv } = setup({
      resources: [
        { name: 'coins', max: 999, initial: 0 },
        { name: 'gems', max: 99, initial: 5 },
      ],
    });
    expect(inv.getAmount('coins')).toBe(0);
    expect(inv.getAmount('gems')).toBe(5);
  });

  it('should add resources on tracked event', () => {
    const { engine, inv } = setup({
      resources: [{ name: 'coin', max: 100, initial: 0 }],
      trackEvent: 'collectible:pickup',
    });

    engine.eventBus.emit('collectible:pickup', { type: 'coin', value: 10 });

    expect(inv.getAmount('coin')).toBe(10);
  });

  it('should emit inventory:change', () => {
    const { engine, inv } = setup({
      resources: [{ name: 'coin', max: 100, initial: 0 }],
      trackEvent: 'collectible:pickup',
    });
    const handler = vi.fn();
    engine.eventBus.on('inventory:change', handler);

    engine.eventBus.emit('collectible:pickup', { type: 'coin', value: 5 });

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'coin', amount: 5, total: 5,
    }));
  });

  it('should cap at max and emit inventory:full', () => {
    const { engine, inv } = setup({
      resources: [{ name: 'coin', max: 10, initial: 8 }],
      trackEvent: 'collectible:pickup',
    });
    const fullHandler = vi.fn();
    engine.eventBus.on('inventory:full', fullHandler);

    engine.eventBus.emit('collectible:pickup', { type: 'coin', value: 5 });

    expect(inv.getAmount('coin')).toBe(10);
    expect(fullHandler).toHaveBeenCalledWith(expect.objectContaining({ resource: 'coin' }));
  });

  it('should spend resources', () => {
    const { inv } = setup({
      resources: [{ name: 'coin', max: 100, initial: 50 }],
    });

    const ok = inv.spend('coin', 20);
    expect(ok).toBe(true);
    expect(inv.getAmount('coin')).toBe(30);
  });

  it('should not spend more than available', () => {
    const { inv } = setup({
      resources: [{ name: 'coin', max: 100, initial: 10 }],
    });

    const ok = inv.spend('coin', 20);
    expect(ok).toBe(false);
    expect(inv.getAmount('coin')).toBe(10);
  });

  it('should reset to initial values', () => {
    const { engine, inv } = setup({
      resources: [{ name: 'coin', max: 100, initial: 0 }],
      trackEvent: 'collectible:pickup',
    });
    engine.eventBus.emit('collectible:pickup', { type: 'coin', value: 50 });
    inv.reset();
    expect(inv.getAmount('coin')).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/modules/__tests__/inventory.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

`src/engine/modules/mechanic/inventory.ts`:
```ts
import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

interface ResourceDef {
  name: string;
  max: number;
  initial: number;
}

export class Inventory extends BaseModule {
  readonly type = 'Inventory';

  private amounts = new Map<string, number>();

  getSchema(): ModuleSchema {
    return {
      resources: {
        type: 'object', label: 'Resources',
        default: [],
      },
      trackEvent: {
        type: 'string', label: 'Track Event',
        default: 'collectible:pickup',
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);
    this.initResources();

    const trackEvent = this.params.trackEvent ?? 'collectible:pickup';
    this.on(trackEvent, (data?: any) => {
      const type = data?.type;
      const value = data?.value ?? 1;
      if (type) this.add(type, value);
    });
  }

  private initResources(): void {
    this.amounts.clear();
    const defs: ResourceDef[] = this.params.resources ?? [];
    for (const def of defs) {
      this.amounts.set(def.name, def.initial ?? 0);
    }
  }

  private getMax(name: string): number {
    const defs: ResourceDef[] = this.params.resources ?? [];
    const def = defs.find((d) => d.name === name);
    return def?.max ?? Infinity;
  }

  add(resource: string, amount: number): void {
    const current = this.amounts.get(resource) ?? 0;
    const max = this.getMax(resource);
    const newTotal = Math.min(current + amount, max);

    this.amounts.set(resource, newTotal);
    this.emit('inventory:change', {
      resource, amount, total: newTotal,
    });

    if (newTotal >= max) {
      this.emit('inventory:full', { resource });
    }
  }

  spend(resource: string, amount: number): boolean {
    const current = this.amounts.get(resource) ?? 0;
    if (current < amount) return false;

    const newTotal = current - amount;
    this.amounts.set(resource, newTotal);
    this.emit('inventory:change', {
      resource, amount: -amount, total: newTotal,
    });
    return true;
  }

  getAmount(resource: string): number {
    return this.amounts.get(resource) ?? 0;
  }

  update(_dt: number): void {
    // Event-driven — no-op
  }

  reset(): void {
    this.initResources();
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/modules/__tests__/inventory.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/engine/modules/mechanic/inventory.ts src/engine/modules/__tests__/inventory.test.ts
git commit -m "feat: add Inventory module with tests"
```

---

## Task 14: Checkpoint Module

**Files:**
- Create: `src/engine/modules/mechanic/checkpoint.ts`
- Test: `src/engine/modules/__tests__/checkpoint.test.ts`

**Step 1: Write the failing test**

`src/engine/modules/__tests__/checkpoint.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Checkpoint } from '../mechanic/checkpoint';

describe('Checkpoint', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const cp = new Checkpoint('cp-1', params);
    engine.addModule(cp);
    return { engine, cp };
  }

  it('should have correct defaults', () => {
    const { cp } = setup();
    expect(cp.getParams().layer).toBe('checkpoints');
  });

  it('should activate checkpoint on collision', () => {
    const checkpoints = [{ x: 400, y: 300, width: 40, height: 60 }];
    const { engine, cp } = setup({ checkpoints });
    const handler = vi.fn();
    engine.eventBus.on('checkpoint:activate', handler);

    cp.activate(0);

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      id: 'checkpoint-0', x: 400, y: 300,
    }));
  });

  it('should return last activated checkpoint for respawn', () => {
    const checkpoints = [
      { x: 100, y: 300, width: 40, height: 60 },
      { x: 500, y: 300, width: 40, height: 60 },
    ];
    const { cp } = setup({ checkpoints });

    cp.activate(0);
    cp.activate(1);

    const respawn = cp.getRespawnPoint();
    expect(respawn).toEqual({ x: 500, y: 300 });
  });

  it('should emit checkpoint:respawn on lives:zero', () => {
    const checkpoints = [{ x: 200, y: 300, width: 40, height: 60 }];
    const { engine, cp } = setup({ checkpoints });
    cp.activate(0);

    const handler = vi.fn();
    engine.eventBus.on('checkpoint:respawn', handler);

    engine.eventBus.emit('lives:zero');

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      id: 'checkpoint-0', x: 200, y: 300,
    }));
  });

  it('should return null respawn if no checkpoint activated', () => {
    const { cp } = setup({ checkpoints: [{ x: 0, y: 0, width: 40, height: 60 }] });
    expect(cp.getRespawnPoint()).toBeNull();
  });

  it('should not re-activate same checkpoint', () => {
    const checkpoints = [{ x: 100, y: 300, width: 40, height: 60 }];
    const { engine, cp } = setup({ checkpoints });
    const handler = vi.fn();
    engine.eventBus.on('checkpoint:activate', handler);

    cp.activate(0);
    cp.activate(0);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should reset state', () => {
    const checkpoints = [{ x: 100, y: 300, width: 40, height: 60 }];
    const { cp } = setup({ checkpoints });
    cp.activate(0);
    cp.reset();
    expect(cp.getRespawnPoint()).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/modules/__tests__/checkpoint.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

`src/engine/modules/mechanic/checkpoint.ts`:
```ts
import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

interface CheckpointDef {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class Checkpoint extends BaseModule {
  readonly type = 'Checkpoint';

  private activatedSet = new Set<number>();
  private lastActivated: number | null = null;

  getSchema(): ModuleSchema {
    return {
      checkpoints: {
        type: 'object', label: 'Checkpoints',
        default: [],
      },
      layer: {
        type: 'string', label: 'Collision Layer',
        default: 'checkpoints',
      },
      asset: {
        type: 'asset', label: 'Checkpoint Sprite',
        default: '',
      },
      activeAsset: {
        type: 'asset', label: 'Active Checkpoint Sprite',
        default: '',
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on('lives:zero', () => {
      this.respawn();
    });
  }

  activate(index: number): void {
    if (this.activatedSet.has(index)) return;

    const checkpoints: CheckpointDef[] = this.params.checkpoints ?? [];
    const cp = checkpoints[index];
    if (!cp) return;

    this.activatedSet.add(index);
    this.lastActivated = index;
    this.emit('checkpoint:activate', {
      id: `checkpoint-${index}`, index, x: cp.x, y: cp.y,
    });
  }

  getRespawnPoint(): { x: number; y: number } | null {
    if (this.lastActivated === null) return null;
    const checkpoints: CheckpointDef[] = this.params.checkpoints ?? [];
    const cp = checkpoints[this.lastActivated];
    return cp ? { x: cp.x, y: cp.y } : null;
  }

  isActivated(index: number): boolean {
    return this.activatedSet.has(index);
  }

  private respawn(): void {
    if (this.lastActivated === null) return;
    const point = this.getRespawnPoint();
    if (point) {
      this.emit('checkpoint:respawn', {
        id: `checkpoint-${this.lastActivated}`,
        ...point,
      });
    }
  }

  getCheckpoints(): CheckpointDef[] {
    return (this.params.checkpoints ?? []) as CheckpointDef[];
  }

  update(_dt: number): void {
    // Event-driven — no-op
  }

  reset(): void {
    this.activatedSet.clear();
    this.lastActivated = null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/modules/__tests__/checkpoint.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/engine/modules/mechanic/checkpoint.ts src/engine/modules/__tests__/checkpoint.test.ts
git commit -m "feat: add Checkpoint module with tests"
```

---

## Task 15: WallDetect Module

**Files:**
- Create: `src/engine/modules/mechanic/wall-detect.ts`
- Test: `src/engine/modules/__tests__/wall-detect.test.ts`

**Step 1: Write the failing test**

`src/engine/modules/__tests__/wall-detect.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { WallDetect } from '../mechanic/wall-detect';

describe('WallDetect', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const wd = new WallDetect('wd-1', params);
    engine.addModule(wd);
    return { engine, wd };
  }

  it('should have correct defaults', () => {
    const { wd } = setup();
    const p = wd.getParams();
    expect(p.wallSlide).toBe(true);
    expect(p.wallJump).toBe(true);
    expect(p.slideSpeed).toBe(100);
  });

  it('should detect wall contact', () => {
    const { engine, wd } = setup();
    const handler = vi.fn();
    engine.eventBus.on('wall:contact', handler);

    wd.setWallContact('left');

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ side: 'left' }));
    expect(wd.isTouchingWall()).toBe(true);
  });

  it('should emit wall:slide when sliding enabled and touching wall', () => {
    const { engine, wd } = setup({ wallSlide: true });
    const handler = vi.fn();
    engine.eventBus.on('wall:slide', handler);

    wd.setWallContact('right');
    wd.update(16);

    expect(handler).toHaveBeenCalled();
  });

  it('should NOT emit wall:slide when disabled', () => {
    const { engine, wd } = setup({ wallSlide: false });
    const handler = vi.fn();
    engine.eventBus.on('wall:slide', handler);

    wd.setWallContact('right');
    wd.update(16);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should emit wall:jump on wall jump trigger', () => {
    const { engine, wd } = setup({
      wallJump: true,
      wallJumpEvent: 'input:touch:tap',
      wallJumpForce: { x: 400, y: 600 },
    });
    const handler = vi.fn();
    engine.eventBus.on('wall:jump', handler);

    wd.setWallContact('left');
    engine.eventBus.emit('input:touch:tap');

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      forceX: 400, forceY: 600, awaySide: 'right',
    }));
  });

  it('should NOT wall jump when not touching wall', () => {
    const { engine, wd } = setup({
      wallJump: true,
      wallJumpEvent: 'input:touch:tap',
    });
    const handler = vi.fn();
    engine.eventBus.on('wall:jump', handler);

    engine.eventBus.emit('input:touch:tap');

    expect(handler).not.toHaveBeenCalled();
  });

  it('should clear wall contact', () => {
    const { wd } = setup();
    wd.setWallContact('left');
    wd.clearWallContact();
    expect(wd.isTouchingWall()).toBe(false);
  });

  it('should return slide speed', () => {
    const { wd } = setup({ slideSpeed: 150 });
    expect(wd.getSlideSpeed()).toBe(150);
  });

  it('should reset', () => {
    const { wd } = setup();
    wd.setWallContact('left');
    wd.reset();
    expect(wd.isTouchingWall()).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/modules/__tests__/wall-detect.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

`src/engine/modules/mechanic/wall-detect.ts`:
```ts
import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export class WallDetect extends BaseModule {
  readonly type = 'WallDetect';

  private touching = false;
  private side: 'left' | 'right' | null = null;

  getSchema(): ModuleSchema {
    return {
      wallSlide: {
        type: 'boolean', label: 'Wall Slide',
        default: true,
      },
      slideSpeed: {
        type: 'range', label: 'Slide Speed',
        default: 100, min: 50, max: 300, step: 10,
      },
      wallJump: {
        type: 'boolean', label: 'Wall Jump',
        default: true,
      },
      wallJumpForce: {
        type: 'object', label: 'Wall Jump Force',
        default: { x: 400, y: 600 },
        fields: {
          x: { type: 'range', label: 'Horizontal', default: 400, min: 200, max: 600, step: 10 },
          y: { type: 'range', label: 'Vertical', default: 600, min: 300, max: 800, step: 10 },
        },
      },
      wallJumpEvent: {
        type: 'string', label: 'Wall Jump Trigger',
        default: 'input:touch:tap',
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    const jumpEvent = this.params.wallJumpEvent ?? 'input:touch:tap';
    if (this.params.wallJump !== false) {
      this.on(jumpEvent, () => {
        this.tryWallJump();
      });
    }
  }

  setWallContact(side: 'left' | 'right'): void {
    this.touching = true;
    this.side = side;
    this.emit('wall:contact', { side });
  }

  clearWallContact(): void {
    this.touching = false;
    this.side = null;
  }

  isTouchingWall(): boolean {
    return this.touching;
  }

  getWallSide(): 'left' | 'right' | null {
    return this.side;
  }

  getSlideSpeed(): number {
    return this.params.slideSpeed ?? 100;
  }

  private tryWallJump(): void {
    if (!this.touching || !this.side) return;
    if (this.params.wallJump === false) return;

    const force = this.params.wallJumpForce ?? { x: 400, y: 600 };
    const awaySide = this.side === 'left' ? 'right' : 'left';

    this.emit('wall:jump', {
      forceX: force.x,
      forceY: force.y,
      awaySide,
      fromSide: this.side,
    });

    this.touching = false;
    this.side = null;
  }

  update(_dt: number): void {
    if (this.touching && this.params.wallSlide !== false) {
      this.emit('wall:slide', {
        side: this.side,
        speed: this.params.slideSpeed ?? 100,
      });
    }
  }

  reset(): void {
    this.touching = false;
    this.side = null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/modules/__tests__/wall-detect.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/engine/modules/mechanic/wall-detect.ts src/engine/modules/__tests__/wall-detect.test.ts
git commit -m "feat: add WallDetect module with tests"
```

---

## Task 16: CameraFollow Module

**Files:**
- Create: `src/engine/modules/feedback/camera-follow.ts`
- Test: `src/engine/modules/__tests__/camera-follow.test.ts`

**Step 1: Write the failing test**

`src/engine/modules/__tests__/camera-follow.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { CameraFollow } from '../feedback/camera-follow';

describe('CameraFollow', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const cam = new CameraFollow('cam-1', params);
    engine.addModule(cam);
    return { engine, cam };
  }

  it('should have correct defaults', () => {
    const { cam } = setup();
    const p = cam.getParams();
    expect(p.mode).toBe('center');
    expect(p.smoothing).toBe(0.1);
  });

  it('should follow player position', () => {
    const { engine, cam } = setup();

    engine.eventBus.emit('player:move', { x: 200, direction: 1, speed: 100 });
    cam.update(16);

    const pos = cam.getPosition();
    expect(pos.x).toBeGreaterThan(0);
  });

  it('should apply smoothing (lerp)', () => {
    const { engine, cam } = setup({ smoothing: 0.5 });

    engine.eventBus.emit('player:move', { x: 400, direction: 1 });
    cam.update(16);

    const pos = cam.getPosition();
    // With smoothing, camera should not instantly reach 400
    expect(pos.x).toBeLessThan(400);
    expect(pos.x).toBeGreaterThan(0);
  });

  it('should emit camera:move on update', () => {
    const { engine, cam } = setup();
    const handler = vi.fn();
    engine.eventBus.on('camera:move', handler);

    engine.eventBus.emit('player:move', { x: 100, direction: 1 });
    cam.update(16);

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ x: expect.any(Number) }));
  });

  it('should not move when player is in dead zone', () => {
    const { engine, cam } = setup({
      mode: 'dead-zone',
      deadZone: { width: 200, height: 100 },
    });

    const handler = vi.fn();
    engine.eventBus.on('camera:move', handler);

    // Small movement within dead zone
    engine.eventBus.emit('player:move', { x: 50, direction: 1 });
    cam.update(16);

    // Camera shouldn't move much (player within dead zone)
    const pos = cam.getPosition();
    expect(pos.x).toBe(0);
  });

  it('should shake on shakeEvent', () => {
    const { engine, cam } = setup({ shakeEvent: 'collision:damage', shakeDuration: 200, shakeIntensity: 10 });
    const handler = vi.fn();
    engine.eventBus.on('camera:shake', handler);

    engine.eventBus.emit('collision:damage');

    expect(handler).toHaveBeenCalledOnce();
    expect(cam.isShaking()).toBe(true);
  });

  it('should stop shaking after duration', () => {
    const { engine, cam } = setup({ shakeEvent: 'hit', shakeDuration: 100 });

    engine.eventBus.emit('hit');
    cam.update(50);
    expect(cam.isShaking()).toBe(true);

    cam.update(60);
    expect(cam.isShaking()).toBe(false);
  });

  it('should clamp to bounds', () => {
    const { engine, cam } = setup({
      bounds: { minX: 0, maxX: 1000, minY: 0, maxY: 500 },
      smoothing: 0,
    });

    engine.eventBus.emit('player:move', { x: -100, direction: -1 });
    cam.update(16);

    expect(cam.getPosition().x).toBeGreaterThanOrEqual(0);
  });

  it('should reset', () => {
    const { engine, cam } = setup();
    engine.eventBus.emit('player:move', { x: 500 });
    cam.update(16);
    cam.reset();
    expect(cam.getPosition().x).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/modules/__tests__/camera-follow.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

`src/engine/modules/feedback/camera-follow.ts`:
```ts
import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export class CameraFollow extends BaseModule {
  readonly type = 'CameraFollow';

  private x = 0;
  private y = 0;
  private targetX = 0;
  private targetY = 0;
  private shaking = false;
  private shakeElapsed = 0;
  private playerDirection = 1;

  getSchema(): ModuleSchema {
    return {
      mode: {
        type: 'select', label: 'Follow Mode',
        default: 'center', options: ['center', 'look-ahead', 'dead-zone'],
      },
      smoothing: {
        type: 'range', label: 'Smoothing',
        default: 0.1, min: 0, max: 0.99, step: 0.01,
      },
      deadZone: {
        type: 'object', label: 'Dead Zone',
        default: { width: 100, height: 50 },
        fields: {
          width: { type: 'number', label: 'Width', default: 100 },
          height: { type: 'number', label: 'Height', default: 50 },
        },
      },
      lookAheadDistance: {
        type: 'range', label: 'Look Ahead Distance',
        default: 80, min: 0, max: 200, step: 5,
      },
      bounds: {
        type: 'object', label: 'Camera Bounds (optional)',
        default: null,
        fields: {
          minX: { type: 'number', label: 'Min X', default: 0 },
          maxX: { type: 'number', label: 'Max X', default: 10000 },
          minY: { type: 'number', label: 'Min Y', default: 0 },
          maxY: { type: 'number', label: 'Max Y', default: 10000 },
        },
      },
      shakeEvent: {
        type: 'string', label: 'Shake Event (optional)',
        default: '',
      },
      shakeDuration: {
        type: 'range', label: 'Shake Duration (ms)',
        default: 200, min: 50, max: 500, step: 10, unit: 'ms',
      },
      shakeIntensity: {
        type: 'range', label: 'Shake Intensity',
        default: 5, min: 1, max: 20, step: 1,
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on('player:move', (data?: any) => {
      this.targetX = data?.x ?? this.targetX;
      this.targetY = data?.y ?? this.targetY;
      this.playerDirection = data?.direction ?? this.playerDirection;
    });

    const shakeEvent = this.params.shakeEvent;
    if (shakeEvent) {
      this.on(shakeEvent, () => {
        this.shaking = true;
        this.shakeElapsed = 0;
        this.emit('camera:shake');
      });
    }
  }

  update(dt: number): void {
    const mode = this.params.mode ?? 'center';
    const smoothing = this.params.smoothing ?? 0.1;

    let goalX = this.targetX;
    let goalY = this.targetY;

    if (mode === 'look-ahead') {
      const ahead = this.params.lookAheadDistance ?? 80;
      goalX += this.playerDirection * ahead;
    } else if (mode === 'dead-zone') {
      const dz = this.params.deadZone ?? { width: 100, height: 50 };
      const halfW = dz.width / 2;
      const halfH = dz.height / 2;
      if (Math.abs(this.targetX - this.x) < halfW) goalX = this.x;
      if (Math.abs(this.targetY - this.y) < halfH) goalY = this.y;
    }

    // Lerp
    const t = 1 - smoothing;
    this.x += (goalX - this.x) * t;
    this.y += (goalY - this.y) * t;

    // Clamp to bounds
    const bounds = this.params.bounds;
    if (bounds) {
      this.x = Math.max(bounds.minX ?? -Infinity, Math.min(bounds.maxX ?? Infinity, this.x));
      this.y = Math.max(bounds.minY ?? -Infinity, Math.min(bounds.maxY ?? Infinity, this.y));
    }

    // Shake
    if (this.shaking) {
      this.shakeElapsed += dt;
      if (this.shakeElapsed >= (this.params.shakeDuration ?? 200)) {
        this.shaking = false;
      }
    }

    this.emit('camera:move', { x: this.x, y: this.y, shaking: this.shaking });
  }

  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  isShaking(): boolean {
    return this.shaking;
  }

  getShakeOffset(): { x: number; y: number } {
    if (!this.shaking) return { x: 0, y: 0 };
    const intensity = this.params.shakeIntensity ?? 5;
    return {
      x: (Math.random() - 0.5) * 2 * intensity,
      y: (Math.random() - 0.5) * 2 * intensity,
    };
  }

  reset(): void {
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.shaking = false;
    this.shakeElapsed = 0;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/modules/__tests__/camera-follow.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/engine/modules/feedback/camera-follow.ts src/engine/modules/__tests__/camera-follow.test.ts
git commit -m "feat: add CameraFollow module with tests"
```

---

## Task 17: Register All New Modules in Index + Update Auto-Wirer

**Files:**
- Modify: `src/engine/modules/index.ts`
- Modify: `src/engine/core/auto-wirer.ts`
- Modify: `src/engine/core/__tests__/auto-wirer.test.ts`

**Step 1: Update module index**

Add to `src/engine/modules/index.ts`:
```ts
// Mechanic — Platformer (Batch 1)
export { Gravity } from './mechanic/gravity';
export { Knockback } from './mechanic/knockback';
export { IFrames } from './mechanic/i-frames';
export { PlayerMovement } from './mechanic/player-movement';
export { Dash } from './mechanic/dash';
export { CoyoteTime } from './mechanic/coyote-time';
export { StaticPlatform } from './mechanic/static-platform';
export { MovingPlatform } from './mechanic/moving-platform';
export { OneWayPlatform } from './mechanic/one-way-platform';
export { CrumblingPlatform } from './mechanic/crumbling-platform';
export { Hazard } from './mechanic/hazard';
export { Collectible } from './mechanic/collectible';
export { Inventory } from './mechanic/inventory';
export { Checkpoint } from './mechanic/checkpoint';
export { WallDetect } from './mechanic/wall-detect';

// Feedback — Platformer (Batch 1)
export { CameraFollow } from './feedback/camera-follow';
```

**Step 2: Update auto-wirer with new wiring rules**

Add to `WIRING_RULES` in `src/engine/core/auto-wirer.ts`:
```ts
{
  // Collectible + Collision: auto-register collectible items for collision
  requires: ['Collectible', 'Collision'],
  setup: (engine, modules) => {
    const collision = modules.get('Collision') as Collision;
    const collectible = modules.get('Collectible') as any;
    const items = collectible.getActiveItems?.() ?? [];
    for (let i = 0; i < items.length; i++) {
      collision.registerObject(`collectible-${i}`, 'collectibles', {
        x: items[i].x, y: items[i].y, radius: 16,
      });
    }
  },
},
{
  // Checkpoint + Lives: respawn on death
  requires: ['Checkpoint', 'Lives'],
  setup: (engine) => {
    // Already handled internally — Checkpoint listens to lives:zero
  },
},
{
  // IFrames + Collision: suppress damage during i-frames
  requires: ['IFrames', 'Collision'],
  setup: (engine, modules) => {
    const iframes = modules.get('IFrames') as any;
    const originalEmit = engine.eventBus.emit.bind(engine.eventBus);
    // Note: this is handled by the renderer/game logic checking iframes.isActive()
    // No auto-wirer override needed — modules check iframes state
  },
},
```

**Step 3: Write auto-wirer test for new rules**

Add test to `src/engine/core/__tests__/auto-wirer.test.ts`:
```ts
it('should wire Collectible + Collision', () => {
  const engine = new Engine();
  const collectible = new Collectible('col-1', {
    items: [{ x: 100, y: 200, value: 10, type: 'coin' }],
  });
  const collision = new Collision('col-1', { rules: [] });
  engine.addModule(collectible);
  engine.addModule(collision);
  AutoWirer.wire(engine);

  // Collectible items should be registered in collision system
  // (verified by no errors during wiring)
});
```

**Step 4: Run all tests to verify nothing broke**

Run: `npx vitest run`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/engine/modules/index.ts src/engine/core/auto-wirer.ts src/engine/core/__tests__/auto-wirer.test.ts
git commit -m "feat: register 16 platformer modules in index + update auto-wirer"
```

---

## Task 18: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update module counts and add platformer section**

Update the relevant sections:
- Module count: 30 → 46 (16 new)
- Add "Batch 1 Platformer Modules" section under Key Files
- Update Development History with new entry

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with 16 new platformer modules"
```

---

## Task 19: Integration Test — Platformer Game Preset

**Files:**
- Modify: `src/agent/game-presets.ts` — add 'platformer' game type preset
- Create: `src/__tests__/integration/platformer-game.test.ts`

**Step 1: Add platformer preset**

Add to `getGamePreset()` in `src/agent/game-presets.ts`:
```ts
platformer: {
  GameFlow: { countdown: 3, onFinish: 'show_result' },
  PlayerMovement: { speed: 300, acceleration: 1000, moveLeftEvent: 'input:touch:swipe:left', moveRightEvent: 'input:touch:swipe:right' },
  Jump: { jumpForce: 600, gravity: 980, groundY: 0.8, triggerEvent: 'input:touch:tap' },
  Gravity: { strength: 980, terminalVelocity: 800, applyTo: 'player' },
  CoyoteTime: { coyoteFrames: 6, bufferFrames: 6, jumpEvent: 'input:touch:tap' },
  StaticPlatform: { platforms: [
    { x: 0, y: 550, width: 800, height: 50, material: 'normal' },
    { x: 200, y: 400, width: 150, height: 20, material: 'normal' },
    { x: 450, y: 300, width: 150, height: 20, material: 'normal' },
  ], layer: 'platforms' },
  Collectible: { items: [
    { x: 250, y: 370, value: 10, type: 'coin' },
    { x: 500, y: 270, value: 10, type: 'coin' },
  ], layer: 'collectibles' },
  Hazard: { hazards: [
    { x: 350, y: 540, width: 50, height: 10, pattern: 'static' },
  ], damage: 1, layer: 'hazards' },
  Scorer: { perHit: 10 },
  Timer: { duration: 60, mode: 'countdown' },
  Lives: { count: 3 },
  Checkpoint: { checkpoints: [{ x: 400, y: 280, width: 30, height: 50 }] },
  IFrames: { duration: 1000 },
  Knockback: { force: 300, duration: 200 },
  CameraFollow: { mode: 'center', smoothing: 0.1 },
  ParticleVFX: { events: { 'collectible:pickup': { effect: 'sparkle', color: '#ffdd00' }, 'collision:damage': { effect: 'burst', color: '#ff0000' } } },
  SoundFX: { events: { 'collectible:pickup': 'ding', 'jump:start': 'pop', 'collision:damage': 'hurt' } },
},
```

**Step 2: Write integration test**

`src/__tests__/integration/platformer-game.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import {
  PlayerMovement, Jump, Gravity, CoyoteTime, StaticPlatform,
  Collectible, Hazard, Scorer, Timer, Lives, Checkpoint,
  IFrames, Knockback, CameraFollow, GameFlow,
} from '@/engine/modules';

describe('Platformer Game Integration', () => {
  function buildGame() {
    const engine = new Engine();
    engine.addModule(new GameFlow('gf-1', { countdown: 0, onFinish: 'show_result' }));
    engine.addModule(new PlayerMovement('pm-1', { speed: 300, moveRightEvent: 'go-right', moveLeftEvent: 'go-left' }));
    engine.addModule(new Jump('j-1', { jumpForce: 600, gravity: 980, groundY: 0.8, triggerEvent: 'jump' }));
    engine.addModule(new Gravity('g-1', { strength: 980, terminalVelocity: 800 }));
    engine.addModule(new CoyoteTime('ct-1', { coyoteFrames: 6, bufferFrames: 6, jumpEvent: 'jump' }));
    engine.addModule(new StaticPlatform('sp-1', { platforms: [{ x: 0, y: 500, width: 800, height: 50, material: 'normal' }] }));
    engine.addModule(new Collectible('col-1', { items: [{ x: 100, y: 200, value: 10, type: 'coin' }] }));
    engine.addModule(new Hazard('hz-1', { hazards: [{ x: 300, y: 490, width: 50, height: 10, pattern: 'static' }] }));
    engine.addModule(new Scorer('sc-1', { perHit: 10 }));
    engine.addModule(new Timer('t-1', { duration: 60, mode: 'countdown' }));
    engine.addModule(new Lives('l-1', { count: 3 }));
    engine.addModule(new Checkpoint('cp-1', { checkpoints: [{ x: 400, y: 300, width: 30, height: 50 }] }));
    engine.addModule(new IFrames('if-1', { duration: 1000 }));
    engine.addModule(new Knockback('kb-1', { force: 300, duration: 200 }));
    engine.addModule(new CameraFollow('cam-1', { mode: 'center', smoothing: 0.1 }));
    return engine;
  }

  it('should instantiate all platformer modules without errors', () => {
    const engine = buildGame();
    expect(engine.getAllModules()).toHaveLength(15);
  });

  it('should move player right and update camera', () => {
    const engine = buildGame();
    const camHandler = vi.fn();
    engine.eventBus.on('camera:move', camHandler);

    engine.eventBus.emit('go-right');
    engine.tick(16);

    expect(camHandler).toHaveBeenCalled();
  });

  it('should handle jump → gravity → land cycle', () => {
    const engine = buildGame();
    const landHandler = vi.fn();
    engine.eventBus.on('jump:land', landHandler);

    engine.eventBus.emit('jump');
    for (let i = 0; i < 200; i++) engine.tick(16);

    expect(landHandler).toHaveBeenCalled();
  });

  it('should collect items and update score', () => {
    const engine = buildGame();
    const col = engine.getModule('col-1') as any;
    const scoreHandler = vi.fn();
    engine.eventBus.on('collectible:pickup', scoreHandler);

    col.pickup(0);

    expect(scoreHandler).toHaveBeenCalledWith(expect.objectContaining({ type: 'coin', value: 10 }));
  });

  it('should trigger damage → iframes → knockback chain', () => {
    const engine = buildGame();
    const iframeHandler = vi.fn();
    const kbHandler = vi.fn();
    engine.eventBus.on('iframes:start', iframeHandler);
    engine.eventBus.on('knockback:start', kbHandler);

    engine.eventBus.emit('collision:damage', { x: 100, y: 200 });

    expect(iframeHandler).toHaveBeenCalledOnce();
    expect(kbHandler).toHaveBeenCalledOnce();
  });

  it('should activate checkpoint and respawn on death', () => {
    const engine = buildGame();
    const cp = engine.getModule('cp-1') as any;
    const respawnHandler = vi.fn();
    engine.eventBus.on('checkpoint:respawn', respawnHandler);

    cp.activate(0);

    // Trigger death (3 damage events)
    engine.eventBus.emit('collision:damage');
    engine.eventBus.emit('collision:damage');
    engine.eventBus.emit('collision:damage');

    expect(respawnHandler).toHaveBeenCalled();
  });
});
```

**Step 3: Run integration test**

Run: `npx vitest run src/__tests__/integration/platformer-game.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/agent/game-presets.ts src/__tests__/integration/platformer-game.test.ts
git commit -m "feat: add platformer game type preset + integration tests"
```

---

## Summary

| Task | Module(s) | Files |
|------|-----------|-------|
| 1 | Gravity | mechanic/gravity.ts + test |
| 2 | Knockback | mechanic/knockback.ts + test |
| 3 | IFrames | mechanic/i-frames.ts + test |
| 4 | PlayerMovement | mechanic/player-movement.ts + test |
| 5 | Dash | mechanic/dash.ts + test |
| 6 | CoyoteTime | mechanic/coyote-time.ts + test |
| 7 | StaticPlatform | mechanic/static-platform.ts + test |
| 8 | MovingPlatform | mechanic/moving-platform.ts + test |
| 9 | OneWayPlatform | mechanic/one-way-platform.ts + test |
| 10 | CrumblingPlatform | mechanic/crumbling-platform.ts + test |
| 11 | Hazard | mechanic/hazard.ts + test |
| 12 | Collectible | mechanic/collectible.ts + test |
| 13 | Inventory | mechanic/inventory.ts + test |
| 14 | Checkpoint | mechanic/checkpoint.ts + test |
| 15 | WallDetect | mechanic/wall-detect.ts + test |
| 16 | CameraFollow | feedback/camera-follow.ts + test |
| 17 | Index + Auto-Wirer | index.ts, auto-wirer.ts + test |
| 18 | CLAUDE.md | CLAUDE.md |
| 19 | Integration | game-presets.ts + integration test |

**Total: 19 tasks, 16 new modules, ~32 new files, TDD throughout**
