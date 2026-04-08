## 实施计划：P0 Asset Fulfillment 竞态保护

### 任务类型
- [x] 全栈（Store + Hooks + UI）

### 背景
MASTER-PLAN P0 任务验证（Codex + Gemini 双模型分析 2026-04-07）：
- 1.1 touch-action:none — **已完成**（use-engine.ts:119）
- 1.3 Asset 竞态保护 — **未完成**（本计划）
- 2.1 Renderer 不可变性 — **已完成**（pixi-renderer.ts 无写回）
- 2.2 动态 consumes — **已完成**（Shield/CameraFollow/Gravity 均已实现）
- 2.3 EventBus 日志门控 — **已完成**（debug 守卫已就位）

### 技术方案
利用 game-store.ts 已有的 `configVersion`（单调递增计数器），在每个 asset fulfillment 调用点：
1. 异步操作开始前捕获 `configVersion`
2. Promise 回调中比较当前 `configVersion` 与捕获值
3. 不匹配则静默丢弃过时结果

同时修复 chat-panel.tsx 中的 engine config 直接 mutation，改为不可变 `engine.loadConfig({ ...prev, assets })` 模式。

### 实施步骤

#### Step 1: use-conversation-manager.ts（主路径）
**文件：** `src/app/hooks/use-conversation-manager.ts`
**行号：** 57-101

修改 `triggerAssetFulfillment`：
- 在 line 59 后插入：`const capturedVersion = useGameStore.getState().configVersion;`
- 在 .then() 回调开头（line 73 前）插入：`if (useGameStore.getState().configVersion !== capturedVersion) return;`

#### Step 2: chat-panel.tsx（旧路径）
**文件：** `src/ui/chat/chat-panel.tsx`
**行号：** 55-99

修改 `triggerAssetFulfillment`：
- 在 line 56 后插入：`const capturedVersion = useGameStore.getState().configVersion;`
- 在 .then() 回调开头插入版本检查
- 替换 engine config 直接 mutation 为不可变模式：
  ```ts
  // 替换直接 mutation:
  // engineConfig.assets = { ...engineConfig.assets, ...assets };
  // 改为:
  const prev = engine.getConfig();
  engine.loadConfig({ ...prev, assets: { ...prev.assets, ...assets } });
  ```

#### Step 3: ui-action-executor.ts
**文件：** `src/ui/chat/ui-action-executor.ts`
**行号：** ~37-55

在 await fulfillAssets 前后添加版本检查。

#### Step 4: landing-page.tsx
**文件：** `src/ui/landing/landing-page.tsx`
**行号：** ~122-139

在 fulfillAssetsInBackground 的 await 前后添加版本检查。

#### Step 5: 测试
新建测试文件 `src/app/hooks/__tests__/asset-race-guard.test.ts`：
- Mock AssetAgent.fulfillAssets 为延迟 Promise
- 启动 fulfillment for config A
- Promise resolve 前，通过 useGameStore.setState 切换到 config B（configVersion+1）
- 断言：batchUpdateAssets 未被调用（过时结果被丢弃）
- 覆盖所有 4 个调用点

### 关键文件
| 文件 | 操作 | 说明 |
|------|------|------|
| src/app/hooks/use-conversation-manager.ts:57-101 | 修改 | 添加 configVersion 捕获和检查 |
| src/ui/chat/chat-panel.tsx:55-99 | 修改 | 添加版本检查 + 修复 mutation |
| src/ui/chat/ui-action-executor.ts:37-55 | 修改 | 添加版本检查 |
| src/ui/landing/landing-page.tsx:122-139 | 修改 | 添加版本检查 |
| src/app/hooks/__tests__/asset-race-guard.test.ts | 新建 | 竞态保护测试 |

### 风险与缓解
| 风险 | 缓解措施 |
|------|----------|
| configVersion 在某些路径未递增 | game-store.ts setConfig/batchUpdateAssets 已自动递增，无需额外处理 |
| 用户修改参数（非切换游戏）也触发版本递增导致素材被丢弃 | setConfig 和 batchUpdateAssets 递增版本是正确的——参数修改后旧素材确实应该被丢弃 |
| chat-panel.tsx mutation 修复可能影响旧代码路径 | chat-panel.tsx 是旧路径（Wizard/Mode B），use-conversation-manager.ts 是主路径，两者独立 |

### 验证
- `npx vitest run src/app/hooks/__tests__/asset-race-guard.test.ts`
- `npm run build`（确保无类型错误）

### SESSION_ID（供 /ccg:execute 使用）
- CODEX_SESSION: 019d6adb-8e78-77f3-93ba-d7bdad241568
- GEMINI_SESSION: N/A（直接调用模式）
