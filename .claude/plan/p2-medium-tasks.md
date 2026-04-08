## 实施计划：P2-Medium 任务

### 双模型验证结果（Codex + Gemini 2026-04-07）

| 任务 | 状态 | 说明 |
|------|------|------|
| 3.3 mapConfigToParamCard | 未完成 | UI 基础设施全部就绪，缺 helper 函数 + blocks 字段 plumbing |
| 4.1 Three-View Layout | 部分完成 | 当前布局已支持 chat+preview+editor，缺 paste/drop（范围缩减） |
| 5.2 GameType Search | **已完成** | game-type-selector.tsx 已实现搜索 + 分类 + show more |

---

## 任务 3.3: mapConfigToParamCard + blocks plumbing

### 任务类型
- [x] 后端（Agent 层）

### 技术方案
ParamCard 组件和 ChatBlock 渲染已就绪，只需：
1. 新增 `mapConfigToParamCard()` 辅助函数生成 `{ kind: 'param-card', fields: [...] }`
2. 在 ConversationAgent create_game/modify_game 处理完成后调用并填充 `blocks`
3. 在 ConversationResult 类型添加 `blocks?: ChatBlock[]` 字段
4. 在 use-conversation-manager + landing-page 中将 `result.blocks` 传递到 ChatMessage

保持 `parameterCard`（旧格式）用于 push_parameter_card 工具，避免双 UI 冲突。

### 实施步骤

#### Step 1: 扩展 ConversationResult 类型
**文件：** `src/agent/conversation-defs.ts:39-48`
添加 `blocks?: ChatBlock[];` 字段到 ConversationResult interface。

#### Step 2: 新增 mapConfigToParamCard 辅助函数
**文件：** `src/agent/conversation-helpers.ts`（末尾）

```typescript
export function mapConfigToParamCard(
  config: GameConfig,
  category?: string,
): ChatBlock {
  const fields: ParamCardField[] = [];
  
  // Duration slider from Timer module
  const timer = config.modules.find((m) => m.type === 'Timer');
  if (timer && typeof timer.params?.duration === 'number') {
    fields.push({
      kind: 'slider',
      label: '时长',
      moduleType: 'Timer',
      paramKey: 'duration',
      value: timer.params.duration,
      min: 10, max: 120, step: 5, unit: '秒',
    });
  }
  
  // Spawner interval
  const spawner = config.modules.find((m) => m.type === 'Spawner');
  if (spawner && typeof spawner.params?.spawnInterval === 'number') {
    fields.push({
      kind: 'slider',
      label: '生成间隔',
      moduleType: 'Spawner',
      paramKey: 'spawnInterval',
      value: spawner.params.spawnInterval,
      min: 200, max: 3000, step: 100, unit: 'ms',
    });
  }
  
  // PlayerMovement speed
  const pm = config.modules.find((m) => m.type === 'PlayerMovement');
  if (pm && typeof pm.params?.speed === 'number') {
    fields.push({
      kind: 'slider',
      label: '玩家速度',
      moduleType: 'PlayerMovement',
      paramKey: 'speed',
      value: pm.params.speed,
      min: 100, max: 1500, step: 50,
    });
  }
  
  // Asset fields for common placeholders
  const assets = config.assets ?? {};
  for (const key of ['player', 'good_1', 'background']) {
    if (key in assets) {
      fields.push({
        kind: 'asset',
        label: key,
        assetKey: key,
        thumbnail: assets[key]?.src ?? '',
        accept: ['image/*'],
      });
    }
  }
  
  return {
    kind: 'param-card',
    title: category ? `${category} 参数` : '游戏参数',
    fields,
  };
}
```

注意：检查 ParamCardField 类型的实际定义（可能字段名不同），按实际类型调整。

#### Step 3: 在 ConversationAgent 中生成 blocks
**文件：** `src/agent/conversation-agent.ts`

1. Import 区添加 `mapConfigToParamCard`（line 22-33）
2. 在 `let createdThisTurn = false;` 附近添加 `let blocks: ChatBlock[] | undefined;`（line 134）
3. create_game case 末尾（line 176 附近，在 `break;` 前）：`blocks = [mapConfigToParamCard(config, input.game_type)];`
4. modify_game case 末尾（line 244 附近）：
   ```typescript
   if (config) {
     blocks = [mapConfigToParamCard(config, this.inferGameType(config))];
   }
   ```
5. process() return 语句（line 337）添加 `blocks`：
   ```typescript
   return { reply, config, chips, needsMoreInfo, parameterCard, expertInsight, moduleTuning, presetUsed, blocks };
   ```

#### Step 4: UI 层 plumbing
**文件：** `src/app/hooks/use-conversation-manager.ts:126-134`
在 `assistantMsg` 对象中添加：
```typescript
...(result.blocks ? { blocks: result.blocks } : {}),
```

**文件：** `src/ui/landing/landing-page.tsx:79-85`
同样在 `assistantMsg` 对象中添加 `result.blocks`。

#### Step 5: 测试
新建 `src/agent/__tests__/map-config-to-param-card.test.ts`:
- 输入：模拟 GameConfig with Timer/Spawner/PlayerMovement
- 断言：返回的 ChatBlock 包含对应 slider fields
- 断言：asset fields 正确映射

### 关键文件
| 文件 | 操作 | 说明 |
|------|------|------|
| src/agent/conversation-defs.ts | 修改 | ConversationResult 添加 blocks 字段 |
| src/agent/conversation-helpers.ts | 修改 | 新增 mapConfigToParamCard |
| src/agent/conversation-agent.ts | 修改 | 生成并返回 blocks |
| src/app/hooks/use-conversation-manager.ts | 修改 | 传递 blocks 到 ChatMessage |
| src/ui/landing/landing-page.tsx | 修改 | 传递 blocks 到 ChatMessage |
| src/agent/__tests__/map-config-to-param-card.test.ts | 新建 | 单元测试 |

---

## 任务 4.1: Paste/Drop 支持（范围缩减）

### 任务类型
- [x] 前端（UI 层）

### 技术方案
为 LandingPage 和 StudioChatPanel 的 textarea 添加：
- `onPaste` 检测剪贴板图片 → 转 blob URL → addPendingAttachment
- `onDragOver` preventDefault + 高亮边框
- `onDrop` 读取 file → addPendingAttachment
- 过滤 `image/*` 和 `audio/*`，10MB 上限

### 实施步骤

#### Step 1: 提取共享 hook
**文件：** `src/app/hooks/use-chat-input-paste.ts`（新建）

```typescript
import { useState, useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { Attachment } from '@/store/editor-store';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function useChatInputPaste() {
  const [isDragging, setIsDragging] = useState(false);
  const addPendingAttachment = useEditorStore((s) => s.addPendingAttachment);

  const handleFile = useCallback((file: File) => {
    if (file.size > MAX_FILE_SIZE) return;
    if (!file.type.startsWith('image/') && !file.type.startsWith('audio/')) return;
    
    const type = file.type.startsWith('image/') ? 'image' : 'audio';
    const src = URL.createObjectURL(file);
    const attachment: Attachment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      src,
      from: 'user',
      name: file.name,
    };
    addPendingAttachment(attachment);
  }, [addPendingAttachment]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) handleFile(file);
      }
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      handleFile(file);
    }
  }, [handleFile]);

  return { isDragging, handlePaste, handleDragOver, handleDragLeave, handleDrop };
}
```

注意：检查 Attachment 类型的实际字段和 addPendingAttachment 的签名。

#### Step 2: 接入 LandingPage
**文件：** `src/ui/landing/landing-page.tsx:225-235`

在 textarea wrapper div 上添加 drag 事件，在 textarea 上添加 onPaste：
```typescript
const paste = useChatInputPaste();
// ...
<div 
  className={`... ${paste.isDragging ? 'ring-1 ring-blue-500/40 border-blue-500/40' : ''}`}
  onDragOver={paste.handleDragOver}
  onDragLeave={paste.handleDragLeave}
  onDrop={paste.handleDrop}
>
  <textarea
    onPaste={paste.handlePaste}
    // ... 其他 props
  />
</div>
```

#### Step 3: 接入 StudioChatPanel
**文件：** `src/ui/chat/studio-chat-panel.tsx:128-146`
同样模式接入。

#### Step 4: 测试
新建 `src/app/hooks/__tests__/use-chat-input-paste.test.ts`:
- Mock DataTransfer + File
- 测试 handlePaste 提取图片
- 测试 handleDrop 处理 files
- 测试大小和类型过滤

### 关键文件
| 文件 | 操作 | 说明 |
|------|------|------|
| src/app/hooks/use-chat-input-paste.ts | 新建 | 共享 paste/drop hook |
| src/ui/landing/landing-page.tsx | 修改 | 接入 hook |
| src/ui/chat/studio-chat-panel.tsx | 修改 | 接入 hook |
| src/app/hooks/__tests__/use-chat-input-paste.test.ts | 新建 | hook 测试 |

---

### 验证
- `npx vitest run`
- `npm run build`

### SESSION_ID（供 /ccg:execute 使用）
- CODEX_SESSION: 019d6b78-47d6-74b2-a560-77617ba2a329
- GEMINI_SESSION: N/A
