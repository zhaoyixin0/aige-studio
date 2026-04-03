# Game Parameter UI Redesign — Execution Plan

> Generated: 2026-04-02
> Source: Codex (gpt-5) backend analysis + Gemini (gemini-3.1-pro + Policy) frontend analysis
> Codex SESSION: 019d5132-0358-7a52-a894-1b96082f07b9
> Gemini SESSION: 9050df19-2ab9-4ae3-ba13-7b527a1cf9e1

---

## Unified Task List

### Wave 1 — Foundation (no dependencies, all parallel)

| ID | Description | Files | Complexity | Test Strategy |
|----|------------|-------|-----------|---------------|
| **B1** | Parameter Registry — 229 个参数元数据 + query API | `src/data/parameter-registry.ts` (new) | M | query API 单元测试, ID 唯一性, P0 快照 |
| **B6** | `batchUpdateParams()` — game-store 批量更新 API | `src/store/game-store.ts` (modify) | S | version 只递增一次, immutable merge |
| **F3** | EditorStore 扩展 — l1State, boardModeOpen, ChatMessage 类型 | `src/store/editor-store.ts` (modify) | S | store 快照测试, 类型验证 |
| **F4** | 新控件 — Segmented/Stepper/AssetPickerGrid + SchemaRenderer 集成 | `src/ui/controls/*.tsx` (new), `schema-renderer.tsx` (modify) | M | RTL 组件测试, ARIA, keyboard nav |
| **B9** | 模块 schema 扩展验证 — 24 个模块新增参数 | `src/engine/modules/**/*.ts` (modify) | M | configure() 反射测试, 回归测试 |
| **B10** | SpinWheel 就绪 — Randomizer 验证 + 补齐 | `src/engine/modules/mechanic/randomizer.ts` | S | 加权分布测试, 事件发射 |

### Wave 2 — Data Processing + Engine Bridge (depends on Wave 1)

| ID | Description | Depends On | Files | Complexity | Test Strategy |
|----|------------|-----------|-------|-----------|---------------|
| **B2** | Excel → TS 生成器 | B1 | `tools/registry/import-excel.ts` (new), `package.json` | M | fixture 测试, 幂等输出 |
| **B3** | CompositeMapper — L1→L2/L3 映射 | B1 | `src/engine/core/composite-mapper.ts` (new) | M | 表驱动: Difficulty 1-5 映射, 边界测试 |
| **B4** | DependencyResolver — DAG 可见性/可用性 | B1 | `src/engine/core/dependency-resolver.ts` (new) | M | 链/fork 传播, 环检测 (Kahn) |
| **B5** | EngineController bridge — Store→Engine 刷新 | B6 | `src/app/hooks/use-engine-bridge.ts` (new), `use-engine.ts` (modify) | L | slider spam 合并, 单帧单 applyChanges |
| **B8** | Agent `push_parameter_card` tool | B1 | `conversation-defs.ts`, `conversation-agent.ts` (modify) | M | tool schema 验证, typed payload |
| **F5** | StudioChatPanel 拆分 — MessageList + useConversationManager | F3 | `studio-chat-panel.tsx`, `message-list.tsx` (new), `use-conversation-manager.ts` (new) | M | 自动滚动, 大量消息渲染性能 |
| **F8** | Suggestion Chips 升级 — board_mode/param/action 类型 | F3 | `suggestion-chips.tsx` (modify) | S | 点击 → store action 测试 |

### Wave 3 — Chat UI Integration (depends on Wave 2)

| ID | Description | Depends On | Files | Complexity | Test Strategy |
|----|------------|-----------|-------|-----------|---------------|
| **F6** | L1ExperienceCard — Chat 内嵌 Difficulty/Pacing/Emotion | F3, F4, F5, B3 | `src/ui/chat/l1-experience-card.tsx` (new) | S | L1 调节 → batchUpdateParams 联动 |
| **F7** | GUI ParamCard 升级 — L2 分组 + tombstone 折叠 | F3, F4, F5, B1 | `src/ui/chat/gui-param-card.tsx` (new) | L | 分类组渲染, 旧卡片只读摘要 |
| **F11** | Game Type Selector Card — 意图模糊路径 | F3, F5 | `src/ui/chat/game-type-selector.tsx` (new) | S | 选择 → 生成正确游戏模板 |
| **B7** | E2E 管线联调 — L1→Mapper→batch→Bridge→applyChanges | B3, B5, B6 | (integration test only) | M | engine modules 收到 configure delta |

### Wave 4 — Board Mode + Layout (depends on Wave 3)

| ID | Description | Depends On | Files | Complexity | Test Strategy |
|----|------------|-----------|-------|-----------|---------------|
| **F9** | Board Mode Panel + ParamCategoryGroup | F4, B1, B4 | `board-mode-panel.tsx`, `param-category-group.tsx` (new) | L | 游戏类型过滤, DAG 显隐, exposure 过滤 |
| **F10** | Layout 重构 — slide-over Board Mode, EditorPanel 隐藏 | F9 | `main-layout.tsx` (modify) | M | 视觉回归, 状态切换 |
| **F12** | Visual Style Selector + L3 Advanced Tags | F9 | `visual-style-selector.tsx` (new), `board-mode-panel.tsx` (modify) | S | 选择 → batch 更新 + UI 刷新 |

### Wave 5 — Integration Tests + CI Guards

| ID | Description | Depends On | Files | Complexity | Test Strategy |
|----|------------|-----------|-------|-----------|---------------|
| **B11** | 集成测试 — applyChanges 路径 + L1 映射端到端 | B7, B9, B10 | `param-apply-path.test.ts`, `l1-mapping-to-engine.test.ts` (new) | M | E2E-lite 验证 |
| **B12** | CI 防护 — DAG 环检测 + Registry 一致性 | B2, B4 | `.github/workflows/registry-check.yml` (new) | S | ID 重复/缺失默认值/环/不确定输出 |

---

## Critical Path

```
B1 (Registry) → B3 (Mapper) → B7 (E2E 联调)
                                    ↑
B6 (batchUpdate) → B5 (Bridge) ────┘
                                    ↓
                              F6/F7 (Chat Cards) → F9 (Board Mode) → F10 (Layout)
```

**最长路径**: B1 → B3 + B6 → B5 → B7 → F7 → F9 → F10

---

## Parallel Execution Matrix

```
Time →  ┌──────────┬──────────────┬────────────┬──────────────┬──────────┐
        │  Wave 1  │   Wave 2     │   Wave 3   │   Wave 4     │  Wave 5  │
        ├──────────┼──────────────┼────────────┼──────────────┼──────────┤
Agent 1 │ B1       │ B3           │ F6         │ F9           │ B11      │
Agent 2 │ B6       │ B5           │ F7         │ F10          │ B12      │
Agent 3 │ F3       │ B4           │ F11        │ F12          │          │
Agent 4 │ F4       │ B8           │ B7         │              │          │
Agent 5 │ B9       │ F5           │            │              │          │
Agent 6 │ B10      │ B2, F8       │            │              │          │
        └──────────┴──────────────┴────────────┴──────────────┴──────────┘
```

---

## Summary

- **24 个任务** (12 backend + 12 frontend, 2 merged)
- **5 波次** 渐进执行, 每波内最大 6 个并行任务
- **Critical path** 约 7-8 个串行任务
- **Phase 1 (Wave 1+2)** = 数据基础 + Engine 桥 + 模块扩展
- **Phase 2 (Wave 2+3)** = Chat 交互 + Agent 工具
- **Phase 3-5 (Wave 3+4)** = Board Mode + Layout + 增强
- **Wave 5** = 集成测试 + CI 防护

## Risks (双模型共识)

1. **Registry-Schema 漂移** — 用 CI 快照测试防护
2. **Slider 性能** — RAF debounce + react-virtuoso + React.memo
3. **CompositeMapper 过驱** — clamp + ContractRegistry 验证
4. **Excel 解析歧义** — 先用 P0 手写种子, 后续自动生成
5. **旧卡片状态冲突** — 全局绑定 + tombstone 折叠
6. **Agent paramId 幻觉** — system prompt 注入 Registry ID
7. **Bundle 体积** — 229 参数按优先级分片懒加载
8. **DependencyResolver 环** — Kahn 算法 + CI 环检测

## Recommended Execution Approach

1. **TDD**: 每个任务先写测试 (RED), 再实现 (GREEN), 后重构 (IMPROVE)
2. **Parallel agents**: Wave 1 的 6 个任务可同时用 subagent 并行实施
3. **Gate**: 每波完成后 `npm run build && npx vitest run` 验证
4. **Commit**: 每个任务独立 commit (conventional format)
5. **Review**: Wave 2 完成后双模型交叉审查一次
