# Implementation Plan: Engine Reliability Hardening

> 全面架构可靠性加固 — 基于 Codex + Gemini 双模型交叉分析

## Task Type
- [x] Frontend (→ Gemini)
- [x] Backend (→ Codex)
- [x] Fullstack (→ Parallel)

---

## Technical Solution

综合 Codex（后端架构/引擎可靠性）和 Gemini（前端/UX/渲染管线）的独立分析，
发现 **4 个 Critical、6 个 High、7 个 Medium** 级别问题。核心策略：

1. **Phase 1 — Fault Isolation（崩溃防护）**: 引擎级 try-catch + EventBus 错误隔离
2. **Phase 2 — State Consistency（状态一致性）**: 参数同步修复 + 事务性加载
3. **Phase 3 — Memory & Lifecycle（内存/生命周期）**: 纹理清理 + 卸载安全 + HiDPI
4. **Phase 4 — Validation Hardening（验证加固）**: 自动生成验证数据 + gameflowPaused 合规检查

---

## Findings Summary

### Critical (必须修复 — 游戏崩溃/数据丢失)

| # | Issue | Source | File | Evidence |
|---|-------|--------|------|----------|
| C1 | **Engine.tick() 无 try-catch** — 任何模块 update() 抛异常将停止整个游戏循环，RAF 不再调度 | Codex | `engine.ts:80-101` | tick() 直接迭代 modules.values() 无保护 |
| C2 | **EventBus.emit() 无错误隔离** — handler 异常传播到 tick()，同样终止游戏 | Codex | `event-bus.ts:36-56` | exact+wildcard handlers 均无 try-catch |
| C3 | **AI 参数修改不触发引擎更新** — modify_game→set_param 改 params 但 configStructureKey 只追踪 id/type/enabled | Gemini+验证 | `preview-canvas.tsx:15-23` | set_param 改 params，structureKey 不变 |
| C4 | **GameObjectRenderer.textureCache WebGL 内存泄漏** — PixiRenderer.destroy() 设 null 但不调用子渲染器 destroy() | Gemini+验证 | `pixi-renderer.ts:424` | `this.gameObjectRenderer = null` 未调 destroy |

### High (严重 — 功能异常/性能退化)

| # | Issue | Source | File |
|---|-------|--------|------|
| H1 | **PixiJS 无 HiDPI 支持** — 未设 resolution/autoDensity，移动端/Retina 模糊 | Gemini | `pixi-renderer.ts:44-51` |
| H2 | **Canvas 无 touch-action:none** — 移动端手势触发浏览器滚动而非游戏输入 | Gemini | `use-engine.ts:114-120` |
| H3 | **AutoWirer Phase D 大量 as any** — platform 模块调用未做类型/运行时检查，重构会静默失败 | Codex | `auto-wirer.ts:16-126` |
| H4 | **Error Boundary 不捕获异步/引擎错误** — RAF 内异常和 PixiJS 崩溃绕过 React 错误边界 | Gemini+Codex | `error-boundary.tsx` |
| H5 | **Engine.addModule 失败可留损坏模块** — init() 抛异常但模块已插入 modules Map | Codex | `engine.ts:28-33` |
| H6 | **Renderer.connectToEngine 竞态** — 若 loadConfig 在 init 完成前调用，event wiring 静默跳过 | Gemini | `pixi-renderer.ts:226-227` |

### Medium (中等 — 可靠性/可维护性风险)

| # | Issue | Source | File |
|---|-------|--------|------|
| M1 | **useEngine 卸载不调 engine.restart()** — 模块 destroy() 不执行，定时器/DOM 监听泄漏 | Codex | `use-engine.ts:137-160` |
| M2 | **PixiRenderer 直接修改 gameflowPaused** — 突破 BaseModule 封装 | Codex+验证 | `pixi-renderer.ts:372-376` |
| M3 | **Validator KNOWN_MODULE_TYPES 硬编码漂移** — 与 module-setup.ts 可能不同步 | Codex | `config-validator.ts:44-67` |
| M4 | **RAF 渲染帧内 string hash** — GameObjectRenderer.sync 每帧拼接字符串做资产变化检测 | Gemini+验证 | `game-object-renderer.ts:42-75` |
| M5 | **Asset fulfillment 竞态** — 快速连续消息可能把旧资产注入新游戏 | Gemini | `studio-chat-panel.tsx` |
| M6 | **ConfigLoader strict 默认 false** — 无效配置静默加载 | Codex | `config-loader.ts:25-28` |
| M7 | **gameflowPaused 合规性未审计** — 63 个模块中是否全部检查尚未验证 | Codex | `base-module.ts:22` |

---

## Implementation Steps

### Phase 1: Fault Isolation（崩溃防护）— 最高优先级

**Step 1.1** — Engine.tick() per-module error isolation
- File: `src/engine/core/engine.ts:98-102`
- 改为 per-module try-catch，异常模块标记 disabled，emit `engine:module-error`
- 在 start() 的 loop 中确保 finally 调度下一个 RAF
- Pseudo-code:
```typescript
tick(dt: number): void {
  for (const mod of this.modules.values()) {
    if ((mod as any)._disabled) continue;
    try {
      mod.update(dt);
    } catch (err) {
      (mod as any)._disabled = true;
      this.eventBus.emit('engine:module-error', {
        moduleId: mod.id, moduleType: mod.type, error: err,
      });
    }
  }
}
```
- start() loop:
```typescript
const loop = (now: number) => {
  if (!this.running) return;
  try {
    const dt = now - this.lastTime;
    this.lastTime = now;
    this.tick(dt);
  } finally {
    if (this.running) this.rafId = requestAnimationFrame(loop);
  }
};
```

**Step 1.2** — EventBus.emit() handler error isolation
- File: `src/engine/core/event-bus.ts:36-56`
- 每个 handler 调用包裹 try-catch，异常记录 event+handler 信息
- Pseudo-code:
```typescript
emit(event: string, data?: any): void {
  const exact = this.listeners.get(event);
  if (exact) {
    for (const handler of exact) {
      try { handler(data); } catch (err) {
        console.error(`[EventBus] Handler error on "${event}":`, err);
      }
    }
  }
  // ...wildcard 同理
}
```

**Step 1.3** — Engine.addModule 原子性
- File: `src/engine/core/engine.ts:28-33`
- init/onAttach 前不插入 Map；失败时回滚
```typescript
addModule(module: GameModule): void {
  try {
    module.init(this);
    module.onAttach(this);
    this.modules.set(module.id, module);
  } catch (err) {
    module.destroy();
    throw err;
  }
}
```

**Step 1.4** — Global error listeners for engine crashes
- File: `src/app/hooks/use-engine.ts` 或 `App.tsx`
- 添加 `window.addEventListener('error')` 和 `'unhandledrejection'`
- 捕获引擎错误时显示 toast 或触发 ErrorBoundary

### Phase 2: State Consistency（状态一致性）

**Step 2.1** — 修复 AI 参数修改不触发引擎更新 (C3)
- File: `src/store/game-store.ts` + `src/ui/preview/preview-canvas.tsx`
- 方案: 在 GameStore 添加 `configVersion: number`，每次 setConfig/updateModuleParam 递增
- PreviewCanvas 的 configStructureKey 改为包含 configVersion
- Pseudo-code (game-store):
```typescript
configVersion: 0,
setConfig: (config) => set({ config, configVersion: get().configVersion + 1 }),
updateModuleParam: (id, key, val) => set((s) => ({
  config: /* immutable update */,
  configVersion: s.configVersion + 1,
})),
```
- PreviewCanvas:
```typescript
const configVersion = useGameStore((s) => s.configVersion);
// useEffect deps: [engineReady, configVersion, ...]
```

**Step 2.2** — Renderer connectToEngine 竞态修复 (H6)
- File: `src/app/hooks/use-engine.ts:128-135` + `pixi-renderer.ts:226`
- 在 initPromise.then() 后检查是否有待连接的 engine，自动调用 connectToEngine
- Pseudo-code:
```typescript
// use-engine.ts initPromise.then():
.then(() => {
  if (!disposed) {
    setReady(true);
    // Auto-connect if engine already loaded
    if (engineRef.current && rendererRef.current) {
      rendererRef.current.connectToEngine(engineRef.current);
    }
  }
})
```
- 或在 PixiRenderer 添加 pendingEngine 队列

**Step 2.3** — Asset fulfillment 竞态保护 (M5)
- File: `src/ui/chat/studio-chat-panel.tsx`
- 在 triggerAssetFulfillment 中捕获发起时的 configVersion
- callback 中校验 currentVersion === capturedVersion 再应用

### Phase 3: Memory & Lifecycle（内存/生命周期）

**Step 3.1** — GameObjectRenderer.destroy() (C4)
- File: `src/engine/renderer/game-object-renderer.ts`
- 添加 destroy() 方法：清理 textureCache、sprites、playerSprite
```typescript
destroy(): void {
  for (const tex of this.textureCache.values()) tex.destroy(true);
  this.textureCache.clear();
  for (const sprite of this.sprites.values()) sprite.destroy({ children: true });
  this.sprites.clear();
  if (this.playerSprite) {
    this.playerSprite.destroy({ children: true });
    this.playerSprite = null;
  }
  this.platformGraphics?.destroy();
  this.platformGraphics = null;
}
```
- File: `src/engine/renderer/pixi-renderer.ts:424`
- 改为: `this.gameObjectRenderer?.destroy(); this.gameObjectRenderer = null;`

**Step 3.2** — useEngine 卸载安全 (M1)
- File: `src/app/hooks/use-engine.ts:137-160`
- cleanup 中先调 `engineRef.current?.restart()` 确保所有模块 destroy()
- 移除多余的 `new Engine()` 创建（延迟到下次 mount）

**Step 3.3** — PixiJS HiDPI + touch-action (H1, H2)
- File: `src/engine/renderer/pixi-renderer.ts:44-51`
```typescript
await this.app.init({
  canvas, width, height,
  backgroundColor: 0x111827,
  antialias: true,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
});
```
- File: `src/app/hooks/use-engine.ts:114-120`
```typescript
canvas.style.touchAction = 'none';
```

**Step 3.4** — PixiRenderer 封装修复 (M2)
- File: `src/engine/renderer/pixi-renderer.ts:372-376`
- 替换直接 `gameflowPaused = true` 为通过 engine.eventBus.emit('gameflow:pause')
- 或在 BaseModule 添加 `resetForRestart()` 公开方法

### Phase 4: Validation Hardening（验证加固）

**Step 4.1** — Eliminate validator drift (M3)
- File: `src/engine/core/config-validator.ts:44-67, 69-91`
- 方案: 在 build time 或 engine boot 时从 ModuleRegistry 自动生成:
  - KNOWN_MODULE_TYPES
  - MODULE_DEPENDENCIES（从各模块 getDependencies() 提取）
- 短期: 添加集成测试验证 KNOWN_MODULE_TYPES === ModuleRegistry.keys()

**Step 4.2** — gameflowPaused compliance audit (M7)
- 添加 CI 测试：扫描所有 63 个模块的 update() 方法
- 必须包含 `if (this.gameflowPaused) return` 或在 init() 中 `this.gameflowPaused = false`（allowlist: UIOverlay, SoundFX）

**Step 4.3** — Per-frame asset hash 优化 (M4)
- File: `src/engine/renderer/game-object-renderer.ts:42-75`
- 替换字符串拼接 hash 为引用相等检查:
```typescript
const currentAssets = engine.getConfig().assets;
if (this.lastAssetsRef !== currentAssets) {
  // clear cache and rebuild
  this.lastAssetsRef = currentAssets;
}
```

**Step 4.4** — AutoWirer Phase D 类型安全 (H3)
- File: `src/engine/core/auto-wirer.ts:16-126`
- 为 platform 模块添加 interface: `PlatformModule { getPlatforms(): Platform[] }`
- 替换 `as any` 为运行时特性检测: `typeof mod.getPlatforms === 'function'`

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `src/engine/core/engine.ts:80-102` | Modify | Per-module try-catch + RAF finally 保障 |
| `src/engine/core/engine.ts:28-33` | Modify | addModule 原子性 (init 失败回滚) |
| `src/engine/core/event-bus.ts:36-56` | Modify | Handler-level error isolation |
| `src/store/game-store.ts` | Modify | 添加 configVersion |
| `src/ui/preview/preview-canvas.tsx:15-23,74-90` | Modify | 使用 configVersion 触发 reload |
| `src/engine/renderer/game-object-renderer.ts` | Modify | 添加 destroy() + 优化 asset hash |
| `src/engine/renderer/pixi-renderer.ts:44-51,226,372-376,424` | Modify | HiDPI + connectToEngine 竞态 + 封装修复 + 子渲染器 destroy |
| `src/app/hooks/use-engine.ts:114-120,128-135,137-160` | Modify | touch-action + renderer 竞态 + 卸载安全 |
| `src/engine/core/auto-wirer.ts:16-126` | Modify | as any → typed interfaces |
| `src/engine/core/config-validator.ts:44-91` | Modify | 自动生成验证数据 |
| `src/ui/chat/studio-chat-panel.tsx` | Modify | Asset fulfillment 竞态保护 |
| `src/__tests__/` | Create | gameflowPaused 合规测试 + validator 同步测试 |

---

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Per-module try-catch 增加每帧开销 | V8 对 try-catch in hot path 已优化；实测后决定是否用 Error boundary 替代 |
| configVersion 导致过于频繁的引擎 reload | 可添加 debounce 或区分 structural vs param-only 变更路径 |
| HiDPI resolution 变化影响现有布局计算 | 引入 autoDensity 后所有坐标仍使用逻辑像素，不影响游戏逻辑 |
| addModule 原子性改变已有行为 | 充分测试所有 63 个模块的 init() 路径 |
| Bridge rules 类型化可能遗漏某些模块方法 | 使用 runtime feature detection 作为 fallback |

---

## Execution Order (建议)

```
Phase 1 (Critical, 并行执行 Step 1.1-1.4)
    ↓
Phase 2 (High, 串行 Step 2.1 → 2.2 → 2.3)
    ↓
Phase 3 (High→Medium, 并行 Step 3.1-3.4)
    ↓
Phase 4 (Medium, 并行 Step 4.1-4.4)
```

每个 Phase 完成后运行 `npx vitest run` 确认零回归。

---

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: 019d4a96-dde6-73d3-8aad-530c616cbe3f
- GEMINI_SESSION: (direct CLI, no session)
