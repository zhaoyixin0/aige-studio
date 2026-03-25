# Conversational UI Redesign

> **Date:** 2026-03-25
> **Goal:** Replace wizard/ModeB/GuidedCreator with a unified conversational game creation experience inspired by Google AI Studio

## Layout

### Initial State (no game)
- Full-screen centered: logo + input box + suggestion chips
- Clean, focused, minimal

### Game Created
- Two-panel: Chat (40%) | Preview (60%)
- Editor panel collapsed by default, expandable to 30% (three-panel)

## Dynamic Suggestion Chips

State machine with 3 phases:

1. **Empty input** → Game type shortcuts (接住, 射击, 答题, 跑酷, 转盘, 表情, 平台跳跃, etc.)
2. **Type selected / LLM asking** → Module recommendations (倒计时, 生命, 难度递增, 音效, 主题, 粒子, 连击)
3. **Game generated** → LLM-powered enhancement suggestions based on current config (换画风, 加速度, 换主题, 导出)

## ConversationAgent

Replaces Wizard, Mode B, and GuidedCreator with a single agent:

```ts
class ConversationAgent {
  async process(message: string, currentConfig: GameConfig | null): Promise<{
    reply: string;
    config?: GameConfig;
    chips?: Chip[];
    needsMoreInfo?: boolean;
  }>
}
```

### Conversation Rules
- Max 3 rounds of follow-up questions
- LLM infers what it can from the description, only asks about what's ambiguous
- Uses Claude API tool_use with 3 tools:
  - `create_game(type, theme, style, duration, modules[])`
  - `modify_game(changes[])`
  - `suggest_enhancements(config)`

### Flow Examples

**Enough info (1 round):**
```
User: "做一个太空射击游戏"
AI: "已创建太空射击游戏！🚀" + config + enhancement chips
```

**Needs clarification (2 rounds):**
```
User: "做一个游戏"
AI: "想做什么类型？" + type chips
User: clicks [接住游戏]
AI: "已创建接住游戏！" + config + enhancement chips
```

## Files Changed

| File | Change |
|------|--------|
| `src/ui/layout/main-layout.tsx` | Refactor: centered initial → two-panel after game created |
| `src/ui/chat/chat-panel.tsx` | Refactor: replace wizard logic with ConversationAgent |
| `src/ui/chat/suggestion-chips.tsx` | **New**: dynamic suggestion chips component |
| `src/agent/conversation-agent.ts` | **New**: unified conversation agent |
| `src/store/editor-store.ts` | Add: chips state, layout phase |
| Existing wizard.ts / agent.ts | Kept internally, not called by UI directly |
