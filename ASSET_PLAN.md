# Tiny Swords 素材替换方案

## 素材来源
- 首选: https://pixelfrog-assets.itch.io/tiny-swords (免费，需手动下载)
- 备选: 自动生成像素风格 spritesheet

## 目录结构
```
public/assets/tiny-swords/
  terrain/
    grass.png          -- 地面草地瓦片 (isometric 128x64)
    water.png          -- 水面瓦片
    sand.png           -- 沙地瓦片
    dirt.png           -- 泥土瓦片
    stone.png          -- 石头地面瓦片
  buildings/
    house.png          -- 房屋装饰
    tower.png          -- 塔/城墙
  characters/
    warrior.png        -- 玩家角色 spritesheet (idle 4帧, walk 6帧, attack 4帧)
    skeleton.png       -- 敌人角色 spritesheet (同上)
  decorations/
    tree.png           -- 树障碍物
    rock.png           -- 岩石障碍物
    chest.png          -- 宝箱
    barrel.png         -- 木桶
```

## 需修改的文件

1. **src/assets/textureGenerator.ts** — 核心改动
   - 保留 generateAndSave 框架，将手绘 Canvas 逻辑替换为加载 spritesheet 切片
   - 或者: 完全移除手绘逻辑，改为在 BootScene 加载图片资源

2. **src/scenes/BootScene.ts** — 加载新素材
   - preload() 中添加 tiny-swords 素材的 spritesheet 加载
   - 更新 createCharacterAnimations() 的帧配置

3. **src/scenes/GameScene.ts** — 适配新素材
   - spawnPlayer/createEnemy 中调整 sprite scale 和 origin
   - 移除 tint 设置（新素材自带颜色）

4. **src/systems/isometric.ts** — 可能调整
   - TILE_WIDTH/TILE_HEIGHT 如果素材尺寸不同需要调整

## 当前状态
itch.io 需要手动下载，将生成像素风格占位素材。
