## 实施计划：E2E 评测报告 4 大问题修复

### 双模型分析结果（Codex + Gemini 2026-04-07）

| Issue | 优先级 | 根因 | 修复方式 |
|-------|--------|------|---------|
| #1 api/gemini 完全失效 | **P0** | Vercel runtime/timeout/env 配置问题 | 锁定 Node runtime + 增加 maxDuration + 验证 env |
| #2 AI 失败导致应用崩溃 | **P0** | landing-page 缺 .catch + 缺 ErrorBoundary | 加 .catch + 全局 unhandledrejection 兜底 |
| #3 Board Mode 风格无效 | **P1** | main-layout.tsx handleParamChange 不调 engine.loadConfig | setConfig 后调 engine.loadConfig |
| #4 面板遮挡输入框 | **P2** | board-mode-container `inset-0 z-30` | 改为 `bottom-[76px]` 留出底部 |

---

## Issue #1: api/gemini Vercel endpoint 修复

### 任务类型
- [x] 后端（API + 部署配置）

### 根因
- `api/gemini.ts` 没有 `maxDuration` 配置，Vercel Hobby 默认 10 秒，Gemini Imagen 4 调用通常 10-20 秒 → 超时 → `net::ERR_ABORTED`
- `package.json` 没有 `engines` 字段，runtime 可能漂移到 Node 16（无 global fetch）→ 函数启动时崩溃
- 没有针对 `api/gemini` 的单元测试

### 实施步骤

#### Step 1: 锁定 runtime + maxDuration
**文件：** `api/gemini.ts`（顶部添加导出）

```typescript
export const config = { runtime: 'nodejs20.x' };
export const maxDuration = 60;
```

#### Step 2: package.json 锁定 Node 版本
**文件：** `package.json`
添加：
```json
"engines": {
  "node": ">=20"
}
```

#### Step 3: 添加 api/gemini 单元测试
**文件：** `api/__tests__/gemini.test.ts`（新建，参考 claude.test.ts 模式）
- Mock global fetch
- 测试：GET 返回 405
- 测试：缺 GEMINI_API_KEY 返回 500
- 测试：成功路径转发 JSON
- 测试：上游错误转发为 502

#### Step 4: 部署后验证（手动）
- Vercel Dashboard 确认 GEMINI_API_KEY 在 Production 和 Preview 都设置
- 部署后 curl POST 验证响应

### 关键文件
| 文件 | 操作 |
|------|------|
| api/gemini.ts | +runtime/maxDuration 配置 |
| package.json | +engines 字段 |
| api/__tests__/gemini.test.ts | 新建测试 |

---

## Issue #2: 应用崩溃 — fire-and-forget 异常兜底

### 任务类型
- [x] 前端（React app + global handler）

### 根因
- `landing-page.tsx:99` 调用 `fulfillAssetsInBackground(result.config)` 是 fire-and-forget，没有外层 .catch
- 虽然 `fulfillAssetsInBackground` 内部有 try/catch（line 124-143），但任何同步抛错或微任务调度问题会成为 unhandled rejection
- 缺全局 ErrorBoundary 兜底渲染异常
- 缺 `window.onunhandledrejection` 兜底

### 实施步骤

#### Step 1: landing-page.tsx 添加 .catch
**文件：** `src/ui/landing/landing-page.tsx:99`

```typescript
// 改为
fulfillAssetsInBackground(result.config).catch((err) => {
  console.warn('[LandingPage] Background asset fulfillment crashed:', err);
});
```

#### Step 2: 添加全局 unhandledrejection 兜底
**文件：** `src/app/App.tsx` 或 `src/main.tsx`（在 root 渲染前注册）

```typescript
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (e) => {
    console.warn('[Global] Unhandled rejection:', e.reason);
    e.preventDefault(); // Prevent default browser error logging
  });
  window.addEventListener('error', (e) => {
    console.warn('[Global] Window error:', e.error ?? e.message);
  });
}
```

#### Step 3: 检查并 hardening 其他 fire-and-forget 路径
搜索代码中所有 `.then(...)` 没有跟 `.catch(...)` 的地方，特别是 ChatPanel/StudioChatPanel/AssetAgent 路径。

### 关键文件
| 文件 | 操作 |
|------|------|
| src/ui/landing/landing-page.tsx:99 | +.catch handler |
| src/main.tsx 或 src/app/App.tsx | +全局 unhandledrejection listener |

---

## Issue #3: Board Mode 风格切换无效

### 任务类型
- [x] 前端（main-layout）

### 根因
`src/ui/layout/main-layout.tsx` `handleParamChange` 函数（line 54-87）：
- 调用 `setConfig(next)` 更新 store
- 调用 `batchUpdateParams(paramOps)` 更新 store
- **从未调用 `engine.loadConfig()`** → 引擎不知道状态变了 → preview 不更新

### 实施步骤
**文件：** `src/ui/layout/main-layout.tsx:54-87`

在 `setConfig(next)` 后立即添加引擎重载：
```typescript
setConfig(next);
const updated = useGameStore.getState().config;
if (updated && engine) {
  engine.loadConfig(updated);
}
```

同样在 `batchUpdateParams(paramOps)` 后添加：
```typescript
batchUpdateParams(paramOps);
const updated = useGameStore.getState().config;
if (updated && engine) {
  engine.loadConfig(updated);
}
```

需要先确认 main-layout.tsx 中如何获取 engine 引用（可能通过 useEngineContext()）。

### 关键文件
| 文件 | 操作 |
|------|------|
| src/ui/layout/main-layout.tsx:54-87 | handleParamChange 添加 engine.loadConfig 调用 |

### 注意
高频参数变更（如拖动 slider）可能导致频繁 reload。如果性能成问题，可加 debounce（150ms）。

---

## Issue #4: Board Mode 面板遮挡聊天输入框

### 任务类型
- [x] 前端（CSS 布局）

### 根因
`src/ui/layout/main-layout.tsx:110-118` Board Mode 容器使用 `absolute inset-0 z-30`，`inset-0` 让面板从顶部一直延伸到底部，盖住了底部的聊天输入框。

### 实施步骤
**文件：** `src/ui/layout/main-layout.tsx:110-118`

将 board-mode-container 的 className 中：
```
absolute inset-0 z-30
```
改为：
```
absolute top-0 left-0 right-0 bottom-[80px] z-30
```

注意：`bottom-[80px]` 的具体数值需要根据 StudioChatPanel 输入区高度调整。可以先用 80px，调试后微调。

### 关键文件
| 文件 | 操作 |
|------|------|
| src/ui/layout/main-layout.tsx:110-118 | board-mode-container 调整布局 |

---

## 优先级与执行顺序

| 顺序 | Issue | 任务 | 估算 |
|------|-------|------|------|
| 1 | #2 | landing.catch + 全局 listener | 15min |
| 2 | #3 | engine.loadConfig in handleParamChange | 15min |
| 3 | #4 | Board Mode 面板布局 | 5min |
| 4 | #1 | api/gemini runtime config + tests | 30min |

**执行原则：** 4 个 issue 互相独立，可并行 dispatch 4 个 agent。

### SESSION_ID
- CODEX_SESSION: 019d6baf-988e-7b13-aefd-86565056c8b4
- GEMINI_SESSION: N/A
