# AIGE Studio 设计文档

> 模块化社交平台游戏生成工具
> 日期：2026-03-22

---

## 1. 项目概述

### 1.1 背景

TikTok 当前的 AIGE 平台通过 Agent 系统生成社交平台游戏，但存在三大问题：效果差、不稳定、无法二次编辑。AIGE Studio 通过预制模块化架构解决这些问题——所有功能组件（碰撞、计分、生成器等）提前写好，Agent 只负责选模块、配参数、组装输出，用户可随时修改。

### 1.2 核心理念

- **LLM 永远不直接写游戏代码**，只输出结构化配方（JSON Config）
- **确定性引擎**根据 Config 动态实例化预制模块
- **可插拔、可编辑**：所有功能模块热插拔，所有参数对用户透明
- 类比 Unreal Engine：预制组件 + 蓝图组装 + 属性面板调参

### 1.3 目标范围

- 14 种社交平台游戏类型全量覆盖
- 19+ 核心模块（6 输入 + 8 机制 + 5 反馈 + 扩展模块）
- 内置实时预览 + 真实摄像头（面部/手势追踪）
- 双导出：Web（可分享链接）+ .apjs（Effect House）

### 1.4 用户画像

完全非技术用户。零代码操作：自然语言对话 + 可视化拖拽/滑块调参 + 素材替换。

### 1.5 团队

1 人 + AI 辅助，无硬性 deadline，质量优先。

---

## 2. 技术架构

### 2.1 架构方案：全运行时组装

模块是运行时的 TS class，由 Runtime Engine 根据 JSON Config 动态实例化。预览时直接运行模块实例（不做代码生成），导出时才做序列化。

```
┌──────────────────────────────────────────────────────────────┐
│                        AIGE Studio                           │
│                                                              │
│  ┌──────────┐  ┌───────────────┐  ┌───────────────────────┐ │
│  │ Chat     │  │ Visual Editor │  │   Preview Canvas      │ │
│  │ Panel    │  │               │  │                       │ │
│  │          │  │ ┌───────────┐ │  │  ┌─────────────────┐  │ │
│  │ 自然语言  │  │ │Module List│ │  │  │   PixiJS Stage  │  │ │
│  │ 对话     │  │ ├───────────┤ │  │  │                 │  │ │
│  │          │  │ │Properties │ │  │  │  Game Running   │  │ │
│  │ AI 建议  │  │ │Panel      │ │  │  │  + Camera Feed  │  │ │
│  │          │  │ ├───────────┤ │  │  │                 │  │ │
│  └────┬─────┘  │ │Asset      │ │  │  └─────────────────┘  │ │
│       │        │ │Library    │ │  │                       │ │
│       │        └──────┬──────┘  └───────────┬───────────┘ │
│       │               │                      │              │
│  ═════╪═══════════════╪══════════════════════╪══════════    │
│       │         Game Config (JSON)            │              │
│  ═════╪═══════════════╪══════════════════════╪══════════    │
│       │               │                      │              │
│  ┌────▼───────────────▼──────────────────────▼───────────┐ │
│  │                 Runtime Engine                         │ │
│  │  ModuleRegistry → ModuleFactory → ModuleOrchestrator  │ │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐               │ │
│  │  │ Input   │→│ Mechanic │→│ Feedback │               │ │
│  │  │ Modules │ │ Modules  │ │ Modules  │               │ │
│  │  └─────────┘ └──────────┘ └──────────┘               │ │
│  └───────────────────────────────────────────────────────┘ │
│                            │                                │
│  ┌─────────────────────────▼─────────────────────────────┐ │
│  │                    Exporters                           │ │
│  │         WebExporter          ApjsExporter             │ │
│  └───────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 技术栈

| 层 | 技术选型 | 理由 |
|---|---|---|
| 前端框架 | React 18 + TypeScript | 生态最大，组件库丰富 |
| 构建工具 | Vite | 快，HMR 体验好 |
| 游戏渲染 | PixiJS 8 | 轻量 2D 引擎，性能好 |
| 摄像头追踪 | MediaPipe (Face/Hands/Pose) | Google 官方，浏览器端实时运行 |
| AI Agent | Claude API (claude-sonnet-4-20250514) | 结构化输出强 |
| AI 图片生成 | 预留接口，先接 DALL-E 3 或 Stability AI | 素材生成 |
| 状态管理 | Zustand | 轻量 |
| UI 组件库 | Radix UI + Tailwind CSS | 无样式基础组件 + 原子化 CSS |

### 2.3 项目目录结构

```
aige-studio/
├── src/
│   ├── app/                    # 应用入口、路由、全局布局
│   ├── ui/                     # UI 组件
│   │   ├── chat/               #   对话面板
│   │   ├── editor/             #   可视化编辑器（模块列表、属性面板）
│   │   ├── preview/            #   预览画布
│   │   ├── assets/             #   素材库浏览器
│   │   └── common/             #   通用 UI 组件
│   ├── engine/                 # 游戏运行时引擎（核心）
│   │   ├── core/               #   Engine, ModuleRegistry, Orchestrator
│   │   ├── modules/            #   所有预制模块
│   │   │   ├── input/          #     FaceInput, HandInput, BodyInput...
│   │   │   ├── mechanic/       #     Spawner, Collision, Scorer...
│   │   │   └── feedback/       #     ParticleVFX, SoundFX, UIOverlay...
│   │   ├── tracking/           #   MediaPipe 封装
│   │   └── renderer/           #   PixiJS 渲染层
│   ├── agent/                  # AI Agent 层
│   │   ├── intent-parser.ts    #   意图解析
│   │   ├── recipe-generator.ts #   配方生成
│   │   ├── recommender.ts      #   智能推荐
│   │   └── skill-loader.ts     #   Skill 按需加载器
│   ├── knowledge/              # Skill 化知识库
│   │   ├── game-types/         #   14 种游戏类型 skills
│   │   ├── modules/            #   19+ 模块 skills
│   │   │   ├── input/
│   │   │   ├── mechanic/
│   │   │   └── feedback/
│   │   ├── relations/          #   模块间关系 skills
│   │   └── index.md            #   索引
│   ├── config/                 # Game Config Schema 定义
│   │   └── schema.ts
│   ├── exporters/              # 导出器
│   │   ├── web-exporter.ts     #   导出为 HTML
│   │   └── apjs-exporter.ts    #   导出为 .apjs
│   ├── assets/                 # 预制素材库
│   │   ├── sprites/
│   │   ├── sounds/
│   │   └── themes/
│   └── store/                  # Zustand 状态管理
├── public/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.ts
```

---

## 3. Game Config Schema

JSON Config 是整个系统的脊柱——Agent 输出它、编辑器读写它、引擎消费它、导出器翻译它。

### 3.1 Config 结构

```jsonc
{
  "version": "1.0",
  "meta": {
    "name": "游戏名称",
    "description": "描述",
    "thumbnail": null,
    "createdAt": "ISO时间"
  },
  "canvas": {
    "width": 1080,
    "height": 1920,
    "background": "asset_id"
  },
  "modules": [
    {
      "id": "唯一ID",
      "type": "模块类型",
      "enabled": true,
      "params": { /* 模块参数 */ }
    }
  ],
  "assets": {
    "asset_id": {
      "type": "sprite|sound|background|particle",
      "src": "prebuilt://path | ai-generated://uuid | user://path"
    }
  }
}
```

### 3.2 设计原则

- **模块独立**：每个模块只关心自己的 params，不直接引用其他模块内部状态
- **事件驱动连接**：模块之间通过事件名（hit、damage、finish）松耦合连接
- **素材引用分离**：modules 里只用素材 ID，实际路径在 assets 表统一管理
- **三种素材源**：prebuilt://（预制）、ai-generated://（AI 生成）、user://（用户上传）
- **enabled 开关**：每个模块可一键禁用而不删除
- **模块间引用**：通过 ID 引用（如 DifficultyRamp.target: "spawner_enemy"）

### 3.3 编辑操作 → Config 变化映射

| 用户操作 | Config 变化 |
|---|---|
| "把外星人换成僵尸" | assets 表中素材 src 更新 |
| "加一条命" | modules[lives].params.count 改值 |
| "去掉难度递增" | modules[difficulty].enabled: false |
| "加个跳跃功能" | 插入新模块 { type: "Jump", params: {...} } |
| "倒计时改成60秒" | modules[timer].params.duration 改值 |

---

## 4. 模块系统设计

### 4.1 模块统一接口

```typescript
interface GameModule {
  id: string;
  type: string;
  init(engine: Engine): void;
  update(dt: number): void;
  destroy(): void;
  getSchema(): ModuleSchema;     // 声明可配置参数
  configure(params: object): void;
  onAttach(engine: Engine): void;
  onDetach(engine: Engine): void;
}
```

### 4.2 参数 Schema → UI 自动渲染

每个模块通过 getSchema() 声明可调参数，UI 自动渲染对应控件：

| Schema type | UI 控件 | 示例 |
|---|---|---|
| range | 滑块 + 数字 | 跳跃高度 ████░░ 200px |
| number | 数字步进器 | 最大连跳 [- 1 +] |
| boolean | 开关 | 跳跃时无敌 🔘 关 |
| select | 下拉菜单 | 触发方式 ▼ 双击屏幕 |
| asset | 素材选择器 | 跳跃音效 🔊 [更换] |
| color | 取色器 | 拖尾颜色 |
| rect | 可视化区域拖拽 | 预览画布上拖拽矩形 |
| enum[] | 多选标签 | [✓ 左右] [✓ 上下] |

原则：每个模块的每个可调参数都必须在 getSchema() 中声明。没有声明 = 用户看不到 = 不可调。

### 4.3 完整模块清单

**输入层（Input）— 6 个模块：**

| 模块 | 功能 | 关键参数 |
|---|---|---|
| FaceInput | 头部 XY、旋转、张嘴、眨眼、笑、挑眉、撅嘴 | tracking, smoothing, outputTo |
| HandInput | 手掌位置、手势识别（剪刀石头布/点赞/OK） | gesture, confidence, outputTo |
| BodyInput | 身体骨骼、体态匹配、舞蹈动作检测 | skeleton, matchPose, tolerance |
| TouchInput | 点击、滑动、长按、多点触控 | gesture, action, area |
| DeviceInput | 陀螺仪倾斜、加速度计摇晃 | sensor, sensitivity, deadzone |
| AudioInput | 音量、吹气检测、音频频率分析 | mode, threshold, frequency |

**机制层（Mechanic）— 8+ 个模块：**

| 模块 | 功能 | 关键参数 |
|---|---|---|
| Spawner | 按规则生成物体 | items, speed, frequency, spawnArea, direction, maxCount |
| Collision | 碰撞检测 | layers, rules(a×b=event), shapes |
| Scorer | 计分系统 | perHit, combo, deductOnMiss |
| Timer | 倒计时/计时器 | mode, duration, onEnd |
| Lives | 生命值/心 | count, events, onZero |
| DifficultyRamp | 难度递增 | target, rules(every/field/increase) |
| Randomizer | 随机选择/转盘/抽卡 | items, weights, animation, stopLogic |
| QuizEngine | 题目流程 | questions, timePerQuestion, scoring |

**反馈层（Feedback）— 5 个模块：**

| 模块 | 功能 | 关键参数 |
|---|---|---|
| ParticleVFX | 粒子特效 | events → effects 映射 |
| SoundFX | 音效 | events → sounds 映射 |
| UIOverlay | 分数/计时器/生命值 HUD | elements, positions, styles |
| GameFlow | 状态机：开始→倒计时→游戏→结算→重玩 | states, countdown, onFinish |
| ResultScreen | 结算+分享画面 | show, rating, actions |

**扩展模块（P1-P3）：**

| 模块 | 用于 | 优先级 |
|---|---|---|
| ExpressionDetector | 表情/挑战 | P1 |
| ComboSystem | 连击增强 | P1 |
| Jump | 跳跃 | P1 |
| PowerUp | 道具系统 | P1 |
| BeatMap | 节奏/音乐 | P2 |
| GestureMatch | 手势/身体匹配 | P2 |
| MatchEngine | 拼图/记忆配对 | P2 |
| Runner | 跑酷移动（多跑道） | P2 |
| PlaneDetection | 世界 AR | P3 |
| BranchStateMachine | 叙事/选择分支 | P3 |
| DressUpEngine | 换装/自定义 | P3 |

---

## 5. 事件总线 & 模块间通信

### 5.1 事件总线

所有模块之间零直接引用，全部通过 EventBus 通信。

```typescript
class EventBus {
  emit(event: string, data?: any): void;
  on(event: string, handler: EventHandler): void;
  off(event: string, handler: EventHandler): void;
}
```

### 5.2 事件命名规范

```
{模块类型}:{动作}            → 标准事件
{模块类型}:{动作}:{细节}     → 细分事件

spawner:created              collision:hit
collision:hit:bullet×enemy   scorer:combo:3
lives:zero                   timer:end
gameflow:state               input:face:move
```

### 5.3 自动连线（Auto-Wiring）

用户添加模块后，引擎根据 Skill 中定义的连线规则自动连接。

核心连线规则：
- Spawner + Collision → 生成物体自动注册碰撞层
- Collision + Scorer → hit 事件自动触发计分
- Collision + Lives → damage 事件自动扣血
- Timer + GameFlow → 计时结束触发结算
- Lives + GameFlow → 生命归零触发结算
- DifficultyRamp + Spawner → 定时调整生成参数

### 5.4 热插拔流程

添加模块：实例化 → 注册到引擎 → 自动连线 → 更新 UI + Config
移除模块：断开连线 → 销毁模块 → 更新 UI + Config（enabled: false）

---

## 6. Agent 工作流

### 6.1 分层架构

```
用户自然语言 → Step 0: Skill Router（本地）
             → Step 1: Intent Parser（Claude API）
             → Step 2: Recipe Generator（Claude API + Skills）
             → Step 3: Recommender（Claude API + Skills）
             → Step 4: Apply & Preview（本地引擎）
```

### 6.2 Skill 化知识库

Agent 的知识库拆分为独立 Skill 文件，按需加载而非全部塞入 prompt。

```
knowledge/
├── game-types/          # 14 种游戏类型 skills
├── modules/             # 19+ 模块 skills（input/mechanic/feedback）
├── relations/           # 模块间关系（连线/冲突/协同）
└── index.md             # 索引
```

每个模块 Skill 标准化包含：基本信息、功能原理、完整参数表、事件通信（发出/监听）、与其他模块连接方式、适用游戏类型、常见问题 & 边界情况。

每个游戏类型 Skill 标准化包含：游戏定义、核心体验、必需模块+推荐配置、推荐增强模块+建议话术、模块连线图、素材需求、跨平台兼容性。

### 6.3 按需加载策略

| 操作 | 加载的 Skills |
|---|---|
| 创建新游戏 | 游戏类型 skill + 必需模块 skills + module-wiring |
| 添加模块 | 该模块 skill + module-synergies |
| 修改参数 | 该模块 skill（查参数范围） |
| 推荐 | module-synergies + module-conflicts |

### 6.4 意图解析

使用 Claude API Tool Use 保证结构化输出。可识别意图：create_game、add_module、remove_module、modify_param、replace_asset、general_question。

### 6.5 本地快捷处理

简单参数调整（"调高"/"调低"/"改成X"/"开启"/"关闭"）通过本地正则匹配直接修改 Config，不调 Claude API，节省成本和响应时间。

### 6.6 API 调用成本控制

| 操作类型 | Claude 调用次数 |
|---|---|
| 创建新游戏 | 2-3 次 |
| 修改参数 | 0-1 次（简单改动本地处理） |
| 替换素材 | 0-1 次 |
| 添加/移除模块 | 1-2 次 |

---

## 7. 预览系统

### 7.1 三种预览模式

| 模式 | 说明 | 场景 |
|---|---|---|
| 编辑模式 | 游戏运行中可调参数，实时生效 | 制作过程中调试 |
| 试玩模式 | 隐藏编辑面板，完整游戏体验 | 快速验证手感 |
| 全屏试玩 | 浏览器全屏，和导出后完全一致 | 正式测试/演示 |

### 7.2 预览 = 真实运行

预览画布运行的是同一个 Engine + 同一套 Modules + 同一个 Config，不是模拟器。导出后的游戏与预览中的游戏代码完全一致。

### 7.3 分享试玩（不导出）

Config + 素材上传云端 → 生成分享链接 → 对方打开链接即可在手机/PC/Mac 试玩。

---

## 8. 导出器设计

### 8.1 Web 导出器

Config → 收集启用模块代码（tree-shaking）→ 收集素材 → 打包为独立 HTML 文件。

特点：单文件、零依赖（除 MediaPipe CDN）、手机浏览器直接打开、可部署到任何静态托管。

### 8.2 .apjs 导出器

Config → 每个模块翻译为 Effect House API 调用 → 生成主入口脚本 → 打包素材为 EH 资源格式 → 输出 .apjs 包。

每个模块类型有对应的翻译器（translateSpawner、translateCollision 等），将通用模块逻辑映射到 Effect House 的 API。

### 8.3 导出选项

- 画质：高清(1080×1920) / 标准(720×1280)
- 素材：内联(base64) / CDN
- 压缩：开启 / 关闭

---

## 9. 素材系统

### 9.1 三种素材来源

| 来源 | 前缀 | 说明 |
|---|---|---|
| 预制素材库 | prebuilt:// | 提前准备好的主题素材包 |
| AI 生成 | ai-generated:// | 用户描述需求，调用图片生成 API |
| 用户上传 | user:// | 用户自行上传 |

### 9.2 素材类型

sprite（贴图）、sound（音效）、background（背景）、particle（粒子配置）

---

## 10. 14 种游戏类型覆盖

基于调研报告的游戏类型 × 模块组合矩阵：

| # | 游戏类型 | 热度 | 必需模块 |
|---|---|---|---|
| 1 | 接物/收集 | 5/5 | FaceInput, Spawner, Collision, Scorer, Timer, Lives, DifficultyRamp |
| 2 | 躲避/闪避 | 4/5 | FaceInput, BodyInput, Spawner, Collision, Timer, Lives, DifficultyRamp |
| 3 | 问答/测验 | 5/5 | FaceInput, TouchInput, QuizEngine, Scorer, Timer |
| 4 | 随机/转盘 | 5/5 | FaceInput, TouchInput, Randomizer |
| 5 | 点击/连点 | 4/5 | TouchInput, Scorer, Timer |
| 6 | 瞄准/射击 | 3/5 | FaceInput, HandInput, TouchInput, Spawner, Collision, Scorer, Timer |
| 7 | 表情/挑战 | 5/5 | FaceInput, ExpressionDetector, Scorer, Timer |
| 8 | 跑酷/避障 | 4/5 | FaceInput, TouchInput, Runner, Spawner, Collision, Scorer, Lives, DifficultyRamp |
| 9 | 拼图/记忆 | 3/5 | TouchInput, MatchEngine, Scorer, Timer |
| 10 | 节奏/音乐 | 3.5/5 | BodyInput, TouchInput, BeatMap, Scorer |
| 11 | 手势/身体 | 3.5/5 | HandInput, BodyInput, GestureMatch, Scorer |
| 12 | 世界 AR | 3/5 | TouchInput, PlaneDetection, Spawner, Collision |
| 13 | 换装/自定义 | 3/5 | FaceInput, TouchInput, DressUpEngine |
| 14 | 叙事/选择 | 2/5 | FaceInput, TouchInput, BranchStateMachine |

---

## 11. 实施优先级路线图

| 阶段 | 覆盖 | 游戏类型 | 新增模块 |
|---|---|---|---|
| P0 | 70% | 接物、躲避、跑酷、转盘、问答 | 6 输入 + 8 机制 + 5 反馈 = 19 核心模块 |
| P1 | 85% | 表情挑战、连点、射击 | ExpressionDetector, ComboSystem, Jump, PowerUp |
| P2 | 95% | 节奏、手势、拼图 | BeatMap, GestureMatch, MatchEngine, Runner |
| P3 | 100% | 世界 AR、叙事、换装 | PlaneDetection, BranchStateMachine, DressUpEngine |
