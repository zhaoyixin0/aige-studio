# Implementation Plan: Game Quality Validation System (COMPLETED)

## Background

AIGE Studio 生成的游戏频繁出现质量问题（操控失灵、物体不下落、接物不计分），根因是 AI 配置生成 → 引擎加载之间缺少验证层。现有 Contract System + AutoWirer 是"协议链接"的雏形，但只覆盖数据面（position/damage），不覆盖行为面（事件链）。

### Root Cause Analysis (Priority Order)

| # | Root Cause | Impact | Example Bug |
|---|-----------|--------|-------------|
| 1 | No event chain validation | HIGH | Scorer listens `collision:hit` but quiz games never emit it → score stays 0 |
| 2 | No parameter validation | HIGH | Negative speed, empty collision rules → objects freeze or collisions never fire |
| 3 | Input event mismatch | HIGH | PlayerMovement.continuousEvent not set → face/touch controls dead |
| 4 | Dependencies warn-only | MEDIUM | Missing Collision module → AutoWirer skips all collision wiring, game runs broken |
| 5 | No conflict detection | MEDIUM | Scorer.combo + ComboSystem both active → double scoring |
| 6 | Collision radius not game-type-aware | LOW | Dodge too harsh (radius too large), catch too lenient |

## Task Type
- [x] Frontend (→ Gemini)
- [x] Backend (→ Codex)
- [x] Fullstack (→ Parallel)

## Technical Solution

**Three-layer validation architecture** (Codex A+B + Gemini Hybrid):

```
AI Generation (ConversationAgent)
    ↓ buildGameConfig()
[Layer 1] ConfigValidator — Static Analysis
    ├── Schema validation (type/min/max/enum from getSchema())
    ├── Event chain graph (emitter→listener completeness)
    ├── Conflict detection (dual scoring, missing bridges)
    └── Auto-fix with annotations (clamp, inject defaults)
    ↓ validated config
[Layer 2] ConfigLoader — Strict Mode
    ├── Fail-fast on structural errors (unknown modules, unmet requires)
    ├── Micro-sim preflight (300ms ticks + synthetic input + diagnostics)
    └── Degradation policy (disable broken modules with UI note)
    ↓ loaded engine
[Layer 3] Runtime Feedback — Hybrid UI
    ├── DiagnosticBadge in PreviewToolbar (green/yellow/red)
    ├── DiagnosticPopover with human-readable issues + quick fixes
    └── Chat integration via enhancementSuggestions chips
```

## Implementation Steps

### Step 1: ConfigValidator Service (Core — Backend)
- **File**: `src/engine/core/config-validator.ts` (NEW)
- **Deliverable**: Pure function `validateConfig(config: GameConfig): ValidationReport`

Sub-tasks:
1. **Schema Pass**: Iterate `config.modules`, call `ModuleRegistry.getSchema(type)`, validate each param against type/min/max/enum. Clamp out-of-range values with warnings.
2. **Event Chain Pass**: Build directed graph from modules' expected events:
   - Collision rules → expected `collision:hit`/`collision:damage` events
   - Scorer.hitEvent → must match an event that will actually fire
   - Input module → must emit events that PlayerMovement/Aim consume
   - Use canonical event catalog from `src/engine/core/events.ts`
3. **Conflict Pass**: Detect Scorer.combo.enabled + ComboSystem both present; detect dual playerPosition providers; detect missing bridges (Health without Lives).
4. **Auto-fix**: For each fixable issue, produce `{ key, from, to, reason }` annotation. Apply only low-risk fixes (clamp numerics, inject continuousEvent).

```typescript
interface ValidationReport {
  errors: ValidationIssue[];   // Must fix before load
  warnings: ValidationIssue[]; // Auto-fixed or degraded
  fixes: AutoFix[];            // Applied auto-fixes
  isPlayable: boolean;         // false if any error
}
```

### Step 2: InputProfile + CollisionProfile (Core — Backend)
- **File**: `src/engine/core/profiles.ts` (NEW)
- **Deliverable**: Resolver functions that set correct defaults per game type + input method

```typescript
// InputProfile: given input module + game type → PlayerMovement defaults
function resolveInputProfile(inputType: string, gameType: string): Partial<PlayerMovementParams> {
  // e.g., FaceInput + shooting → { mode: 'follow', continuousEvent: 'input:face:move' }
  // e.g., TouchInput + catch → { mode: 'follow', continuousEvent: 'input:touch:position' }
}

// CollisionProfile: given game type + layer → collision radius
function resolveCollisionRadius(gameType: string, layer: string): number {
  // catch: 0.7 * spriteSize (generous)
  // dodge: 0.4 * spriteSize (tight)
  // shooting: 0.5 * spriteSize (standard)
}
```

### Step 3: ConfigLoader Strict Mode (Core — Backend)
- **File**: `src/engine/core/config-loader.ts` (MODIFY)
- **Deliverable**: Upgraded loader with fail-fast + micro-sim preflight

Changes:
1. Run `ConfigValidator.validate(config)` before module instantiation
2. **Hard errors** → throw, don't load (unknown module, unmet requires, empty Collision rules with Collision present)
3. **Auto-fixes** → apply and attach to `config.meta.validationApplied`
4. **Micro-sim preflight** (after AutoWirer.wire()):
   - Attach EventRecorder
   - Emit synthetic inputs for selected input module (e.g., `input:touch:tap` at center)
   - Tick engine 300ms (18 frames at 60fps)
   - Run ModuleDiagnostics
   - If broken-chain errors → fail with actionable report
5. Add `strict` flag (default true in Studio, false in export)

### Step 4: ConversationAgent Integration (Agent — Backend)
- **File**: `src/agent/conversation-agent.ts` (MODIFY)
- **Deliverable**: Validation at generation time with repair suggestions

Changes to `buildGameConfig()`:
1. After assembling modules, run `ConfigValidator.validate(config)`
2. Apply auto-fixes silently (clamp, inject continuousEvent)
3. For remaining warnings, inject into response as `enhancementSuggestions` chips
4. For errors, attempt self-repair: adjust params based on InputProfile/CollisionProfile
5. Use `getModuleParams()` more aggressively for input-dependent modules

### Step 5: Contract Extension — emits/consumes (Core — Backend)
- **File**: `src/engine/core/contracts.ts` (MODIFY)
- **Deliverable**: Extended contract interface with behavioral metadata

```typescript
interface ModuleContracts {
  // Existing
  collisionProvider?: { ... };
  damageReceiver?: { ... };
  damageSource?: { ... };
  playerPosition?: { ... };
  // NEW: behavioral edges
  emits?: string[];      // Events this module emits
  consumes?: string[];   // Events this module listens to
  capabilities?: string[]; // e.g., ['scoring-core', 'combo-signaling']
}
```

Migrate incrementally (most fragile first):
- PlayerMovement: `emits: ['player:move'], consumes: ['input:touch:hold', ...]`
- Spawner: `emits: ['spawner:created', 'spawner:destroyed'], consumes: ['gameflow:resume']`
- Scorer: `consumes: ['collision:hit'], capabilities: ['scoring-core']`
- Projectile: `emits: ['projectile:fire', 'projectile:destroyed'], consumes: ['player:move', 'aim:update']`

### Step 6: Diagnostic UI Components (Frontend — Gemini authority)
- **Files**:
  - `src/ui/preview/diagnostic-badge.tsx` (NEW)
  - `src/ui/preview/diagnostic-popover.tsx` (NEW)
  - `src/hooks/use-game-diagnostics.ts` (NEW)
  - `src/store/editor-store.ts` (MODIFY — add diagnosticReport field)

Components:
1. **`useGameDiagnostics` hook**: Subscribe to engine EventRecorder, periodically run diagnostic rules, store latest report in editor-store
2. **`DiagnosticBadge`**: In PreviewToolbar, shows colored dot (green ✅ / yellow ⚠ / red ❌) based on issue severity
3. **`DiagnosticPopover`**: Click badge → popover with human-readable issues + "Quick Fix" buttons
4. **Translation layer**: Map `DiagnosticIssue` categories to user-friendly messages:
   - `broken-chain` → "碰撞检测到了物体，但没有计分模块接收事件"
   - `orphan-event` → "有些事件没有被任何模块监听"
   - `dependency-missing` → "缺少必要的模块：XXX"

### Step 7: Chat Validation Feedback (Frontend — Gemini authority)
- **File**: `src/ui/chat/studio-chat-panel.tsx` (MODIFY)
- **Deliverable**: Validation results surfaced as chat messages with suggestion chips

Changes:
1. After config generated, if ValidationReport has warnings → add assistant message with human-readable summary
2. Use existing `enhancementSuggestions` chip format for quick fixes
3. Critical issues → proactive message: "检测到游戏配置可能存在问题：[问题列表]。要我自动修复吗？"
4. Non-critical → yellow badge only, no chat interruption

### Step 8: Tests (QA)
- **Files**:
  - `src/__tests__/unit/config-validator.test.ts` (NEW)
  - `src/__tests__/unit/profiles.test.ts` (NEW)
  - `src/__tests__/integration/preflight-validation.test.ts` (NEW)

Test cases:
1. Schema validation: negative speed → clamp + warning; empty rules → error
2. Event chain: Scorer with wrong hitEvent → error; quiz without collision:hit → suggest quiz:correct
3. Conflict: Scorer.combo + ComboSystem → warning
4. InputProfile: FaceInput + shooting → correct continuousEvent
5. CollisionProfile: catch → 0.7, dodge → 0.4
6. Micro-sim preflight: deliberately broken config → broken-chain detected
7. All 15 presets pass validation with no errors

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| src/engine/core/config-validator.ts | NEW | Core validation service (schema + event chain + conflict) |
| src/engine/core/profiles.ts | NEW | InputProfile + CollisionProfile resolvers |
| src/engine/core/config-loader.ts | MODIFY | Add strict mode, fail-fast, micro-sim preflight |
| src/engine/core/contracts.ts | MODIFY | Add emits/consumes/capabilities to ModuleContracts |
| src/agent/conversation-agent.ts | MODIFY | Run validation at generation time, inject suggestions |
| src/ui/preview/diagnostic-badge.tsx | NEW | Status badge in PreviewToolbar |
| src/ui/preview/diagnostic-popover.tsx | NEW | Clickable diagnostic details popover |
| src/hooks/use-game-diagnostics.ts | NEW | Zustand hook for runtime diagnostics |
| src/store/editor-store.ts | MODIFY | Add diagnosticReport state |
| src/ui/chat/studio-chat-panel.tsx | MODIFY | Surface validation as chat messages |
| src/__tests__/unit/config-validator.test.ts | NEW | Validator unit tests |
| src/__tests__/unit/profiles.test.ts | NEW | Profile resolver tests |
| src/__tests__/integration/preflight-validation.test.ts | NEW | Preflight integration tests |
| src/engine/modules/mechanic/player-movement.ts | MODIFY | Add emits/consumes to getContracts() |
| src/engine/modules/mechanic/spawner.ts | MODIFY | Add emits/consumes to getContracts() |
| src/engine/modules/mechanic/scorer.ts | MODIFY | Add consumes/capabilities to getContracts() |
| src/engine/modules/mechanic/projectile.ts | MODIFY | Add emits/consumes to getContracts() |

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Auto-fix reduces creative freedom | Make fixes opt-in with preview; only enforce structural must-haves |
| Validator drift from module behavior | Source-of-truth is getSchema() + CI lint checking declared emits vs code |
| Micro-sim misses chains needing complex input | Expand synthetic input patterns per input type; allow module preflight hooks |
| Over-engineering: validation layer too complex | Start with schema + event chain (Step 1-2), add micro-sim later if needed |
| 60+ modules need contract migration | Migrate incrementally — most fragile 6-8 modules first |

## Phasing

### Phase A: Quick Wins (1-2 sprints)
- Step 1 (ConfigValidator — schema + event chain + conflict)
- Step 2 (InputProfile + CollisionProfile)
- Step 4 (ConversationAgent integration)
- Step 8 partial (validator + profile tests)

### Phase B: Engine Hardening (1 sprint)
- Step 3 (ConfigLoader strict mode + micro-sim)
- Step 5 (Contract emits/consumes — top 6 modules)

### Phase C: UI Feedback (1 sprint)
- Step 6 (DiagnosticBadge + DiagnosticPopover)
- Step 7 (Chat validation feedback)
- Step 8 remaining (integration tests)

## Answer to User's Questions

### "协议链接模块" 是什么？已经有了吗？
是的，当前的 Contract System (`getContracts()`) + AutoWirer 就是"协议链接"。但它只覆盖**数据协议**（position、damage、collision），不覆盖**行为协议**（事件链完整性）。本计划 Step 5 将扩展 contracts 添加 `emits`/`consumes` 声明，实现完整的行为协议链接。

### 核心原因是什么？
**AI 生成配置 → 引擎加载之间没有验证层**。AI 可以生成结构正确但语义错误的配置（正确的 JSON，错误的游戏）。引擎默认"宽容"——unknown 模块跳过、缺失依赖只 warn、错误事件名静默失败。

### Google AI Studio 般的交互 + 高品质社交游戏？
本计划的 Hybrid UI 方案（DiagnosticBadge + Chat 拦截 + enhancementSuggestions）模仿 Google AI Studio 的质量反馈模式：
- 严重问题 → 主动 chat 消息（"检测到配置问题，要我修复吗？"）
- 轻微问题 → 预览工具栏 badge，不打断创作流
- 一键修复 → suggestion chips

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: 019d4773-b77f-78e2-a0a2-e63104785c00
- GEMINI_SESSION: (direct CLI call, no session reuse)
