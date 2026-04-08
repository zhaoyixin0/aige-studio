## 实施计划：P1-Medium 任务

### 双模型验证结果（Codex + Gemini 2026-04-07）

| 任务 | 状态 | 已有 | 缺失 |
|------|------|------|------|
| 1.4 ConfigLoader strict | 部分完成 | strict throw、validateConfig、applyFixes | Studio load 路径 auto-fix + preflight 微仿真 |
| 1.5 Agent 验证集成 | 部分完成 | buildGameConfig 调 validateConfig + applyFixes + editor-store | warning→chips 映射 |
| 5.1 FPS overlay | 未完成 | 无 | fpsRef + fps-overlay.tsx + store toggle + toolbar 按钮 |

---

## 任务 1.4: ConfigLoader strict — Studio auto-fix + preflight

### 任务类型
- [x] 后端（Engine 层）

### 实施步骤

#### Step 1: Studio load 路径 auto-fix
**文件：** `src/app/hooks/use-engine.ts` loadConfig 方法（line 167-187）

当前 loadConfig 直接调用 `loader.load(engine, config)` 再 `engine.start()`。需要在 load 前对 config 做 auto-fix：

```typescript
const loadConfig = useCallback((config: GameConfig) => {
  const engine = engineRef.current;
  const loader = loaderRef.current;
  if (!engine || !loader) return;

  // Auto-fix config before loading (immutable)
  const contracts = ContractRegistry.fromRegistry(createModuleRegistry());
  const report = validateConfig(config, contracts);
  const fixedConfig = report.fixes.length > 0 ? applyFixes(config, report.fixes) : config;

  engine.restart();
  loader.load(engine, fixedConfig);
  engine.start();

  // Publish validation report
  useEditorStore.getState().setValidationReport(report);

  // Wire sub-renderers
  const renderer = rendererRef.current;
  if (renderer) {
    renderer.connectToEngine(engine);
  }
}, []);
```

需要添加 imports: `validateConfig`, `applyFixes` from config-validator, `ContractRegistry` from contract-registry, `createModuleRegistry` from module-setup。

#### Step 2: Preflight 微仿真工具（可选，降优先级）
**文件：** `src/engine/core/preflight.ts`（新建）

创建独立 `runPreflight(engine)` 函数，在 engine.start() 后做 ~300ms 的 tick 模拟。捕获任何模块异常。

**考虑**：Codex 建议 Option C（独立工具），但 preflight 的 ROI 较低——当前 ConfigValidator 已覆盖大部分静态错误。建议先实现 Step 1 的 auto-fix，preflight 作为后续优化。

### 关键文件
| 文件 | 操作 | 说明 |
|------|------|------|
| src/app/hooks/use-engine.ts:167-187 | 修改 | loadConfig 添加 auto-fix |

---

## 任务 1.5: Agent 验证 — warning→chips 映射

### 任务类型
- [x] 后端（Agent 层）

### 实施步骤

#### Step 1: 创建 warning→chip 映射函数
**文件：** `src/agent/conversation-helpers.ts`（新增函数）

```typescript
export function mapWarningsToChips(
  warnings: readonly ValidationIssue[],
  maxChips = 3,
): Chip[] {
  const chips: Chip[] = [];
  for (const w of warnings) {
    if (chips.length >= maxChips) break;
    switch (w.category) {
      case 'missing-input':
        chips.push({ id: 'add:TouchInput', label: '添加输入模块', emoji: '👆' });
        break;
      case 'event-chain':
        chips.push({ id: 'board_mode', type: 'board_mode', label: '打开调试面板', emoji: '🔧' });
        break;
      case 'module-conflict':
        chips.push({ id: `remove:${w.moduleId}`, label: `移除重复 ${w.moduleId}`, emoji: '🗑️' });
        break;
      case 'invalid-param':
        chips.push({ id: 'board_mode', type: 'board_mode', label: '调整参数', emoji: '🎛️' });
        break;
    }
  }
  return chips;
}
```

#### Step 2: 在 ConversationAgent.process() 中注入 warning chips
**文件：** `src/agent/conversation-agent.ts`

在 create_game 和 modify_game 处理完成后（已有 `_lastValidationReport`），如果有 warnings 且当前无 chips，生成 warning chips：

```typescript
// After existing chip logic, before return
if (!chips && this._lastValidationReport?.warnings.length) {
  const warningChips = mapWarningsToChips(this._lastValidationReport.warnings);
  if (warningChips.length > 0) {
    chips = [...(chips ?? []), ...warningChips];
  }
}
```

### 关键文件
| 文件 | 操作 | 说明 |
|------|------|------|
| src/agent/conversation-helpers.ts | 修改 | 新增 mapWarningsToChips 函数 |
| src/agent/conversation-agent.ts:~335 | 修改 | process() 返回前注入 warning chips |

---

## 任务 5.1: FPS Counter Overlay

### 任务类型
- [x] 前端（UI 层）

### 实施步骤

#### Step 1: editor-store 添加 toggle
**文件：** `src/store/editor-store.ts`
- 添加 `showFpsOverlay: boolean`（默认 false）
- 添加 `setShowFpsOverlay: (v: boolean) => void`

#### Step 2: use-game-loop 暴露 fpsRef
**文件：** `src/app/hooks/use-game-loop.ts`
- 添加 `fpsRef = useRef(0)` 
- 在 RAF 回调中用滑动平均计算 FPS：`fpsRef.current = 0.9 * fpsRef.current + 0.1 * (1000 / dt)`
- 从 hook 返回 `fpsRef`

#### Step 3: 新建 FPS overlay 组件
**文件：** `src/ui/preview/fps-overlay.tsx`（新建）

```typescript
import { useRef, useEffect, useState } from 'react';

export function FpsOverlay({ fpsRef }: { fpsRef: React.RefObject<number> }) {
  const [fps, setFps] = useState(0);
  
  useEffect(() => {
    const id = setInterval(() => {
      setFps(Math.round(fpsRef.current ?? 0));
    }, 1000); // 1Hz sampling to React state
    return () => clearInterval(id);
  }, [fpsRef]);

  return (
    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs font-mono px-2 py-1 rounded pointer-events-none z-50">
      {fps} FPS
    </div>
  );
}
```

#### Step 4: PreviewToolbar 添加 FPS 按钮
**文件：** `src/ui/preview/preview-toolbar.tsx`
- 添加一个 "FPS" toggle 按钮，点击切换 `showFpsOverlay`

#### Step 5: PreviewCanvas 渲染 overlay
**文件：** `src/ui/preview/preview-canvas.tsx`
- 条件渲染 `{showFpsOverlay && <FpsOverlay fpsRef={fpsRef} />}`

### 关键文件
| 文件 | 操作 | 说明 |
|------|------|------|
| src/store/editor-store.ts | 修改 | 添加 showFpsOverlay + setter |
| src/app/hooks/use-game-loop.ts | 修改 | 添加 fpsRef 滑动平均 |
| src/ui/preview/fps-overlay.tsx | 新建 | FPS 显示组件 |
| src/ui/preview/preview-toolbar.tsx | 修改 | 添加 FPS toggle 按钮 |
| src/ui/preview/preview-canvas.tsx | 修改 | 条件渲染 FpsOverlay |

---

### 验证
- `npx vitest run`
- `npm run build`

### SESSION_ID（供 /ccg:execute 使用）
- CODEX_SESSION: 019d6b2e-d2b2-7f23-99d0-0712f37a29f8
- GEMINI_SESSION: N/A
