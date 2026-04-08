## 实施计划：P3-Low 任务

### 双模型验证结果（Codex + Gemini 2026-04-07）

| 任务 | 状态 | 说明 |
|------|------|------|
| 1.6 gameflowPaused 合规审计 | 部分完成 | 缺 CI 测试 + 2 个真实违规需修复 |
| 1.7 Per-frame asset hash 优化 | **已完成** | game-object-renderer.ts:94 已用引用相等 |

---

## 任务 1.6: gameflowPaused 合规审计

### 任务类型
- [x] 后端（Engine 层 + CI 测试）

### 现状
扫描了 62 个模块的 update() 方法，发现：
- **大部分模块合规**（Timer、Physics2D、Tween、ScrollingLayers 等）
- **14 个模块属于显式 no-op 或事件驱动**（应加入 allowlist）
- **2 个真实违规需要修复**：
  1. `UIOverlay.update` (line 74-82) — 仍在执行 combo fade 计时器
  2. `TouchInput.update` (line 245-257) — 仍在发送 input:touch:* 事件

### 实施步骤

#### Step 1: 修复 2 个真实违规

**文件 1：** `src/engine/modules/feedback/ui-overlay.ts:74`
在 `update(dt: number)` 方法开头添加：
```typescript
update(dt: number): void {
  if (this.gameflowPaused) return;
  // ... existing combo fade logic
}
```

**文件 2：** `src/engine/modules/input/touch-input.ts:245`
在 `update(_dt: number)` 方法开头添加：
```typescript
update(_dt: number): void {
  if (this.gameflowPaused) return;
  // ... existing hold/position emit logic
}
```

#### Step 2: 创建 CI 静态扫描测试

**文件：** `src/engine/modules/__tests__/gameflow-paused-compliance.test.ts`（新建）

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const MODULES_DIR = join(process.cwd(), 'src/engine/modules');

// Modules intentionally exempt — explicit no-ops or event-driven modules
// where update() is a stub or doesn't drive any per-frame state.
const ALLOWLIST = new Set([
  'feedback/game-flow.ts',        // Drives its own state machine; managed manually
  'feedback/result-screen.ts',    // UI-only, event-driven
  'feedback/sound-fx.ts',         // Explicit no-op
  'mechanic/branch-state-machine.ts', // Event-driven
  'mechanic/checkpoint.ts',       // Event-driven
  'mechanic/dialogue-system.ts',  // Event-driven
  'mechanic/dress-up-engine.ts',  // Event-driven UI
  'mechanic/enemy-drop.ts',       // Event-driven
  'mechanic/equipment-slot.ts',   // Event-driven
  'mechanic/health.ts',           // Event-driven
  'mechanic/inventory.ts',        // Event-driven
  'mechanic/lives.ts',            // Event-driven
  'mechanic/match-engine.ts',     // Event-driven
  'mechanic/static-platform.ts',  // Event-driven
]);

function findTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'base-module.ts') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...findTsFiles(full));
    } else if (entry.endsWith('.ts')) {
      results.push(full);
    }
  }
  return results;
}

function hasGameflowPausedCheck(content: string): boolean {
  // Find update() method definition
  const updateMatch = content.match(/\bupdate\s*\(\s*[_a-z]*\s*:\s*number\s*\)\s*:\s*void\s*\{([\s\S]*?)\}/);
  if (!updateMatch) return false;
  
  // Check if first ~25 lines after `{` contain gameflowPaused
  const body = updateMatch[1].split('\n').slice(0, 25).join('\n');
  return /this\.gameflowPaused/.test(body);
}

describe('gameflowPaused compliance audit', () => {
  it('all modules with update() respect gameflowPaused (or are allowlisted)', () => {
    const files = findTsFiles(MODULES_DIR);
    const violations: string[] = [];

    for (const file of files) {
      const rel = relative(MODULES_DIR, file).replace(/\\/g, '/');
      if (ALLOWLIST.has(rel)) continue;

      const content = readFileSync(file, 'utf-8');
      // Skip files that don't define update()
      if (!/\bupdate\s*\(\s*[_a-z]*\s*:\s*number\s*\)/.test(content)) continue;

      if (!hasGameflowPausedCheck(content)) {
        violations.push(rel);
      }
    }

    expect(violations, `Modules missing gameflowPaused check:\n${violations.join('\n')}`).toEqual([]);
  });
});
```

### 关键文件
| 文件 | 操作 |
|------|------|
| src/engine/modules/feedback/ui-overlay.ts:74 | 添加 gameflowPaused 守卫 |
| src/engine/modules/input/touch-input.ts:245 | 添加 gameflowPaused 守卫 |
| src/engine/modules/__tests__/gameflow-paused-compliance.test.ts | 新建 CI 静态扫描测试 |

### 风险
- TouchInput 修复后，菜单/UI 在暂停时无法接收 touch 事件 → 需要确认产品需求。**当前默认全暂停，符合 BaseModule 设计意图**
- 静态正则扫描可能有误判 → ALLOWLIST 兜底

---

## 任务 1.7: Per-frame asset hash — 已完成

无需操作。`src/engine/renderer/game-object-renderer.ts:94` 已使用 `assets !== this.lastAssetsRef` 引用相等检查，其他 renderer 也未使用 string hash。

---

### 验证
- `npx vitest run src/engine/modules/__tests__/gameflow-paused-compliance.test.ts`
- `npm run build`

### SESSION_ID
- CODEX_SESSION: 019d6b9d-8f76-7e71-bd38-866a4643b772
- GEMINI_SESSION: N/A
