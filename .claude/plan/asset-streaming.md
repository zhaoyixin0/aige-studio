# Implementation Plan: Asset Streaming (MASTER-PLAN 7.1 + 7.3)

> 双模型协作产出：Codex（后端架构权威）+ Gemini（前端 UX 权威），交叉验证后的统一方案
> 目标：解决线上 12-145 秒白屏 bug — 每张 sprite 完成后立即可见，而非等全部完成

---

## 根因（已用 Playwright 在生产环境确证）

**线上时间线** (aige-studio-app.vercel.app 真实测量):
```
[ 9.3s]  /api/claude → 200  (14 modules config)
[12.9s]  store: 1 key, 0 real data
[30.6s]  /api/gemini → 200  (sprite 1 generated internally)
[50.8s]  /api/gemini → 200  (sprite 2)
[71.4s]  /api/gemini → 200  (sprite 3)
[94.0s]  /api/gemini → 200  (sprite 4)
[116.2s] /api/gemini → 200  (sprite 5)
[138.4s] /api/gemini → 200  (sprite 6)
[145.5s] store: 6 keys, 6 real data  ← 一次性 batchUpdate
```

`AssetAgent.fulfillAssets()` 串行 for loop 累积到本地 map，全部完成才 return → 调用方一次性 `batchUpdateAssets()`。期间 PixiJS canvas 完全空白，用户以为崩溃、刷新、丢失状态。

**不是 Vercel 超时**（服务端完全正常），**不是 ERR_ABORTED**（是 QA agent 关闭页面触发的），**不是 API key 问题**。

---

## 任务类型

- [x] Backend (→ Codex 主导：asset-agent API、race guard、renderer hot-swap 事件)
- [x] Frontend (→ Gemini 主导：ChatBlock 生命周期、skeleton UI、timeline UX)
- [x] Fullstack (→ 共享 streaming applier)

---

## 技术方案

### 架构选型（Codex 推荐 Option B，Gemini 同意）

**Option B — 流式回调 + 事件驱动 hot-swap**

两个模型独立评估三个方案后一致选 B：
- ❌ Option A（per-asset `engine.loadConfig`）：重载便宜但不会 rebind 已实例化的 sprite
- ❌ Option C（流式写 store + 延迟单次 reload）：中途显示混乱（部分 emoji + 部分图片）
- ✅ **Option B**：per-asset 写 store + 发射 `assets:updated` 事件 + renderer 监听做 in-place texture swap

**理由：** 首张 sprite ~30s 可见；已渲染对象立即换纹理无需重启；避免整体 reload 成本。

### 关键架构决策

| 决策点 | 方案 | 主导模型 |
|-------|------|----------|
| AssetAgent API | 新增 `opts.onAsset(key, entry, ctx)` 回调 | Codex |
| 共享应用层 | `stream-apply-asset.ts` DRY 两个调用点 | Codex |
| race guard 语义 | 单调序列守卫 `configVersion === v0 + applied` | Codex |
| 引擎 hot-swap | `engine.eventBus.emit('assets:updated', ...)` + `PixiRenderer.listen` | Codex |
| Chat 消息更新 | **新增 `updateChatMessage(id, updater)` action**（不用 truncate+readd） | Gemini |
| Progress 消息位置 | **独立的新 assistant 消息**（和"已创建..."并列，不覆盖"思考中..."） | Gemini |
| 进度 UI 布局 | 单条消息内同时挂 `progress-log` + `asset-preview` 两个 block | Gemini |
| Pending 视觉 | 骨架屏 `animate-pulse` + `Loader2` spin + "生成中..."文案 | Gemini |
| 完成态收敛 | 全部完成后自动移除 `progress-log`，只保留 `asset-preview` 网格 | Gemini |
| 活跃条目高亮 | `text-white font-medium drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]` | Gemini |
| 无障碍 | 独立 `<div aria-live="polite" sr-only>` 而非整个 block 加 aria | Gemini |

### 重用已有基础设施

**不要重新发明**：这些类型/组件今天就能用：
- `conversation-defs.ts`: `ChatBlock` (kind `'progress-log'` / `'asset-preview'`)、`ProgressEntry`、`AssetPreviewItem`
- `progress-log-block.tsx`: 已是纯组件，原生支持 live update（只要 parent 传新 entries）
- `asset-preview-block.tsx`: 需加 loading state 分支
- `AbortController` 机制：已在 `asset-agent.ts:122-137`，只需在新回调点尊重 `signal.aborted`

---

## 实施步骤

### Phase A — 基础设施（后端 + Store）

#### Step A1: `editor-store.ts` 新增 updateChatMessage action
**文件：** `src/store/editor-store.ts`

```typescript
// 新增在 store interface 和 actions 中
updateChatMessage: (id: string, updater: (msg: ChatMessage) => ChatMessage) => void;

// 实现
updateChatMessage: (id, updater) =>
  set((state) => ({
    chatMessages: state.chatMessages.map((m) => (m.id === id ? updater(m) : m)),
  })),
```

**测试：** `src/store/__tests__/editor-store-update-message.test.ts`
- `updateChatMessage replaces blocks immutably`
- `updateChatMessage on non-existent id is no-op`

#### Step A2: `asset-agent.ts` 扩展 fulfillAssets API
**文件：** `src/services/asset-agent.ts`

**新签名（向后兼容 overload）：**
```typescript
interface FulfillOptions {
  onProgress?: (p: AssetFulfillProgress) => void;
  onAsset?: (key: string, entry: AssetEntry, ctx: { index: number; total: number }) => void | Promise<void>;
  onError?: (key: string, err: unknown, ctx: { index: number; total: number }) => void;
}

async fulfillAssets(
  config: GameConfig,
  opts?: FulfillOptions | ((p: AssetFulfillProgress) => void),  // legacy: function = onProgress
): Promise<Record<string, AssetEntry>>
```

**回调时序（关键！）：**
1. `onProgress({status:'generating', key, current, total})` — Gemini 调用前
2. `onProgress({status:'removing-bg'})` — 去背景前（非 background）
3. **[新]** `onAsset(key, entry, ctx)` — 在 `library.save()` 成功之后、for 循环继续之前；**必须 `await` 并在调用前检查 `signal.aborted`**
4. `onProgress({status:'done' | 'error'})` — 在 onAsset 之后

**核心 for 循环补丁（在 line 249 `result[key] = ...` 之后）：**
```typescript
result[key] = { type: assetType, src: dataUrl };

if (signal.aborted) return result;
if (opts && typeof opts === 'object' && opts.onAsset) {
  try {
    await opts.onAsset(key, result[key], { index: i, total });
  } catch (err) {
    console.warn('[AssetAgent] onAsset callback threw:', err);
    // 不中止 — 让 race guard 在 applier 侧决定是否继续
  }
}

opts?.onProgress?.({ current: i + 1, total, key, status: 'done' });
```

**测试：** `src/services/__tests__/asset-agent-streaming.test.ts`
- `streams first asset before second starts`
- `invokes onAsset after library.save and before next iteration`
- `stops streaming when aborted midway (partial result returned)`
- `onAsset throwing does not stop loop`
- `backward compat: legacy function onProgress still works`

#### Step A3: 共享 stream-apply-asset 工具
**新文件：** `src/app/hooks/use-asset-stream-applier.ts`

```typescript
export interface StreamApplierDeps {
  engineRef: React.RefObject<Engine | null>;
  progressMsgId: string;  // 已由调用方提前创建的进度消息 ID
}

export function makeStreamingApplier(deps: StreamApplierDeps) {
  const v0 = useGameStore.getState().configVersion;
  let applied = 0;
  let stopped = false;

  const updateMessage = useEditorStore.getState().updateChatMessage;
  const batchUpdateAssets = useGameStore.getState().batchUpdateAssets;

  function mutateBlock<K extends ChatBlock['kind']>(
    msg: ChatMessage,
    kind: K,
    mutator: (block: Extract<ChatBlock, { kind: K }>) => Extract<ChatBlock, { kind: K }>,
  ): ChatMessage {
    if (!msg.blocks) return msg;
    return {
      ...msg,
      blocks: msg.blocks.map((b) => (b.kind === kind ? mutator(b as Extract<ChatBlock, { kind: K }>) : b)),
    };
  }

  return {
    onProgress(p: AssetFulfillProgress) {
      if (stopped) return;
      updateMessage(deps.progressMsgId, (msg) =>
        mutateBlock(msg, 'progress-log', (block) => ({
          ...block,
          entries: block.entries.map((e) =>
            e.key === p.key ? { ...e, status: p.status, message: humanLabel(p) } : e,
          ),
        })),
      );
    },

    async onAsset(key: string, entry: AssetEntry, _ctx: { index: number; total: number }) {
      if (stopped) return;

      // Monotonic race guard
      const current = useGameStore.getState().configVersion;
      if (current !== v0 + applied) {
        stopped = true;
        return;  // Foreign change detected — stop quietly
      }

      // 1. Write store (will bump configVersion by 1)
      batchUpdateAssets({ [key]: entry });
      applied += 1;

      // 2. Emit engine hot-swap event
      const engine = deps.engineRef.current;
      engine?.eventBus.emit('assets:updated', {
        updates: [{ key, src: entry.src, type: entry.type }],
      });

      // 3. Update asset-preview thumbnail in chat
      updateMessage(deps.progressMsgId, (msg) =>
        mutateBlock(msg, 'asset-preview', (block) => ({
          ...block,
          items: block.items.map((item) =>
            item.key === key ? { ...item, src: entry.src } : item,
          ),
        })),
      );
    },

    get isStopped() { return stopped; },
  };
}
```

**测试：** `src/app/hooks/__tests__/asset-stream-applier.test.ts`
- `writes each asset incrementally via batchUpdateAssets`
- `stops when foreign configVersion bump detected`
- `allows own sequential writes (v0 + applied monotonic)`
- `emits assets:updated event per asset`
- `updates chat asset-preview block thumbnails in order`

---

### Phase B — 调用点重构

#### Step B1: 重构 `use-conversation-manager.ts` triggerAssetFulfillment
**文件：** `src/app/hooks/use-conversation-manager.ts`

**当前代码（line 57-103）替换为：**

```typescript
const triggerAssetFulfillment = useCallback(
  (newConfig: GameConfig) => {
    const assetAgent = new AssetAgent();
    const progressMsgId = crypto.randomUUID();

    // Pre-seed all keys as pending
    const expectedKeys = extractAssetKeys(newConfig).filter(
      (k) => !newConfig.assets[k]?.src.startsWith('data:'),
    );
    const initialEntries: ProgressEntry[] = expectedKeys.map((k) => ({
      key: k,
      status: 'pending',
      message: `等待中: ${k}`,
    }));
    const initialItems: AssetPreviewItem[] = expectedKeys.map((k) => ({
      key: k,
      label: k,
      src: '',  // empty → skeleton
      source: 'ai',
    }));

    addChatMessage({
      id: progressMsgId,
      role: 'assistant',
      content: `\uD83C\uDFA8 正在生成 ${expectedKeys.length} 个游戏素材...`,
      timestamp: Date.now(),
      blocks: [
        { kind: 'progress-log', entries: initialEntries },
        { kind: 'asset-preview', items: initialItems, allowApplyAll: false },
      ],
    });

    const applier = makeStreamingApplier({ engineRef, progressMsgId });

    assetAgent
      .fulfillAssets(newConfig, {
        onProgress: applier.onProgress,
        onAsset: applier.onAsset,
      })
      .then(() => {
        // Final collapse: replace main text, drop progress-log
        updateChatMessage(progressMsgId, (msg) => ({
          ...msg,
          content: `\u2705 已生成 ${applier.appliedCount} 个游戏素材！`,
          blocks: msg.blocks?.filter((b) => b.kind !== 'progress-log'),
        }));
      })
      .catch((err) => {
        if (applier.isStopped) return;  // Silent — foreign config change
        addChatMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `\u274C 素材生成失败: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: Date.now(),
        });
      });
  },
  [addChatMessage, updateChatMessage, engineRef],
);
```

#### Step B2: 重构 `landing-page.tsx` fulfillAssetsInBackground
**文件：** `src/ui/landing/landing-page.tsx`

同样的模式，但使用 `useEngineContext()` 而非 prop。**关键：提取共享逻辑为 hook** `useStreamingAssetFulfillment()` 放在 `src/app/hooks/` 中，让两个调用点都调用它，避免 B1 和 B2 重复。

**测试：**
- `src/ui/landing/__tests__/fulfill-assets-streaming.test.tsx` — `landing_page_streams_assets_via_shared_applier`
- `src/app/hooks/__tests__/use-conversation-manager-stream.test.ts` — `conversation_manager_streams_assets_and_updates_chat`

---

### Phase C — 前端呈现层

#### Step C1: `asset-preview-block.tsx` 支持 loading state
**文件：** `src/ui/chat/asset-preview-block.tsx`

```tsx
{item.src ? (
  <img
    src={item.src}
    alt={item.label}
    className="w-full h-full object-contain animate-in fade-in zoom-in-95 duration-500"
    loading="lazy"
  />
) : (
  <div className="w-full h-full bg-white/5 animate-pulse flex flex-col items-center justify-center gap-1 rounded-lg">
    <Loader2 size={20} className="text-white/20 animate-spin" />
    <span className="text-[9px] text-white/30">生成中</span>
  </div>
)}
```

**测试：** `src/ui/chat/__tests__/asset-preview-loading-state.test.tsx`
- `renders skeleton when item.src is empty`
- `renders image when item.src is set`
- `fades in on src transition`

#### Step C2: `progress-log-block.tsx` 视觉增强
**文件：** `src/ui/chat/progress-log-block.tsx`

1. 加 `aria-live="polite"` 包装器（独立 sr-only div 而非整个 block）
2. 活跃条目高亮：
   ```tsx
   className={
     entry.status === 'generating' || entry.status === 'removing-bg'
       ? 'text-white font-medium drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]'
       : entry.status === 'done' ? 'text-white/40'
       : entry.status === 'error' ? 'text-red-400'
       : 'text-white/70'
   }
   ```
3. 确认 StatusIcon 已覆盖 5 种状态（pending/generating/removing-bg/done/error/skipped）

**测试：** `src/ui/chat/__tests__/progress-log-streaming.test.tsx`
- `highlights active entry with text-white font-medium`
- `aria-live region announces status changes`
- `handles error status with red text`

---

### Phase D — 引擎 hot-swap

#### Step D1: 定义 `assets:updated` 事件契约
**文件：** `src/engine/core/events.ts`

```typescript
export interface AssetsUpdatedPayload {
  updates: Array<{
    key: string;
    src: string;
    type: 'sprite' | 'background';
  }>;
}

// 加到 EVENT_NAMES
'assets:updated': AssetsUpdatedPayload;
```

#### Step D2: `PixiRenderer` 监听 assets:updated
**文件：** `src/engine/renderer/pixi-renderer.ts`

在 `connectToEngine()` 中添加：
```typescript
engine.eventBus.on('assets:updated', (payload: AssetsUpdatedPayload) => {
  for (const update of payload.updates) {
    if (update.type === 'background') {
      // Background 已有每帧 store 检查，这里主动触发一次立即 swap
      this.syncBackgroundImage?.(/* force reload flag */);
    } else {
      // Sprite hot-swap：转发到 game-object-renderer
      this.gameObjectRenderer?.applyAssetUpdate?.(update.key, update.src);
    }
  }
});
```

#### Step D3: `GameObjectRenderer.applyAssetUpdate` 方法
**文件：** `src/engine/renderer/game-object-renderer.ts`

新增方法，遍历当前 sprite 容器，按 assetKey 匹配的 swap texture：

```typescript
applyAssetUpdate(key: string, src: string): void {
  // 1. Invalidate texture cache
  this.textureCache.delete(key);

  // 2. Iterate existing sprites whose source key === `key`
  //    For each: replace child sprite with new Sprite(texture) from data URL
  //    (或者如果已是 Sprite，直接 swap texture)
  for (const [spriteKey, container] of this.sprites) {
    if (this.getAssetKeyForSprite(spriteKey) === key) {
      this.rebuildSpriteFromDataUrl(container, src);
    }
  }

  // 3. Player sprite if applicable
  if (key === 'player' && this.playerSprite) {
    this.rebuildSpriteFromDataUrl(this.playerSprite, src);
  }
}
```

**测试：** `src/engine/renderer/__tests__/asset-hot-swap.test.ts`
- `assets:updated event triggers per-asset texture swap`
- `replaces emoji fallback wrapper with image sprite`
- `swaps existing sprite texture without recreating container`
- `background invalidation triggers sync`

**范围控制：** 本 plan 只实现 `GameObjectRenderer` 和 background 的 hot-swap。`ShooterRenderer` / `ParallaxRenderer` / RPG overlays 的 hot-swap 作为 follow-up（新建 issue 追踪），不阻塞 7.1/7.3 发布。

---

### Phase E — 验证 + 部署

#### Step E1: Playwright E2E 回归测试
**新文件：** `qa-e2e/tests/asset-streaming.spec.ts`

```typescript
test('first sprite visible by 35s, all visible by 160s', async ({ page }) => {
  test.setTimeout(200000);

  await page.goto('https://aige-studio-app.vercel.app/');
  await page.locator('button').filter({ hasText: /接/ }).first().click();

  // Poll store every 5s, expect at least 1 real asset by 35s
  await expect.poll(
    async () => {
      const state = await page.evaluate(() => {
        const store = (window as any).__gameStore?.getState?.();
        return Object.values(store?.config?.assets ?? {})
          .filter((a: any) => a.src.startsWith('data:'))
          .length;
      });
      return state;
    },
    { timeout: 40000, intervals: [5000] },
  ).toBeGreaterThanOrEqual(1);

  // By 160s, expect all assets
  await expect.poll(
    async () => { /* same */ },
    { timeout: 160000, intervals: [10000] },
  ).toBeGreaterThanOrEqual(5);
});
```

#### Step E2: 本地 Build + Type check
```bash
npx tsc -b
npm run build
npx vitest run
```

#### Step E3: 部署 + 生产验证
```bash
git add -A
git commit -m "feat: streaming asset fulfillment with per-sprite hot-swap"
git push
# Vercel auto-deploy
# Re-run qa-e2e/tests/asset-streaming.spec.ts against prod
```

---

## 关键文件清单

| 文件 | 操作 | Step | 改动量 |
|------|------|------|--------|
| `src/store/editor-store.ts` | Modify | A1 | +10 行 action |
| `src/services/asset-agent.ts` | Modify | A2 | +15 行 / 修改 opts 参数 |
| `src/app/hooks/use-asset-stream-applier.ts` | **Create** | A3 | ~80 行 |
| `src/app/hooks/use-conversation-manager.ts` | Modify | B1 | 重写 triggerAssetFulfillment (~50 行) |
| `src/ui/landing/landing-page.tsx` | Modify | B2 | 重构为调用共享 hook (~30 行) |
| `src/ui/chat/asset-preview-block.tsx` | Modify | C1 | +15 行 skeleton 分支 |
| `src/ui/chat/progress-log-block.tsx` | Modify | C2 | +10 行高亮 + aria |
| `src/engine/core/events.ts` | Modify | D1 | +10 行事件类型 |
| `src/engine/renderer/pixi-renderer.ts` | Modify | D2 | +15 行 listener |
| `src/engine/renderer/game-object-renderer.ts` | Modify | D3 | +40 行 applyAssetUpdate |
| Tests (9 个文件) | Create | All | ~400 行 |

**总代码量：** ~275 行产品代码 + ~400 行测试

---

## 时序图：成功路径

```
[ 0s] User clicks chip
[ 2s] agent.process() starts
[ 9s] /api/claude → 200 → setConfig → configVersion v0=1
[10s] triggerAssetFulfillment creates progressMsgId + makeStreamingApplier (captures v0=1, applied=0)
[10s] addChatMessage({blocks:[progress-log(6×pending), asset-preview(6×empty)]})
[10s] PixiJS loads empty config (14 modules, all emoji fallback)
[11s] fulfillAssets starts generating sprite 1 (background)
[11s] → onProgress('generating', background) → UI updates progress-log
[31s] → onAsset('background', entry)
        - guard: current=1, v0+applied=1+0=1 ✓
        - batchUpdateAssets({background: ...}) → configVersion = 2
        - applied = 1
        - emit 'assets:updated' → PixiRenderer hot-swap background texture
        - updateChatMessage: asset-preview[0].src = dataUrl → skeleton → image fade-in
[31s] USER SEES: Background appears on canvas. First thumbnail in chat.
[31s] → onProgress('done', background)
[31s] fulfillAssets continues with sprite 2 (good_1)
...
[145s] All 6 sprites delivered, each triggering hot-swap + thumbnail fade-in
[146s] fulfillAssets resolves → updateChatMessage collapses progress-log
[146s] USER SEES: ✅ 已生成 6 个游戏素材 + full thumbnail grid
```

---

## 时序图：异常路径

### 部分失败（sprite 4/6 fails）
```
[95s] Gemini returns error for sprite 4
[95s] asset-agent catch block: onError + onProgress('error') → 不 rethrow
[95s] UI: progress-log[3].status = 'error' (红色 XCircle)
[95s] UI: asset-preview[3] 显示 broken image + 'failed' 标签
[95s] Loop continues with sprite 5
...
[145s] Final message: "⚠️ 已生成 5/6 个素材，1 个失败"
```

### Foreign configVersion bump（用户切换了游戏）
```
[50s] sprite 2 in flight
[55s] User clicks different chip → new submitMessage → setConfig → v=3 (was 2)
[71s] sprite 2 completes → onAsset fires
[71s] guard: current=3, v0+applied=1+1=2 → 不匹配 → applier.stopped = true
[71s] 后续 onAsset 调用全部静默 return
[71s] fulfillAssets 自然跑完后 .then 检查 isStopped → 不显示成功消息
```

### AbortController signal
```
[50s] User refreshes page / unmounts component
[50s] asset-agent signal.aborted = true (any subsequent check)
[71s] sprite 2 completes → signal.aborted check → return partial result
[71s] applier 从未收到 onAsset → 不写 store
```

---

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| `applyAssetUpdate` 重建 sprite 导致位置跳变 | 保留原 container 的 x/y/rotation，只 swap 内部 children 的 texture/sprite |
| `onAsset` 回调抛异常导致 for 循环中断 | asset-agent 内部 try/catch onAsset 调用；applier 不抛错，错误通过 isStopped 传达 |
| `updateChatMessage` 频繁调用引发 React re-render 风暴 | Zustand 只 re-render 订阅该消息 id 的组件（MessageList 的 memo 保护）；测试 FPS |
| 两个调用点逻辑分叉 | 强制提取 `useStreamingAssetFulfillment()` hook，B1 和 B2 都调用它 |
| `batchUpdateAssets` 本身 bump configVersion → guard 自己 trip 自己 | 单调序列 guard 容忍 `v0 + applied` 自增（Codex 核心洞见） |
| Texture GC 内存泄漏 | 在 `textureCache.delete(key)` 同时 destroy old texture |
| Hot-swap 只覆盖 GameObjectRenderer，shooter/rpg 游戏效果差 | Phase D 明确范围；follow-up issue 追踪其他 renderer |
| 测试 flaky（45s 轮询窗口太紧） | Playwright 用 `expect.poll` with explicit intervals，timeout 宽松 40s |

---

## 验收标准

**必须全部满足才能 merge：**

1. ✅ `npx tsc -b` 零错误
2. ✅ `npx vitest run` 全绿（含 9 个新测试文件）
3. ✅ Playwright E2E `asset-streaming.spec.ts` 通过：
   - 首张 sprite 在 40s 内出现（相对点击时刻）
   - 6 张全部出现在 160s 内
   - 无 console error/pageerror
4. ✅ 本地 `npm run dev` 点击"接住"chip：
   - 11s 看到 "🎨 正在生成 6 个游戏素材" 消息 + 6 个骨架屏
   - 31s 第一张 thumbnail fade-in + canvas 显示 background
   - 52/72/94/116/138s 渐进填充
   - 146s 成功消息出现，progress-log 自动收起
5. ✅ 部署到 Vercel production 后，Playwright 重跑 `asset-streaming.spec.ts` 仍通过
6. ✅ 手动 smoke：在不同网速下（3G 节流）游戏流畅加载，不出现白屏

---

## Execution Order（依赖 DAG）

```
Phase A (可并行)
├── A1 editor-store updateChatMessage
├── A2 asset-agent onAsset (independent)
└── A3 stream-applier (需要 A1 + A2)
      ↓
Phase B (串行)
├── B1 use-conversation-manager (需要 A3)
└── B2 landing-page + 提取共享 hook (需要 B1 成型)
      ↓
Phase C (可并行, 需要 conversation-defs 类型确认)
├── C1 asset-preview-block skeleton
└── C2 progress-log-block highlighting + aria
      ↓
Phase D (串行, 需要 PixiRenderer 上下文)
├── D1 events.ts 类型定义
├── D2 PixiRenderer listener (需要 D1)
└── D3 GameObjectRenderer applyAssetUpdate (需要 D2)
      ↓
Phase E (最后)
├── E1 Playwright E2E test
├── E2 Build + typecheck
└── E3 Deploy + prod verify
```

**预估总工时：**
- Phase A: 45 min（含测试）
- Phase B: 30 min
- Phase C: 20 min
- Phase D: 45 min（hot-swap 需要小心）
- Phase E: 30 min（含部署 + 生产 E2E）
- **合计：~2.5-3 小时**（双模型分析结论基本一致）

---

## SESSION_IDs (for /ccg:execute resume)

- **CODEX_SESSION:** `019d6ee4-c79e-7880-874b-937d33ae2e96`
- **GEMINI_SESSION:** policy mode, no persistent session

## 双模型输出摘要对照表

| 维度 | Codex 推荐 | Gemini 推荐 | 融合决策 |
|------|-----------|------------|---------|
| AssetAgent API | `opts.onAsset` callback | extend `onProgress` to include `dataUrl` | **采用 Codex**（更清晰的职责分离） |
| Race guard | `v0 + applied` 单调序列 | （未详细讨论） | **采用 Codex**（后端权威） |
| Chat 消息更新 | "truncate + re-add" hack | **`updateChatMessage` action** | **采用 Gemini**（前端权威，优雅） |
| Pending 视觉 | 未细节 | Skeleton + `animate-pulse` + `Loader2` | **采用 Gemini**（UX 权威） |
| Progress block 位置 | inline 在现有消息 | **独立新消息** | **采用 Gemini**（与"已创建..."语义分离） |
| 完成后状态 | 留在历史 | **主动移除 progress-log，只留 asset-preview** | **采用 Gemini**（减少视觉噪音） |
| Engine hot-swap | **`assets:updated` event + renderer listener** | （未涉及）| **采用 Codex**（后端权威） |
| 测试矩阵 | 7 个测试文件 | 未列出 | **采用 Codex** + C 阶段补前端测试 |

两个模型在核心架构（Option B 流式 + hot-swap）上完全一致，分歧全部在各自权威领域（前端 vs 后端），融合无冲突。
