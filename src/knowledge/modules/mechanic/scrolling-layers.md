# ScrollingLayers — 视差滚动背景模块

## 基本信息
- 类型: mechanic
- 类名: `ScrollingLayers`
- 注册名: `ScrollingLayers`
- 文件: `src/engine/modules/mechanic/scrolling-layers.ts`
- 系统: `src/engine/systems/scrolling-layers/`

## 功能原理

ScrollingLayers 为游戏提供多层视差滚动背景。每层以不同速度滚动（远景慢、近景快），产生视觉深度感。

**工作流程：**
1. 通过 `layers` 参数配置多个背景层（textureId + ratio）
2. 每帧 `update(dt)` 计算各层偏移量：`delta = direction * baseSpeed * ratio * dt`
3. 发出 `scrolling:update` 事件，携带所有层的偏移状态
4. ParallaxRenderer 监听事件，使用 PixiJS TilingSprite 实现无缝重复滚动

## 完整参数表

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| axis | string | 'horizontal' | 滚动轴向：horizontal / vertical / both |
| baseSpeed | number | 200 | 基础滚动速度（px/s） |
| direction | number | -1 | 滚动方向：-1 或 1 |
| layers | object[] | [] | 背景层配置数组 |

### 层配置 (ParallaxLayerConfig)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| textureId | string | 是 | 资源键名（映射到 config.assets） |
| ratio | number | 是 | 深度比率（0-1，越小越远越慢） |
| spacing | number | 否 | 层间距（预留） |

### 推荐 3 层配比

| 层 | ratio | 视觉效果 |
|----|-------|----------|
| bg_far | 0.2 | 远景（云/山，移动最慢） |
| bg_mid | 0.5 | 中景（建筑/树木） |
| bg_near | 1.0 | 近景（地面/路面，与玩家同速） |

## 事件

| 事件 | 触发时机 | Payload |
|------|----------|---------|
| `scrolling:update` | 每帧偏移更新 | `{ layers: LayerState[] }` |
| `scrolling:set-speed` | 外部设置速度 | `{ speed: number }` |
| `scrolling:set-direction` | 外部设置方向 | `{ direction: number }` |

## AutoWirer 桥接

| 桥接 | 说明 |
|------|------|
| Runner + ScrollingLayers | runner:distance.speed 自动同步到 scrolling:set-speed |

## 渲染

ParallaxRenderer 使用 PixiJS TilingSprite：
- 每层创建一个 TilingSprite，宽高等于画布尺寸
- 通过 `tilePosition.set(offsetX, offsetY)` 实现无缝滚动
- 层级位于背景（bgSprite）和游戏层（cameraLayer）之间
- 无资源时使用程序化 fallback（条纹/渐变图案）

## 常见配置模式

### 跑酷 (Runner) — 水平滚动
```json
{
  "axis": "horizontal",
  "baseSpeed": 200,
  "direction": -1,
  "layers": [
    { "textureId": "bg_far", "ratio": 0.2 },
    { "textureId": "bg_mid", "ratio": 0.5 },
    { "textureId": "bg_near", "ratio": 1.0 }
  ]
}
```

### 游泳 (Swimmer) — 垂直滚动
```json
{
  "axis": "vertical",
  "baseSpeed": 150,
  "direction": -1,
  "layers": [
    { "textureId": "bg_deep", "ratio": 0.2 },
    { "textureId": "bg_water", "ratio": 0.5 },
    { "textureId": "bg_surface", "ratio": 0.9 }
  ]
}
```

## 最佳实践

- **层数**：2-3 层足够产生深度感，超过 5 层会增加渲染开销
- **ratio 范围**：0.1-1.0，间隔至少 0.2 以产生明显视差
- **baseSpeed**：跑酷 150-300，赛车 300-500，休闲 50-100
- **纹理**：使用水平/垂直可无缝拼接的贴图效果最佳
- **与 Runner 的关系**：通过 AutoWirer 桥接自动同步速度，无需手动配置
