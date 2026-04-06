# Fix: Preset/Template Offline Fallback

> Synthesized from Codex (execution trace + facade integration) + Gemini (UX + process() level intercept).
> Root cause confirmed by both models independently.

---

## 📋 实施计划：Preset Offline Fallback

### 根因

`processWithoutApi()` 没有处理 "使用模板 \<id\>" 消息模式。所有 UI 入口（FeaturedExpertChip、ExpertBrowser、preset chips）发送此格式消息，但无 API key 时 `KEYWORD_MAP` 无法匹配，导致回退到游戏类型选择。

### 技术方案

**采用 Gemini 建议：在 `process()` 顶部拦截，而非仅在 `processWithoutApi()` 中**

理由：
1. "使用模板 xxx" 是 UI 生成的确定性命令，不需要 LLM 推理
2. 即使有 API key，也应走确定性路径 → 零延迟、零 token 消耗
3. 避免 Claude 误判 expert preset ID（Codex 发现 system prompt 未完整注入 expert ID 列表）

### 实施步骤

#### Step 1: process() 顶部拦截 preset intent (M)

**文件：**
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/agent/conversation-agent.ts` | Modify | process() 顶部添加 preset 拦截 |

**逻辑：**
```ts
// process() 方法开头，在 API/non-API 分支之前
const presetMatch = message.trim().match(/^(?:使用|用|采用|应用)\s*模板\s+(\S+)/i)
  ?? message.trim().match(/^use\s+(?:preset|template)\s+(\S+)/i);

if (presetMatch) {
  const presetId = presetMatch[1];
  return this.handlePresetDirectly(presetId);
}
```

**handlePresetDirectly(presetId) 实现：**
```ts
private handlePresetDirectly(presetId: string): ConversationResult {
  try {
    const base = this.buildBaseConfigForPreset();
    const result = runPresetToConfig({ presetId }, base);
    const gt = this.inferGameType(result.config);
    const chips = generateV2CreationChips(gt);
    return {
      reply: `已使用模板「${result.presetId}」创建游戏！`,
      config: result.config,
      chips,
      presetUsed: {
        presetId: result.presetId,
        title: result.presetId,
        pendingAssets: result.pendingAssets.length,
      },
    };
  } catch {
    return {
      reply: `模板「${presetId}」加载失败，请重试或手动描述你想要的游戏。`,
      chips: this.getGameTypeChips(),
      needsMoreInfo: true,
    };
  }
}
```

**测试 (4)：**
- "使用模板 hero-catch-fruit" → config created, reply contains "已使用模板"
- "使用模板 nonexistent-id" → graceful error, reply contains "加载失败"
- "use preset hero-catch-fruit" → English variant works
- 无 API key 时 preset 也能正常工作

---

#### Step 2: 提取 getGameTypeChips() 避免重复 (S)

**文件：**
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/agent/conversation-agent.ts` | Modify | 提取重复的 fallback chips 逻辑 |

**逻辑：** `processWithoutApi()` 中的 game type chips 构建逻辑（lines 799-807）提取为 `getGameTypeChips()` 方法，`handlePresetDirectly()` 错误分支复用。

---

### 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/agent/conversation-agent.ts` | Modify | preset 拦截 + handlePresetDirectly() |
| `src/agent/__tests__/preset-offline.test.ts` | Create | 离线 preset 测试 |

### 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| preset regex 与其他消息冲突 | 仅匹配 "使用模板 \<id\>" 精确格式，不影响自然语言 |
| runPresetToConfig 抛异常 | try/catch + 友好错误消息 + 回退到类型选择 |
| 拦截后有 API key 的 Claude 流程被跳过 | 对 preset 命令来说这是期望行为 — 确定性 > LLM 推理 |

### 预估测试增量: ~4 tests

### SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: 019d617f-1b5e-7960-85b7-b10dd0e432d5
- GEMINI_SESSION: (policy mode, no persistent session)
