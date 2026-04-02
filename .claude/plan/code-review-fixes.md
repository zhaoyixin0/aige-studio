# Implementation Plan: Code Review Bug Fixes

> 修复代码审查发现的 HIGH/MEDIUM 问题，经 Codex + Gemini 双模型验证后的最终方案

## Task Type
- [x] Backend (→ Codex)
- [ ] Frontend (→ Gemini)
- [ ] Fullstack

---

## Bug Validation Summary

经双模型分析，原始 9 HIGH + 13 MEDIUM 裁决如下：

| Original | Bug | Validated Severity | Action |
|----------|-----|-------------------|--------|
| H1 | pixi-renderer config mutation | **HIGH** | Fix |
| H2 | `_disabled` via any cast | **HIGH** | Fix |
| H3 | removeModule no try-catch | **HIGH** | Fix |
| H4 | Shield consumes missing | **MEDIUM** | Fix |
| H5 | WaveSpawner gameflow:resume | **NOT A BUG** | Skip — universal lifecycle event, migration plan excludes |
| H6 | CameraFollow shakeEvent | **MEDIUM** | Fix |
| H7/H8 | Test `any` types | **LOW** | Skip — originates from production types |
| H9 | Renderer test weak | **LOW** | Optional improvement |
| M1 | addModule destroy guard | **MEDIUM** | Fix |
| M2 | EventBus console.error | **MEDIUM** | Fix |
| M3 | ContractRegistry probe | **LOW** | Skip — document only |
| M4 | updateAsset configVersion | **NOT A BUG** | Skip — intentional hot-swap design |
| M5 | File length 528 lines | **INVALID** | Skip — actual ~475 lines |
| M6 | Gravity toggleEvent | **MEDIUM** | Fix |
| M7 | enemy:attack no consumer | **LOW** | Skip — product backlog |
| M8 | SkillTree dynamic emits | **LOW** | Add comment only |
| M9-M13 | Test quality | **LOW** | Optional improvement |

**Scope: 9 fixes (3 HIGH + 4 MEDIUM + 2 improvements)**

---

## Technical Solution

### Fix 1: Module lifecycle error handling (H3 + M1)
**Priority: 1 — Crash prevention**

`removeModule()` 需要 try-catch 防止已损坏模块的 onDetach/destroy 抛异常导致崩溃，同时始终从 Map 中删除。
`addModule()` catch 中的 `destroy()` 也需要 try-catch 防止丢失原始错误。

```typescript
// engine.ts — removeModule
removeModule(id: string): void {
  const module = this.modules.get(id);
  if (!module) return;
  this.modules.delete(id);  // Always remove first
  try {
    module.onDetach(this);
  } catch (err) {
    this.eventBus.emit('engine:module-error', {
      moduleId: module.id, moduleType: module.type, error: err,
    });
  }
  try {
    module.destroy();
  } catch (err) {
    this.eventBus.emit('engine:module-error', {
      moduleId: module.id, moduleType: module.type, error: err,
    });
  }
}

// engine.ts — addModule catch
catch (err) {
  try { module.destroy(); } catch { /* best-effort */ }
  throw err;
}
```

### Fix 2: Replace `_disabled` hack (H2)
**Priority: 2 — Type safety + observability**

用 `Set<string>` 替代 `(mod as any)._disabled`，在 `restart()` 中清空。

```typescript
// engine.ts
private disabledModules = new Set<string>();

tick(dt: number): void {
  for (const mod of this.modules.values()) {
    if (this.disabledModules.has(mod.id)) continue;
    try {
      mod.update(dt);
    } catch (err) {
      this.disabledModules.add(mod.id);
      this.eventBus.emit('engine:module-error', { ... });
    }
  }
}

restart(): void {
  this.stop();
  for (const mod of this.modules.values()) {
    mod.onDetach(this);
    mod.destroy();
  }
  this.modules.clear();
  this.disabledModules.clear();
  this.eventBus.clearAll();
}
```

### Fix 3: Remove renderer config mutation (H1)
**Priority: 3 — Immutability invariant**

删除 pixi-renderer.ts:120-121 的写回操作。renderer 使用本地 `bgAsset` 变量即可，不修改 engine config。

```typescript
// pixi-renderer.ts — syncBackgroundImage
// BEFORE (违反不可变性):
const engineConfig = engine.getConfig();
engineConfig.assets = { ...engineConfig.assets, background: bgAsset };

// AFTER (只读 config):
// Just use bgAsset locally, no write-back to engine config
```

### Fix 4: Dynamic consumes contracts (H4 + H6 + M6)
**Priority: 4 — Contract accuracy**

Shield, CameraFollow, Gravity 的 `getContracts()` 需要包含动态事件。

```typescript
// shield.ts
getContracts(): ModuleContracts {
  const damageEvent: string = (this.params.damageEvent as string) ?? 'collision:damage';
  return {
    emits: ['shield:absorbed', 'shield:damage:passthrough', 'shield:block', 'shield:break', 'shield:recharge'],
    consumes: [damageEvent],
  };
}

// camera-follow.ts
getContracts(): ModuleContracts {
  const shakeEvent: string = this.params.shakeEvent ?? '';
  return {
    emits: ['camera:shake', 'camera:move'],
    consumes: shakeEvent ? ['player:move', shakeEvent] : ['player:move'],
  };
}

// gravity.ts
getContracts(): ModuleContracts {
  const toggleEvent: string = this.params.toggleEvent ?? '';
  return {
    emits: ['gravity:falling', 'gravity:landed'],
    consumes: toggleEvent
      ? ['jump:start', 'dash:start', 'dash:end', toggleEvent]
      : ['jump:start', 'dash:start', 'dash:end'],
  };
}
```

### Fix 5: EventBus error logging gating (M2)
**Priority: 5 — 生产性能**

handler 异常的 `console.error` 改为只在 debug 模式触发，避免 60fps 场景下刷屏。

```typescript
// event-bus.ts
catch (err) {
  if (this.debug) {
    console.error(`[EventBus] Handler error on "${event}":`, err);
  }
}
```

### Fix 6: SkillTree dynamic emits comment (M8)
**Priority: 6 — 文档准确性**

在 SkillTree.getContracts() 中添加注释说明动态 effect 事件。

---

## Implementation Steps

1. **Step 1** — Fix removeModule + addModule error handling (engine.ts) + tests
2. **Step 2** — Replace `_disabled` with `disabledModules: Set<string>` (engine.ts) + update tests
3. **Step 3** — Remove renderer config write-back (pixi-renderer.ts)
4. **Step 4** — Fix Shield/CameraFollow/Gravity dynamic consumes
5. **Step 5** — Gate EventBus console.error behind debug flag
6. **Step 6** — Add SkillTree getContracts comment
7. **Step 7** — Run full test suite, verify 1668 tests still pass

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `src/engine/core/engine.ts` | Modify | Fix 1 (lifecycle errors) + Fix 2 (`_disabled` → Set) |
| `src/engine/renderer/pixi-renderer.ts:120-121` | Modify | Fix 3 (remove config mutation) |
| `src/engine/modules/mechanic/shield.ts` | Modify | Fix 4 (add consumes) |
| `src/engine/modules/feedback/camera-follow.ts` | Modify | Fix 4 (add shakeEvent to consumes) |
| `src/engine/modules/mechanic/gravity.ts` | Modify | Fix 4 (add toggleEvent to consumes) |
| `src/engine/core/event-bus.ts` | Modify | Fix 5 (gate console.error) |
| `src/engine/modules/mechanic/skill-tree.ts` | Modify | Fix 6 (add comment) |
| `src/engine/core/__tests__/engine.test.ts` | Modify | Update tests for new patterns |

---

## Rejected / Skipped Items

| Item | Reason |
|------|--------|
| H5 WaveSpawner gameflow:resume | 通用生命周期事件，迁移计划明确排除 BaseModule 默认事件 |
| H7/H8 Test `any` | 源自生产类型 `Record<string, any>`，需从 types.ts 修改 |
| M4 updateAsset configVersion | 故意设计：asset 热替换不触发 engine reload |
| M5 文件长度 | 验证失败，实际 ~475 行 |
| M7 enemy:attack 无消费方 | 产品功能缺口，非代码缺陷 |

---

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| removeModule 行为变化（不再抛出） | emit engine:module-error 事件，调用方可监听 |
| pixi-renderer 删除 config 写回后 asset 同步断开 | renderer 已有 store 轮询 fallback，不依赖 config 写回 |
| EventBus 关闭 console.error 后丢失错误信息 | debug 模式仍有输出，生产用 engine:module-error 事件 |

---

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: 019d4af4-88bf-7df0-9ca2-7d2960383db7
- GEMINI_SESSION: (direct CLI, no session)
