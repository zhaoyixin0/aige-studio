# Implementation Plan: Contract Full Migration

> 将全部 59 个模块迁移到 emits/consumes contract 系统 + 重构 ConfigValidator 为数据驱动

## Task Type
- [x] Backend (→ Codex)
- [ ] Frontend (→ Gemini)
- [ ] Fullstack

---

## Technical Solution

**核心策略**: 保留现有 `getContracts()` instance method 模式（不改 static），分 6 个阶段迁移。
使用 Strangler Fig 模式：validator 先支持双源（contracts + 硬编码），逐步切换到纯 contracts。

**架构决策**:
1. **声明方式**: 手动在每个模块的 `getContracts()` 中声明 emits/consumes
2. **动态事件**: Scorer 等模块在 `getContracts()` 中直接读取 `this.params` 返回实际消费的事件名
3. **验证层**: ContractRegistry 从 ModuleRegistry 收集所有模块原型的 contracts，ConfigValidator 从中派生验证数据
4. **同步保障**: CI 集成测试扫描 `this.emit()`/`this.on()` 调用与 contracts 声明的一致性
5. **BaseModule 排除**: `gameflow:resume`/`gameflow:pause` 由 BaseModule 统一处理，不计入模块的 consumes

---

## Implementation Steps

### Phase 0: Infrastructure（基础设施）

**Step 0.1** — ContractRegistry
- 新建 `src/engine/core/contract-registry.ts`
- 功能: 从 ModuleRegistry 遍历所有模块类，实例化临时对象获取 contracts
- API:
```typescript
export class ContractRegistry {
  private entries = new Map<string, ModuleContracts>();

  /** Populate from ModuleRegistry — call once at app boot */
  static fromRegistry(registry: ModuleRegistry): ContractRegistry;

  /** Get contracts for a module type */
  getContracts(moduleType: string): ModuleContracts;

  /** Get all known module types */
  getKnownTypes(): ReadonlySet<string>;

  /** Get all events emitted by a given module type */
  getEmits(moduleType: string): readonly string[];

  /** Get all events consumed by a given module type */
  getConsumes(moduleType: string): readonly string[];

  /** Get all event names that any module declares as emits (for hit event validation) */
  getAllEmittedEvents(): ReadonlySet<string>;
}
```

**Step 0.2** — ConfigValidator 双路径
- 修改 `validateConfig()` 接受可选 `ContractRegistry` 参数
- 当 registry 存在时:
  - `KNOWN_MODULE_TYPES` → `registry.getKnownTypes()`
  - `MODULE_DEPENDENCIES` → 从 ModuleRegistry 获取 `getDependencies()`
  - `SCORER_VALID_HIT_EVENTS` → `registry.getAllEmittedEvents()` 过滤 scorable 事件
- 当 registry 不存在时: 回退到硬编码（保持兼容）
- 确保 1657 测试不变

**Step 0.3** — CI 合规测试框架
- 新建 `src/__tests__/integration/contract-compliance.test.ts`
- 扫描所有模块文件中的 `this.emit('xxx')` 和 `this.on('xxx')` 调用
- 与 `getContracts().emits`/`consumes` 比对
- 排除 BaseModule 默认事件: `gameflow:resume`, `gameflow:pause`
- Phase 0 只校验已有 8 个 contract 模块，后续阶段递增

### Phase 1: Input 模块（纯 emitters）— 6 modules

**迁移模块**: TouchInput, FaceInput, HandInput, BodyInput, DeviceInput, AudioInput

**模式**: 只声明 `emits`，无 `consumes`（输入模块不消费其他事件）

**示例 — TouchInput**:
```typescript
getContracts(): ModuleContracts {
  return {
    emits: [
      'input:touch:tap', 'input:touch:hold', 'input:touch:release',
      'input:touch:swipe', 'input:touch:doubleTap', 'input:touch:longPress',
      'input:touch:position',
    ],
  };
}
```

**每个模块步骤**:
1. 读取模块源码，grep `this.emit(` 调用
2. 在 `getContracts()` 中声明 `emits` 数组
3. 运行 contract-compliance 测试确认

### Phase 2: Feedback 模块（纯 consumers）— 7 modules

**迁移模块**: GameFlow, ParticleVFX, SoundFX, UIOverlay, ResultScreen, CameraFollow, Shield

**模式**: 主要声明 `consumes`，GameFlow 同时声明 `emits`

**示例 — GameFlow**:
```typescript
getContracts(): ModuleContracts {
  return {
    emits: ['gameflow:state', 'gameflow:pause', 'gameflow:resume'],
    consumes: ['timer:end', 'lives:zero'],
    capabilities: ['game-flow-controller'],
  };
}
```

### Phase 3: Core Mechanics — 8 modules

**迁移模块**: Timer, Lives, DifficultyRamp, Randomizer, QuizEngine, ComboSystem, Gravity, Jump

**注意**: 
- Timer 和 Lives 是高频交互模块，需要完整的 emits + consumes
- Gravity 有复杂的 surface 系统交互
- Jump 与 Gravity 有依赖关系

**示例 — Timer**:
```typescript
getContracts(): ModuleContracts {
  return {
    emits: ['timer:tick', 'timer:end'],
    consumes: [],  // Timer is autonomous, only responds to gameflow
  };
}
```

**示例 — Lives**:
```typescript
getContracts(): ModuleContracts {
  return {
    emits: ['lives:change', 'lives:zero'],
    consumes: ['collision:damage', 'health:zero'],
  };
}
```

### Phase 4: Extended Mechanics P1-P3 — 9 modules

**迁移模块**: ExpressionDetector, PowerUp, BeatMap, GestureMatch, MatchEngine, Runner, PlaneDetection, BranchStateMachine, DressUpEngine

**重点**: 这些模块的 emits 对 Scorer hit event 验证至关重要:
- BeatMap → `beat:hit`
- QuizEngine → `quiz:correct`
- ExpressionDetector → `expression:detected`
- GestureMatch → `gesture:match`
- MatchEngine → `match:found`

### Phase 5: Platformer + Shooter + RPG — 19 modules

**Platformer (10)**: CoyoteTime, Dash, WallDetect, Knockback, IFrames, Hazard, Checkpoint, Inventory, StaticPlatform, MovingPlatform, OneWayPlatform, CrumblingPlatform

**Shooter (3)**: BulletPattern, Aim, WaveSpawner

**RPG (6)**: EquipmentSlot, EnemyDrop, LevelUp, StatusEffect, SkillTree, DialogueSystem

**注意**: 
- Platform 模块大多是纯状态模块（少量或无事件）
- WaveSpawner 需要 emits: ['wave:spawn', 'wave:complete']
- RPG 模块有复杂的 emits/consumes 链

### Phase 6: 完成迁移 — Finalize

**Step 6.1** — 补全 Collectible 和 EnemyAI 的 emits/consumes

**Step 6.2** — 删除硬编码 maps
- 删除 `KNOWN_MODULE_TYPES` Set
- 删除 `MODULE_DEPENDENCIES` Record
- 删除 `SCORER_VALID_HIT_EVENTS` Set
- ConfigValidator 完全依赖 ContractRegistry

**Step 6.3** — Event chain graph validation
- 用 contracts 做完整的事件流图分析:
  - 给定配置中的 N 个模块，聚合所有 `emits` 为 `providedEvents`
  - 检查每个模块的 `consumes` 是否都在 `providedEvents` 中
  - 未满足的依赖报 warning（不是 error，因为某些事件可能由 AutoWirer 动态产生）

**Step 6.4** — CI 合规测试改为 hard-fail 模式

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `src/engine/core/contract-registry.ts` | Create | ContractRegistry 集中收集 contracts |
| `src/engine/core/config-validator.ts` | Modify | 双路径 → 纯 contracts 验证 |
| `src/engine/module-setup.ts` | Modify | Boot 时构建 ContractRegistry |
| `src/engine/modules/input/*.ts` (6) | Modify | 添加 emits |
| `src/engine/modules/feedback/*.ts` (7) | Modify | 添加 emits/consumes |
| `src/engine/modules/mechanic/*.ts` (~38) | Modify | 添加 emits/consumes |
| `src/__tests__/integration/contract-compliance.test.ts` | Create | CI 合规测试 |
| `src/__tests__/integration/contract-emits-consumes.test.ts` | Modify | 扩展已有 contract 测试 |

---

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| 遗漏 emit/on 调用导致 contracts 不完整 | CI 合规测试 grep `this.emit()`/`this.on()` 与声明比对 |
| 动态事件名（Scorer hitEvent）无法静态声明 | getContracts() 中读取 this.params 动态返回 |
| ContractRegistry 从原型获取 contracts 可能不准确 | 使用默认 params 实例化临时模块，足够获取静态 emits/consumes |
| 删除硬编码后破坏现有测试 | 双路径阶段性验证，确认输出一致后才删除 |
| Phase 5 大量模块改动风险高 | 每个模块独立 commit，每 5 个模块运行全量测试 |
| 平台模块可能无事件但有 Bridge Rules 交互 | Bridge Rules 已在 AutoWirer 中，与 contracts 独立 |

---

## Migration Pattern Template

每个模块的迁移步骤:
```
1. 读取模块源码
2. grep 所有 this.emit('xxx') 调用 → emits 数组
3. grep 所有 this.on('xxx') 调用 → consumes 数组
4. 排除 gameflow:resume / gameflow:pause（BaseModule 默认）
5. 在 getContracts() 中添加 emits/consumes
6. 运行 npx vitest run <module-test-file> 确认无回归
7. 运行 contract-compliance 测试确认一致
```

---

## Execution Order

```
Phase 0 (Infrastructure)        — ContractRegistry + dual-path validator + CI test
    ↓ verify 1657 tests pass
Phase 1 (Input, 6 modules)      — pure emitters, lowest risk
    ↓ verify tests
Phase 2 (Feedback, 7 modules)   — pure consumers + GameFlow
    ↓ verify tests
Phase 3 (Core, 8 modules)       — Timer/Lives/Gravity/Jump
    ↓ verify tests
Phase 4 (Extended, 9 modules)   — P1/P2/P3 scorer-critical modules
    ↓ verify tests
Phase 5 (Platform+Shooter+RPG, 19 modules) — largest batch
    ↓ verify tests
Phase 6 (Finalize)              — delete hardcoded maps + graph validation
    ↓ verify tests + build
```

---

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: 019d4aae-8afc-7953-80bf-7370c3c6deb5
- GEMINI_SESSION: (direct CLI, no session)
