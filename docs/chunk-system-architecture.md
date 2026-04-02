# Dark Isle 区块系统架构设计

## 1. Chunk 数据结构

### 核心定义
- **Chunk 尺寸**: 16x16 格（可配置，默认 16）
- **存储格式**: 稀疏矩阵 + 哈希表键值对
- **坐标系统**: ChunkCoord(worldX / 16, worldY / 16)

```typescript
interface ChunkCoord {
  cx: number;  // chunk x
  cy: number;  // chunk y
}

interface ChunkData {
  coord: ChunkCoord;
  ground: TileData[16][16];
  obstacles: TileData[16][16];
  decorations: TileData[16][16];
  heightMap: number[16][16];
  biomeId: string;
  generated: boolean;
  lastAccess: number;
}
```

## 2. 动态加载/卸载策略

### 加载规则
- **视距**: 加载周围 3 chunk 半径（可配置）
- **卸载距离**: 5 chunk 半径外卸载
- **优先级**: 玩家所在 chunk > 相邻 chunk > 边缘 chunk

### 内存管理
- **最大缓存**: 64 个 chunk（约 16KB/chunk）
- **LRU 淘汰**: 按 lastAccess 时间淘汰
- **异步生成**: Web Worker 后台生成

## 3. 无限地图坐标系统

### 虚拟坐标
- 世界坐标: 任意整数范围 (-∞, +∞)
- Chunk 坐标: `cx = floor(wx / CHUNK_SIZE)`
- 局部坐标: `lx = wx % CHUNK_SIZE`

### 哈希映射
```typescript
class ChunkManager {
  private chunks: Map<string, ChunkData>; // key: "cx,cy"
  
  private coordKey(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }
}
```

## 4. 生物群系系统

### Biome 定义
```typescript
interface Biome {
  id: string;
  name: string;
  heightRange: [number, number];
  moistureRange: [number, number];
  terrainBands: TerrainBand[];
  decorationPool: DecorationRule[];
  color: number;
}

interface DecorationRule {
  type: number;
  density: number;      // 0-1
  minHeight: number;
  maxHeight: number;
}
```

### 内置生物群系
- **Grassland**: 0.35-0.55 高度，草地
- **Forest**: 0.45-0.65 高度，高树木密度
- **Desert**: 0.20-0.35 高度，低水分
- **Mountains**: 0.70+ 高度，岩石地形
- **Swamp**: 高水分，低高度，水生植物

## 5. 河流生成算法

### 实现方案: Perlin 噪声导数
```typescript
function generateRiver(perm: number[], seed: number): RiverPath[] {
  // 1. 使用单一低频噪声等值线 (value ≈ 0.5)
  // 2. 跟踪等值线生成连续河道
  // 3. 使用导数方向场保证平滑转弯
}
```

### 参数
- **频率**: 0.02（长河道）
- **宽度**: 1-2 格
- **深度**: 决定水量瓦片类型

## 6. 与现有系统集成

### 兼容性适配
- **TileMap**: 扩展支持 chunk 级别渲染
- **WorldGenerator**: 重构为 Biome-based 生成器
- **Camera**: 动态 world bounds 更新

### 迁移步骤
1. 新增 ChunkManager 替代固定尺寸地图
2. 保持 TileMap API 兼容
3. 分阶段生成 + 异步加载
4. 添加进度回调支持

## 关键接口

```typescript
interface IChunkProvider {
  getChunk(cx: number, cy: number): Promise<ChunkData>;
  hasChunk(cx: number, cy: number): boolean;
}

interface IWorldGenerator {
  generateChunk(coord: ChunkCoord, seed: number): ChunkData;
  getBiomeAt(worldX: number, worldY: number): Biome;
}
```
