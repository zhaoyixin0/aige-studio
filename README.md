# AIGE Studio

模块化社交平台游戏创建工具 — 像搭积木一样，用 AI 引导创建 AR 小游戏。

## Features

- **15 种游戏类型** — 接住、躲避、点击、射击、答题、转盘、表情、跑酷、手势、节奏、拼图、换装、世界AR、叙事、平台跳跃
- **46 个预建模块** — 即插即用，无需编程（含 16 个平台跳跃模块）
- **5 套 Emoji 主题** — 水果、太空、海洋、万圣节、糖果
- **AI 素材生成** — Imagen 4 自动生成 + 背景移除
- **3 种交互模式** — 向导引导 / 快速描述 / 自由对话
- **实时预览** — PixiJS 渲染 + 粒子特效 + 音效合成
- **双格式导出** — Web HTML + Effect House .apjs

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Environment Variables (Optional)

```bash
# .env
VITE_ANTHROPIC_API_KEY=sk-ant-...   # For free-chat mode
VITE_GEMINI_API_KEY=AIza...          # For AI asset generation
```

The wizard works without any API keys.

## Tech Stack

React 19 · TypeScript · Vite · PixiJS 8 · Zustand · Tailwind CSS · Radix UI · Vitest

## Tests

```bash
npx vitest run   # 938+ tests
```

## License

Internal use — TikTok AIGE Team
