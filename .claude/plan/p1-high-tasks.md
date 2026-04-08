## 实施计划：P1-High 任务

### 双模型验证结果（Codex + Gemini 2026-04-07）

| 任务 | 状态 | 说明 |
|------|------|------|
| 3.1 SkillLoader 集成 | **已完成** | buildSystemPrompt() 已调用 loadForConversation + loadExpertCardRich + loadRecipeCardSummaries |
| 3.2 UI-intent 工具 | **未完成** | TOOLS 数组缺少 3 个素材操作工具 |
| 6.1 E2E 测试 | **未完成** | 使用 /everything-claude-code:e2e skill 执行 |
| 1.2 useEngine 卸载安全 | **已完成** | cleanup 已调用 restart() + destroy() |

---

## 任务 3.2: UI-intent 工具定义

### 任务类型
- [x] 后端（Agent 层）

### 背景
UI 层已有完整的 UIAction 处理机制（ui-action-executor.ts 处理 REQUEST_ASSETS_GENERATE、REQUEST_ASSET_REPLACE、SHOW_ASSET_PREVIEWS），但 Claude API 的 TOOLS 数组中没有对应的工具定义，Agent 无法通过对话触发素材操作。

### 技术方案
1. 在 TOOLS 数组中添加 3 个工具定义
2. 在 ConversationAgent.process() 的 switch(block.name) 中添加 3 个 handler
3. Handler 调用 dispatchUIAction() 将工具调用映射为 UIAction 事件
4. 更新 SYSTEM_PROMPT_BASE 添加使用指导

### 实施步骤

#### Step 1: 添加工具定义到 TOOLS 数组
**文件：** `src/agent/conversation-defs.ts`
**位置：** TOOLS 数组末尾（约 line 482，push_expert_insight 之后）

新增 3 个工具：
```typescript
{
  name: 'request_assets_generate',
  description: '请求 UI 生成游戏素材。省略 keys 表示生成所有缺失素材。',
  input_schema: {
    type: 'object',
    properties: {
      keys: { type: 'array', items: { type: 'string' }, description: '要生成的素材 key 列表（如 good_1, player）' },
      show_preview: { type: 'boolean', description: '生成后是否展示预览' },
    },
  },
},
{
  name: 'request_asset_replace',
  description: '请求替换指定素材。可指定 AI 生成或用户上传。',
  input_schema: {
    type: 'object',
    properties: {
      target: { type: 'string', description: '要替换的素材 key' },
      preferred_source: { type: 'string', enum: ['ai', 'upload'], description: '首选来源' },
    },
    required: ['target'],
  },
},
{
  name: 'show_asset_previews',
  description: '展示素材预览卡片供用户确认或应用。',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            label: { type: 'string' },
            src: { type: 'string' },
            source: { type: 'string', enum: ['ai', 'user'] },
          },
          required: ['key', 'label', 'src', 'source'],
        },
        description: '预览项列表',
      },
    },
    required: ['items'],
  },
},
```

#### Step 2: 添加 handler 到 ConversationAgent.process()
**文件：** `src/agent/conversation-agent.ts`
**位置：** switch(block.name) 中，push_expert_insight case 之后（约 line 317）

```typescript
case 'request_assets_generate': {
  const input = block.input as { keys?: string[]; show_preview?: boolean };
  if (typeof window !== 'undefined') {
    const { dispatchUIAction } = await import('@/ui/chat/ui-action-executor');
    dispatchUIAction({
      type: 'REQUEST_ASSETS_GENERATE',
      keys: input.keys,
      showPreview: input.show_preview ?? true,
    });
  }
  if (!reply) reply = '正在生成素材...';
  break;
}

case 'request_asset_replace': {
  const input = block.input as { target: string; preferred_source?: 'ai' | 'upload' };
  if (typeof window !== 'undefined') {
    const { dispatchUIAction } = await import('@/ui/chat/ui-action-executor');
    dispatchUIAction({
      type: 'REQUEST_ASSET_REPLACE',
      target: input.target,
      preferredSource: input.preferred_source ?? 'ai',
    });
  }
  if (!reply) reply = '正在处理素材替换...';
  break;
}

case 'show_asset_previews': {
  const input = block.input as { items: Array<{ key: string; label: string; src: string; source: 'ai' | 'user' }> };
  if (typeof window !== 'undefined') {
    const { dispatchUIAction } = await import('@/ui/chat/ui-action-executor');
    dispatchUIAction({
      type: 'SHOW_ASSET_PREVIEWS',
      items: input.items,
    });
  }
  if (!reply) reply = '已展示素材预览。';
  break;
}
```

注意：使用 dynamic import 避免在 Node/测试环境中引入 window 依赖。

#### Step 3: 更新系统提示词
**文件：** `src/agent/conversation-defs.ts`
**位置：** SYSTEM_PROMPT_BASE 的 "创建后交互" 部分（约 line 277-279）

在现有规则后追加：
```
- 创建游戏后如需补齐素材，调用 request_assets_generate（省略 keys 表示全部缺失项）
- 用户要求更换某个素材时，调用 request_asset_replace 并指定 target
- 需要展示已有素材供用户选择时，调用 show_asset_previews
```

#### Step 4: 测试
新建 `src/agent/__tests__/ui-intent-tools.test.ts`：
- Mock dispatchUIAction
- 测试 ConversationAgent 处理 request_assets_generate tool_use 时正确调用 dispatch
- 测试 request_asset_replace 和 show_asset_previews 同理

### 关键文件
| 文件 | 操作 | 说明 |
|------|------|------|
| src/agent/conversation-defs.ts:~482 | 修改 | TOOLS 数组添加 3 个工具定义 |
| src/agent/conversation-defs.ts:~279 | 修改 | SYSTEM_PROMPT_BASE 添加使用指导 |
| src/agent/conversation-agent.ts:~317 | 修改 | process() switch 添加 3 个 handler |
| src/agent/__tests__/ui-intent-tools.test.ts | 新建 | 工具调用测试 |

### 风险与缓解
| 风险 | 缓解措施 |
|------|----------|
| Node/测试环境无 window | dynamic import + typeof window guard |
| LLM 误用新工具 | 系统提示词明确使用场景 + 工具 description 清晰 |
| show_asset_previews 的 src 安全 | 来源限于 AssetAgent 生成的 data: URL，非外部 URL |

---

## 任务 6.1: E2E 测试

使用 `/everything-claude-code:e2e` skill 执行，不需要手动搭建。

---

### 验证
- `npx vitest run src/agent/__tests__/ui-intent-tools.test.ts`
- `npm run build`

### SESSION_ID（供 /ccg:execute 使用）
- CODEX_SESSION: 019d6b1e-cfb9-7fd2-a2fc-48600a2b0713
- GEMINI_SESSION: N/A
