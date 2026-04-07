# AIGE Studio — E2E 全功能测试方案

## 目标

覆盖 AIGE Studio **核心业务流程**，不是控件遍历。每个测试验证用户可见的结果是否正确。

## 环境要求

```bash
# 项目根目录：G:/claude code/AIGE_DEMO/aige-studio
cd aige-studio && npm install
npm run dev  # http://localhost:5173/

# E2E 测试目录
mkdir -p qa-e2e && cd qa-e2e
npm init -y
npm install @playwright/test
npx playwright install chromium
```

**API Key 说明：** 大部分测试无需 API key。需要 Claude API 的场景（ConversationAgent 多轮对话）标记为 `[需要API]`，无 key 时跳过。

## 测试结构

```
qa-e2e/
├── playwright.config.ts
├── tests/
│   ├── 01-landing.spec.ts          # P0
│   ├── 02-game-creation-no-api.spec.ts  # P0
│   ├── 03-preview-lifecycle.spec.ts     # P0
│   ├── 04-export.spec.ts               # P0
│   ├── 05-multi-gametype.spec.ts        # P0
│   ├── 06-expert-presets.spec.ts        # P1
│   ├── 07-module-editor.spec.ts         # P1
│   ├── 08-board-mode.spec.ts            # P1
│   ├── 09-share-link.spec.ts            # P1
│   ├── 10-asset-management.spec.ts      # P2
│   ├── 11-conversation-agent.spec.ts    # P2 [需要API]
│   └── 12-responsive.spec.ts           # P2
└── helpers/
    └── selectors.ts
```

---

## 公共选择器 (helpers/selectors.ts)

```typescript
// Landing
export const LANDING_INPUT = 'textarea[placeholder*="描述你想做的游戏"]';
export const LANDING_SEND = 'button:has(svg)';  // SendHorizontal icon button near input
export const SUGGESTION_CHIP = (label: string) => `button:has-text("${label}")`;
export const BROWSE_EXPERTS_BTN = 'button:has-text("浏览全部专家模板")';
export const FEATURED_CHIP = '[data-testid="featured-expert-chip"]';

// Studio
export const STUDIO_INPUT = 'textarea[placeholder*="输入修改建议"]';
export const STUDIO_SEND = 'button:has(svg)';  // SendHorizontal in studio panel

// Preview Toolbar
export const BTN_EDIT_MODE = 'button[title="Edit"], button:has(svg.lucide-pencil)';
export const BTN_PLAY_MODE = 'button[title="Play"], button:has(svg.lucide-play)';
export const BTN_FULLSCREEN = 'button[title="Fullscreen"], button:has(svg.lucide-maximize)';
export const BTN_EXPORT = 'button:has(svg.lucide-download)';

// Export Dialog
export const EXPORT_DIALOG = '[role="dialog"]';
export const BTN_DOWNLOAD_HTML = 'button:has-text("Download HTML")';
export const BTN_DOWNLOAD_APJS = 'button:has-text("Download .apjs")';
export const BTN_COPY_LINK = 'button:has-text("Copy Config Link")';

// Editor Panel
export const MODULE_ROW = (type: string) => `text="${type}"`;
export const MODULE_TOGGLE = 'button[role="switch"]';

// Expert Browser
export const EXPERT_BROWSER = '[data-testid="expert-browser"]';
export const EXPERT_SEARCH = '[data-testid="expert-search"]';
export const EXPERT_GAMETYPE_FILTER = '[data-testid="expert-gametype-filter"]';
export const EXPERT_CARD = '[data-testid="expert-preset-card"]';
export const EXPERT_RESET = '[data-testid="expert-reset-filters"]';

// Board Mode
export const BOARD_MODE_CONTAINER = '[data-testid="board-mode-container"]';

// Game Type Selector
export const GAME_TYPE_CARD = '[data-testid="game-type-card"]';
export const EXPERT_BADGE = '[data-testid="expert-badge"]';

// L3 Pills
export const L3_PILLS = '[data-testid="l3-pills-panel"]';

// Diagnostic Badge
export const DIAGNOSTIC_BADGE = 'button:has(svg.lucide-shield-check), button:has(svg.lucide-shield-alert)';

// Canvas
export const PREVIEW_CANVAS = 'canvas';
```

---

## P0: 核心路径（必须全部通过）

### 01 — Landing 页面基础

**文件:** `01-landing.spec.ts`

```
Test 1.1: 页面加载
  → 导航到 http://localhost:5173/
  → 断言: 输入框可见 (placeholder "描述你想做的游戏")
  → 断言: Suggestion chips 可见 (至少 5 个)
  → 断言: "浏览全部专家模板" 按钮可见
  → 断言: 无 console error

Test 1.2: Suggestion Chips 渲染
  → 等待 chips 动画完成 (~1.5s)
  → 断言: 至少出现以下 chips: "接住", "射击", "跑酷", "答题"
  → 断言: 每个 chip 有 emoji 图标
  → 点击任意 chip (如 "接住")
  → 断言: 页面进入 studio 布局 (chat 面板 + preview 面板可见)

Test 1.3: 手动输入创建
  → 在输入框输入 "做一个接东西的游戏"
  → 点击发送按钮 (或按 Enter)
  → 断言: 用户消息显示在聊天区
  → 等待响应 (最多 10s)
  → 断言: 页面进入 studio 布局
  → 断言: preview canvas 可见

Test 1.4: Featured Expert Chip
  → 刷新页面回到 landing
  → 如果 data-testid="featured-expert-chip" 存在:
    → 点击它
    → 断言: 进入 studio 布局
    → 断言: preview canvas 可见
```

### 02 — 无 API Key 游戏创建 (regex fallback)

**文件:** `02-game-creation-no-api.spec.ts`

**前置条件:** 不配置 VITE_ANTHROPIC_API_KEY（确保 regex fallback 路径）

```
Test 2.1: Chip 点击创建 catch 游戏
  → 点击 "接住" chip (或 "🎯" 开头的 chip)
  → 等待 studio 布局加载
  → 断言: preview canvas 出现
  → 断言: 右侧编辑面板有模块列表
  → 断言: 模块列表包含 "Spawner", "Collision", "Scorer" (catch 游戏核心模块)

Test 2.2: Chip 点击创建 shooting 游戏
  → 刷新 → 点击 "射击" chip
  → 断言: 模块列表包含 "Projectile", "EnemyAI", "WaveSpawner" (shooting 核心模块)

Test 2.3: Chip 点击创建 platformer 游戏
  → 刷新 → 点击 "平台跳跃" chip
  → 断言: 模块列表包含 "Gravity", "PlayerMovement", "StaticPlatform"

Test 2.4: 输入框 regex 创建
  → 刷新 → 输入 "接住水果的游戏" → 发送
  → 断言: 识别为 catch 类型
  → 断言: preview canvas 可见
  → 断言: 模块列表包含 catch 核心模块
```

### 03 — 游戏预览生命周期

**文件:** `03-preview-lifecycle.spec.ts`

**前置条件:** 先通过 chip 创建一个 catch 游戏进入 studio

```
Test 3.1: Edit → Play 切换
  → 点击 Play 模式按钮
  → 断言: canvas 可见
  → 断言: 出现开始画面 (等待 "click to start" 类文本或 start overlay)
  → 点击 canvas (开始游戏)
  → 等待 countdown 结束 (~4s: 3,2,1,GO!)
  → 断言: 游戏正在运行 (HUD 可见: timer 或 score 显示)

Test 3.2: 游戏结束 → 结果画面
  → 等待 timer 到期 (catch 默认 30s — 可通过修改 config 缩短)
  → 或: 用 page.evaluate 直接触发 engine.eventBus.emit('timer:end')
  → 断言: 出现结果画面 (score 显示, restart 提示)

Test 3.3: 重启游戏
  → 点击 canvas (restart)
  → 断言: 重新出现 countdown 或 start screen
  → 断言: 无 console error (检查碰撞重注册等问题)

Test 3.4: Play → Edit 切换
  → 点击 Edit 模式按钮
  → 断言: 回到编辑布局
  → 断言: 模块列表重新可见

Test 3.5: Fullscreen 模式
  → 点击 Fullscreen 按钮
  → 断言: document.fullscreenElement 不为 null (或检测 fullscreen class)
  → 按 ESC 退出
  → 断言: 回到 Edit 模式
```

### 04 — Export 功能

**文件:** `04-export.spec.ts`

**前置条件:** 先创建一个 catch 游戏进入 studio

```
Test 4.1: 打开 Export Dialog
  → 点击 Export 按钮 (Download icon in toolbar)
  → 断言: Dialog 可见，标题 "Export & Share"
  → 断言: 三个导出选项都可见 (HTML, .apjs, Share)

Test 4.2: 下载 Web HTML
  → 监听 download 事件
  → 点击 "Download HTML"
  → 断言: 下载触发
  → 断言: 文件扩展名 .html
  → 断言: 文件内容包含 "<html" 和 "canvas" (基础 HTML 结构)
  → 断言: 文件大小 > 1KB

Test 4.3: 下载 .apjs
  → 点击 "Download .apjs"
  → 断言: 下载触发
  → 断言: 文件扩展名 .apjs
  → 断言: 文件大小 > 1KB

Test 4.4: 复制分享链接
  → 点击 "Copy Config Link"
  → 断言: 按钮文本变为 "Copied!" (约 2s)
  → 读取 clipboard 内容
  → 断言: URL 包含 "#config="
  → 断言: Base64 部分可 decode 为合法 JSON
  → 断言: decoded JSON 包含 version, meta, canvas, modules 字段

Test 4.5: 关闭 Dialog
  → 点击关闭按钮 (X)
  → 断言: Dialog 不可见

Test 4.6: 无 console error
  → 整个 Export 流程中无 pageerror
  → 特别关注: btoa Unicode 问题 (Bug-001 回归检测)
```

### 05 — 多游戏类型冒烟

**文件:** `05-multi-gametype.spec.ts`

对以下 6 种核心游戏类型各做一次冒烟测试：

```
游戏类型列表: catch, shooting, platformer, runner, quiz, dodge

For each gameType:
  Test 5.X: {gameType} 冒烟
    → 刷新页面回到 landing
    → 点击对应 chip (或输入对应中文名)
    → 断言: 进入 studio 布局
    → 断言: preview canvas 可见
    → 断言: 模块列表至少有 3 个模块
    → 切换到 Play 模式
    → 断言: canvas 仍然可见
    → 无 console error
    → 切换回 Edit 模式
```

---

## P1: 重要功能

### 06 — Expert Presets

**文件:** `06-expert-presets.spec.ts`

```
Test 6.1: 打开 Expert Browser
  → 点击 "浏览全部专家模板" 按钮
  → 断言: Expert Browser modal 打开 (data-testid="expert-browser")
  → 断言: 至少显示 10 张 preset 卡片

Test 6.2: 搜索过滤
  → 在搜索框输入 "catch" 或 "接住"
  → 断言: 卡片数量减少 (filtered)
  → 清空搜索
  → 断言: 卡片恢复到全部

Test 6.3: 游戏类型过滤
  → 点击 game type filter dropdown
  → 选择 "shooting" 或 "射击"
  → 断言: 只显示 shooting 相关 preset
  → 点击 Reset 按钮
  → 断言: 过滤器重置

Test 6.4: 使用 Expert Preset
  → 点击任意 preset 卡片的 "Use Preset" 按钮
  → 断言: Expert Browser 关闭
  → 断言: 进入 studio 布局
  → 断言: preview canvas 可见
  → 断言: 模块列表有对应模块
```

### 07 — 模块编辑器

**文件:** `07-module-editor.spec.ts`

**前置条件:** 创建 catch 游戏进入 studio

```
Test 7.1: 模块列表显示
  → 断言: 右侧编辑面板可见
  → 断言: 模块列表包含至少 5 个模块
  → 断言: 每个模块有名称和开关

Test 7.2: 选择模块显示属性
  → 点击 "Spawner" 模块行
  → 断言: 属性面板显示 Spawner 的参数
  → 断言: 包含 "Frequency" 或类似标签的输入控件
  → 断言: 包含 "Speed" 相关控件

Test 7.3: 修改参数
  → 找到一个 range slider (如 Frequency)
  → 记录当前值
  → 拖动 slider 改变值
  → 断言: 值已改变 (不等于原值)
  → 无 console error

Test 7.4: 模块开关
  → 找到任意模块的 toggle switch
  → 点击 toggle (关闭模块)
  → 断言: toggle 状态改变
  → 再次点击 (重新开启)
  → 断言: toggle 恢复

Test 7.5: 编辑面板折叠/展开
  → 如果有折叠按钮:
    → 点击折叠
    → 断言: 编辑面板隐藏
    → 点击展开
    → 断言: 编辑面板恢复
```

### 08 — Board Mode

**文件:** `08-board-mode.spec.ts`

**前置条件:** 创建游戏进入 studio

```
Test 8.1: 打开 Board Mode
  → 通过 chip 或按钮打开 Board Mode
  → 断言: Board Mode 面板滑入 (data-testid="board-mode-container" 可见)
  → 断言: 显示参数分组 (至少一个 category heading)

Test 8.2: 参数分组
  → 断言: 参数按 category 分组显示
  → 断言: 每个分组有标题 (data-testid="category-heading")

Test 8.3: 调整参数
  → 找到一个 slider 参数
  → 拖动改变值
  → 断言: 值变化
  → 无 console error

Test 8.4: 关闭 Board Mode
  → 点击关闭按钮 (aria-label="关闭")
  → 断言: Board Mode 面板关闭
  → 断言: 底层 chat 面板可点击 (无 pointer-events 阻断)

Test 8.5: 关闭后底层可交互 (Bug 回归)
  → 关闭 Board Mode
  → 点击 chat 输入框
  → 断言: 输入框获得焦点 (不被 overlay 拦截)
```

### 09 — 分享链接

**文件:** `09-share-link.spec.ts`

```
Test 9.1: 生成分享链接
  → 创建 catch 游戏 → 打开 Export → 点击 Copy Config Link
  → 读取 clipboard URL
  → 断言: URL 格式正确 (#config=...)

Test 9.2: 加载分享链接
  → 取得上一步的 URL
  → 在新 tab/page 中导航到该 URL
  → 断言: 自动进入 studio 布局 (不是 landing)
  → 断言: preview canvas 可见
  → 断言: 模块列表与原始游戏一致

Test 9.3: 中文/Emoji 内容不丢失
  → 创建游戏时确保 meta.name 包含中文 (如默认名称)
  → 生成分享链接 → 在新页面加载
  → 断言: 游戏名称与原始一致 (中文字符保留)

Test 9.4: 无效链接处理
  → 导航到 /#config=InvalidBase64!!!
  → 断言: 不崩溃
  → 断言: 回到 landing 页面 (或显示错误提示)
```

---

## P2: 扩展功能

### 10 — Asset 管理

**文件:** `10-asset-management.spec.ts`

```
Test 10.1: Asset 上传
  → 创建游戏进入 studio
  → 打开 asset 上传区域
  → 上传一张测试 PNG (可通过 setInputFiles)
  → 断言: 上传成功
  → 断言: 资产出现在列表中

Test 10.2: Asset 删除
  → 上传资产后
  → 点击资产的删除按钮
  → 断言: 资产从列表中移除
```

### 11 — ConversationAgent 多轮对话 [需要API]

**文件:** `11-conversation-agent.spec.ts`

**前置条件:** VITE_ANTHROPIC_API_KEY 已配置

```
Test 11.1: 创建游戏
  → 输入 "做一个接水果的游戏，有3条命"
  → 等待 Agent 响应 (最多 30s)
  → 断言: preview canvas 可见
  → 断言: 模块列表包含 Lives 模块

Test 11.2: 修改游戏
  → 在 studio chat 输入 "把时间改成60秒"
  → 等待响应
  → 断言: Timer 模块的 duration 参数变为 60 (通过 page.evaluate 检查 store)

Test 11.3: 多轮对话历史保留
  → 继续输入 "加一个计分板"
  → 断言: 聊天面板显示 3 条用户消息 + 3 条 AI 响应
  → 断言: preview 仍然可用
```

### 12 — 响应式布局

**文件:** `12-responsive.spec.ts`

```
Test 12.1: 桌面宽度 (1920x1080)
  → 设置 viewport 1920x1080
  → 创建游戏
  → 断言: chat 面板和 preview 面板并排显示
  → 断言: 编辑面板可见

Test 12.2: 平板宽度 (768x1024)
  → 设置 viewport 768x1024
  → 创建游戏
  → 断言: 布局适应 (不溢出、不重叠)
  → 断言: 所有核心控件可访问

Test 12.3: 手机宽度 (375x812)
  → 设置 viewport 375x812
  → 创建游戏
  → 断言: 布局适应
  → 断言: 至少 preview 或 chat 可见
```

---

## Playwright 配置 (playwright.config.ts)

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'on',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: 'cd ../aige-studio && npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
```

---

## 执行优先级与预期

| 优先级 | 测试文件 | 测试数 | 预计耗时 | 依赖 |
|--------|---------|--------|---------|------|
| P0 | 01-05 | ~20 | 5-8 min | 无 API key |
| P1 | 06-09 | ~18 | 5-8 min | 无 API key |
| P2 | 10-12 | ~8 | 3-5 min | 11 需要 API key |

**总计:** ~46 个测试用例

## 验收标准

- P0 全部通过 = 核心路径正常
- P0+P1 全部通过 = 可发布
- P0+P1+P2 全部通过 = 完整覆盖

## 关键回归点 (已修复 bug 的回归检测)

| Bug | 回归测试 | 位于 |
|-----|---------|------|
| btoa Unicode crash | Test 4.4 | 04-export.spec.ts |
| React key collision | Test 3.1 (无 console error) | 03-preview-lifecycle.spec.ts |
| Fullscreen user gesture | Test 3.5 | 03-preview-lifecycle.spec.ts |
| Board mode overlay 拦截 | Test 8.5 | 08-board-mode.spec.ts |

## 注意事项

1. **截图策略:** 每个 test 结束时截图。失败时自动保存 trace (Playwright 内置)
2. **等待策略:** 用 `waitForSelector` 而非固定 sleep。AI 响应用 `waitForResponse` 或 `waitForSelector` + 长 timeout
3. **Console 监控:** 每个 test 都应检查无意外的 console.error 和 pageerror
4. **游戏 timer 问题:** catch 默认 30s timer，E2E 中用 `page.evaluate(() => window.__engine?.eventBus.emit('timer:end'))` 跳过等待
5. **状态隔离:** 每个 test file 刷新页面重新开始，避免 test 间状态泄漏
6. **canvas 交互:** PixiJS canvas 内的元素无法用 Playwright 选择器定位，用 canvas 坐标点击 (`page.click('canvas', { position: { x, y } })`)
