# M3: ScrollingLayers Module — Completion Plan

## Status: Core Engine DONE, Integration Gaps Remaining

### Already Complete (tests passing)
- `src/engine/modules/mechanic/scrolling-layers.ts` — ScrollingLayers module (BaseModule, 88 lines)
- `src/engine/systems/scrolling-layers/` — ScrollingLayersSystem + types + index
- `src/engine/module-setup.ts` — ScrollingLayers registered (L150)
- `src/engine/core/events.ts` — scrolling:update, scrolling:set-speed, scrolling:set-direction
- System calculates per-layer offsets with ratio-based parallax, axis support, loop wrapping
- Tests: scrolling-layers-system.test.ts (152 lines) + scrolling-layers.test.ts (115 lines)

### Dual-Model Analysis (2026-04-06)
- Codex SESSION: 019d602a-898a-7f71-9d2b-0a372cb0c153
- Gemini: policy-constrained read-only analysis

---

## Task Type
- [x] Backend (Codex authority: bridges, renderer sync, asset pipeline)
- [x] Frontend (Gemini authority: TilingSprite rendering, layer depth, visual design)

## Technical Approach

### ParallaxRenderer (CRITICAL)
**Pattern**: New sub-renderer class using PixiJS TilingSprite for infinite scrolling
**Placement**: Between background (bgSprite/backgroundGraphics) and cameraLayer in PixiJS stage
**Texture source**: config.assets[textureId].src (data URL) with procedural fallback for missing assets
**Update**: Listen to scrolling:update event, apply `tilingSprite.tilePosition.set(offsetX, offsetY)`
**Layer depth**: 3 layers recommended — ratio 0.2 (far/slow), 0.5 (mid), 1.0 (near/fast)

### AutoWirer Bridge
**Runner + ScrollingLayers**: Sync runner speed to scrolling speed via runner:distance event
**Deferred**: DifficultyRamp + ScrollingLayers, Tween + ScrollingLayers (can add later, not critical for MVP)

---

## Implementation Steps

### Step 1: Module Export + Agent Integration (TRIVIAL)
**Files:**
| File | Operation | Description |
|------|-----------|-------------|
| `src/engine/modules/index.ts` | Modify | Add `export { ScrollingLayers } from './mechanic/scrolling-layers'` |
| `src/agent/conversation-defs.ts` | Modify | Add `'ScrollingLayers'` to ALL_MODULES |

---

### Step 2: ParallaxRenderer (HIGH)
**File:** `src/engine/renderer/parallax-renderer.ts` (Create)

**Pseudo-code:**
```typescript
export class ParallaxRenderer {
  private container: Container;
  private layerSprites = new Map<string, TilingSprite>();
  private textureCache = new Map<string, Texture>();
  private viewW: number;
  private viewH: number;

  constructor(parent: Container, viewW: number, viewH: number) {
    this.container = new Container();
    parent.addChild(this.container);
    this.viewW = viewW;
    this.viewH = viewH;
  }

  updateFromStates(engine: Engine, states: ReadonlyArray<LayerState>): void {
    const assets = engine.getConfig().assets ?? {};
    const seen = new Set<string>();
    for (const { textureId, ratio, offsetX, offsetY } of states) {
      let sprite = this.layerSprites.get(textureId);
      if (!sprite) {
        const tex = this.resolveTexture(textureId, assets);
        sprite = new TilingSprite({ texture: tex, width: this.viewW, height: this.viewH });
        this.container.addChild(sprite);
        this.layerSprites.set(textureId, sprite);
      }
      sprite.tilePosition.set(offsetX, offsetY);
      sprite.visible = true;
      seen.add(textureId);
    }
    // Hide layers no longer in states
    for (const [id, s] of this.layerSprites) {
      if (!seen.has(id)) s.visible = false;
    }
  }

  private resolveTexture(textureId: string, assets: Record<string, any>): Texture {
    const src = assets[textureId]?.src;
    if (src?.startsWith('data:')) {
      // Load from data URL via canvas (same pattern as game-object-renderer)
      return this.textureFromDataUrl(src);
    }
    // Procedural fallback: semi-transparent stripe pattern
    return this.buildProceduralTile();
  }

  resize(w: number, h: number): void { ... }
  reset(): void { ... }
  destroy(): void { ... }
}
```

---

### Step 3: PixiRenderer Integration (HIGH)
**File:** `src/engine/renderer/pixi-renderer.ts` (Modify)

- Add `private parallaxRenderer: ParallaxRenderer | null = null;`
- In `init()`: Create ParallaxRenderer, insert container between background and cameraLayer
- In `connectToEngine()`: `listen('scrolling:update', ...)` → call `parallaxRenderer.updateFromStates()`
- In `resize()`: Forward to parallaxRenderer
- In `destroy()`: Cleanup parallaxRenderer
- In `connectToEngine()` reset: `parallaxRenderer.reset()`

---

### Step 4: AutoWirer Bridge — Runner+ScrollingLayers (MEDIUM)
**File:** `src/engine/core/auto-wirer.ts`

```typescript
{
  requires: ['Runner', 'ScrollingLayers'],
  setup: (engine, _modules, on) => {
    on('runner:distance', (data?: unknown) => {
      const d = asRecord(data);
      const speed = Number(d.speed);
      if (Number.isFinite(speed)) {
        engine.eventBus.emit('scrolling:set-speed', { speed });
      }
    });
  },
},
```

**Tests:**
| File | Tests |
|------|-------|
| `src/engine/modules/__tests__/scrolling-bridge.test.ts` | runner:distance syncs scrolling speed, no bridge without ScrollingLayers |

---

### Step 5: Knowledge File (MEDIUM)
**File:** `src/knowledge/modules/mechanic/scrolling-layers.md` (Create)

Content: Module overview, layer config, events, bridges, depth ratios, best practices

---

### Step 6: Preset Conversions (MEDIUM)
**File:** `src/agent/game-presets.ts` (Modify)

Add ScrollingLayers to runner, racing, swimmer presets with 3-layer configs:
- `bg_far` (ratio 0.2), `bg_mid` (ratio 0.5), `bg_near` (ratio 1.0)
- runner/racing: axis='horizontal', swimmer: axis='vertical'

**Tests:**
| File | Tests |
|------|-------|
| `src/agent/__tests__/preset-scrolling.test.ts` | runner/racing/swimmer include ScrollingLayers with valid config |

---

## Key Files

| File | Operation | Step |
|------|-----------|------|
| `src/engine/modules/index.ts` | Modify | 1 |
| `src/agent/conversation-defs.ts` | Modify | 1 |
| `src/engine/renderer/parallax-renderer.ts` | Create | 2 |
| `src/engine/renderer/pixi-renderer.ts` | Modify | 3 |
| `src/engine/core/auto-wirer.ts` | Modify | 4 |
| `src/knowledge/modules/mechanic/scrolling-layers.md` | Create | 5 |
| `src/agent/game-presets.ts` | Modify | 6 |
| `src/engine/renderer/__tests__/parallax-renderer.test.ts` | Create | 2 |
| `src/engine/modules/__tests__/scrolling-bridge.test.ts` | Create | 4 |
| `src/agent/__tests__/preset-scrolling.test.ts` | Create | 6 |

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Z-order drift when bgSprite toggles | Parallax behind background | Explicit container index management in syncBackgroundImage |
| No parallax textures configured | Empty/invisible layers | Procedural fallback tiles (stripes/gradient) |
| TilingSprite texture memory | GPU memory leak | Cache by dataUrl, destroy old textures on asset change |
| Runner speed=0 causes static parallax | No visual feedback | Runner always has positive speed after start |

## Dependencies
- Step 1 (Exports) — independent
- Step 2 (ParallaxRenderer) — independent
- Step 3 (PixiRenderer integration) — depends on Step 2
- Step 4 (Bridge) — independent
- Step 5 (Knowledge) — independent
- Step 6 (Presets) — depends on Steps 2-4

## Execution Strategy
```
Parallel:
  Agent A: Step 1 (Exports) + Step 2 (ParallaxRenderer) + Step 3 (PixiRenderer)
  Agent B: Step 4 (Bridge) + Step 5 (Knowledge)
Sequential after both:
  Step 6 (Preset conversions)
```

Estimated test count: ~15 new tests across 3 test files

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: 019d602a-898a-7f71-9d2b-0a372cb0c153
- GEMINI_SESSION: (policy mode, no persistent session)
