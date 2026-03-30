/** @entry Enemy AI system - perception, state machine, A* pathfinding */

import type { Entity } from '../types';
import type { TileMap } from './tileMap';

/** AI states */
const enum AIState {
  IDLE,
  WANDER,
  CHASE,
  ATTACK,
}

const PERCEPTION_RANGE = 5;
const ATTACK_RANGE = 1.2;
const WANDER_INTERVAL = 2; // seconds
const PATH_CACHE_INTERVAL = 0.5; // seconds
const ENEMY_MOVE_SPEED = 1.5; // world units per second
const ARRIVAL_THRESHOLD = 0.1;

interface AIData {
  state: AIState;
  wanderTimer: number;
  pathCacheTimer: number;
  attackTimer: number;
  path: { x: number; y: number }[];
  pathIndex: number;
}

const aiDataMap = new Map<string, AIData>();

function getAI(enemy: Entity): AIData {
  let data = aiDataMap.get(enemy.id);
  if (!data) {
    data = { state: AIState.IDLE, wanderTimer: 0, pathCacheTimer: 0, attackTimer: 0, path: [], pathIndex: 0 };
    aiDataMap.set(enemy.id, data);
  }
  return data;
}

/** Manhattan distance in world coords */
function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

// --- A* pathfinding ---

interface AStarNode {
  x: number;
  y: number;
  g: number;
  f: number;
  parent: AStarNode | null;
}

const DIRS = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

function astar(
  startX: number, startY: number,
  goalX: number, goalY: number,
  tileMap: TileMap,
): { x: number; y: number }[] {
  const sx = Math.round(startX);
  const sy = Math.round(startY);
  const gx = Math.round(goalX);
  const gy = Math.round(goalY);

  if (sx === gx && sy === gy) return [];
  if (!tileMap.isWalkable(gx, gy)) return [];

  const w = tileMap.getWidth();
  const key = (x: number, y: number) => y * w + x;

  const open: AStarNode[] = [];
  const closed = new Set<number>();
  const gScores = new Map<number, number>();

  const h = (x: number, y: number) => Math.abs(x - gx) + Math.abs(y - gy);

  const startNode: AStarNode = { x: sx, y: sy, g: 0, f: h(sx, sy), parent: null };
  open.push(startNode);
  gScores.set(key(sx, sy), 0);

  let iterations = 0;
  const maxIterations = 500;

  while (open.length > 0 && iterations < maxIterations) {
    iterations++;

    // Find node with lowest f (simple linear scan - fine for small grids)
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open[bestIdx];
    open.splice(bestIdx, 1);

    if (current.x === gx && current.y === gy) {
      // Reconstruct path (skip start position)
      const path: { x: number; y: number }[] = [];
      let node: AStarNode | null = current;
      while (node && !(node.x === sx && node.y === sy)) {
        path.push({ x: node.x, y: node.y });
        node = node.parent;
      }
      path.reverse();
      return path;
    }

    const ck = key(current.x, current.y);
    closed.add(ck);

    for (const dir of DIRS) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      const nk = key(nx, ny);

      if (closed.has(nk)) continue;
      if (!tileMap.isWalkable(nx, ny)) continue;

      const ng = current.g + 1;
      const existing = gScores.get(nk);

      if (existing !== undefined && ng >= existing) continue;

      gScores.set(nk, ng);
      const neighbor: AStarNode = { x: nx, y: ny, g: ng, f: ng + h(nx, ny), parent: current };

      // Remove existing open node if any (will be re-added with better score)
      const existingIdx = open.findIndex((n) => n.x === nx && n.y === ny);
      if (existingIdx !== -1) open.splice(existingIdx, 1);

      open.push(neighbor);
    }
  }

  return []; // No path found
}

// --- State transitions ---

function decideState(enemy: Entity, player: Entity, ai: AIData): AIState {
  const dist = manhattan(enemy.worldX, enemy.worldY, player.worldX, player.worldY);

  if (dist <= ATTACK_RANGE) return AIState.ATTACK;
  if (dist <= PERCEPTION_RANGE) return AIState.CHASE;
  if (ai.state === AIState.CHASE) return AIState.WANDER; // lost sight, wander a bit
  if (ai.state === AIState.IDLE && ai.wanderTimer <= 0) return AIState.WANDER;
  return ai.state;
}

// --- Behaviors ---

function doWander(enemy: Entity, ai: AIData, tileMap: TileMap, dt: number): void {
  ai.wanderTimer -= dt;

  // If we have a path target, move toward it
  if (ai.path.length > 0 && ai.pathIndex < ai.path.length) {
    moveAlongPath(enemy, ai, dt);
    if (ai.pathIndex >= ai.path.length) {
      ai.path = [];
      ai.pathIndex = 0;
      ai.wanderTimer = WANDER_INTERVAL;
      ai.state = AIState.IDLE;
    }
    return;
  }

  if (ai.wanderTimer > 0) {
    ai.state = AIState.IDLE;
    return;
  }

  // Pick a random adjacent walkable cell
  const ex = Math.round(enemy.worldX);
  const ey = Math.round(enemy.worldY);
  const candidates: { x: number; y: number }[] = [];

  for (const dir of DIRS) {
    const nx = ex + dir.x;
    const ny = ey + dir.y;
    if (tileMap.isWalkable(nx, ny)) {
      candidates.push({ x: nx, y: ny });
    }
  }

  if (candidates.length > 0) {
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    ai.path = [target];
    ai.pathIndex = 0;
  } else {
    ai.wanderTimer = WANDER_INTERVAL;
    ai.state = AIState.IDLE;
  }
}

function doChase(enemy: Entity, player: Entity, ai: AIData, tileMap: TileMap, dt: number): void {
  ai.pathCacheTimer -= dt;

  if (ai.pathCacheTimer <= 0 || ai.path.length === 0) {
    ai.path = astar(enemy.worldX, enemy.worldY, player.worldX, player.worldY, tileMap);
    ai.pathIndex = 0;
    ai.pathCacheTimer = PATH_CACHE_INTERVAL;
  }

  if (ai.path.length > 0) {
    moveAlongPath(enemy, ai, dt);
  }
}

/** Callback for attack events - set externally by combat system */
let onAttackCallback: ((enemyId: string, playerId: string) => void) | null = null;

export function setOnAttack(cb: (enemyId: string, playerId: string) => void): void {
  onAttackCallback = cb;
}

/** Remove AI data for a dead enemy to prevent memory leak */
export function removeAIData(enemyId: string): void {
  aiDataMap.delete(enemyId);
}

/** Clear all AI state — call on scene restart to prevent memory leak */
export function clearAllAIData(): void {
  aiDataMap.clear();
  onAttackCallback = null;
}

const ATTACK_CALLBACK_INTERVAL = 0.5; // seconds between attack callbacks

function doAttack(enemy: Entity, player: Entity, ai: AIData, dt: number): void {
  ai.attackTimer -= dt;
  // Throttle attack callbacks to avoid per-frame overhead
  if (ai.attackTimer > 0) return;
  ai.attackTimer = ATTACK_CALLBACK_INTERVAL;
  if (onAttackCallback) {
    onAttackCallback(enemy.id, player.id);
  }
}

// --- Movement helper ---

function moveAlongPath(enemy: Entity, ai: AIData, dt: number): void {
  if (ai.pathIndex >= ai.path.length) return;

  const target = ai.path[ai.pathIndex];
  const dx = target.x - enemy.worldX;
  const dy = target.y - enemy.worldY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < ARRIVAL_THRESHOLD) {
    enemy.worldX = target.x;
    enemy.worldY = target.y;
    ai.pathIndex++;
    return;
  }

  const step = Math.min(ENEMY_MOVE_SPEED * dt, dist);
  enemy.worldX += (dx / dist) * step;
  enemy.worldY += (dy / dist) * step;
}

// --- Main update function ---

/**
 * Update all enemy AI each frame.
 * All coordinates in world space; rendering handled by EntityRenderer.
 */
export function updateEnemyAI(
  enemies: Entity[],
  player: Entity,
  tileMap: TileMap,
  dt: number,
): void {
  for (const enemy of enemies) {
    const ai = getAI(enemy);
    ai.state = decideState(enemy, player, ai);

    switch (ai.state) {
      case AIState.IDLE:
        ai.wanderTimer -= dt;
        break;
      case AIState.WANDER:
        doWander(enemy, ai, tileMap, dt);
        break;
      case AIState.CHASE:
        doChase(enemy, player, ai, tileMap, dt);
        break;
      case AIState.ATTACK:
        doAttack(enemy, player, ai, dt);
        break;
    }
  }
}
