import { BASE_TICK, CELL, COLS, GOLD_EVERY, GRID_TOP, MIN_TICK, ROWS, START_LEN } from './constants';
import { sfx } from '../../engine/audio';

export type Mode = 'menu' | 'playing' | 'paused' | 'over';
export type Dir = 'up' | 'down' | 'left' | 'right';
export type FoodKind = 'apple' | 'gold';

export interface Cell {
  x: number;
  y: number;
}

export interface Food extends Cell {
  kind: FoodKind;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  life: number;
  max: number;
  gold: boolean;
}

const DIRS: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export class SnakeGame {
  mode: Mode = 'menu';
  score = 0;
  best = 0;
  speedLevel = 1;
  eaten = 0;
  combo = 0;
  comboTimer = 0;
  time = 0;

  body: Cell[] = [];
  prevBody: Cell[] = [];
  food: Food | null = null;
  dir: Dir = 'right';

  acc = 0;
  interval = BASE_TICK;

  particles: Particle[] = [];
  floats: FloatText[] = [];
  shake = 0;
  flash = 0;

  private queue: Dir[] = [];

  onHud?: () => void;
  onGameOver?: (reason: string, score: number, best: number) => void;
  onBanner?: (text: string) => void;

  constructor(best = 0) {
    this.best = best;
  }

  begin() {
    this.mode = 'playing';
    this.score = 0;
    this.speedLevel = 1;
    this.eaten = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.time = 0;
    this.acc = 0;
    this.interval = BASE_TICK;
    this.dir = 'right';
    this.queue = [];
    this.particles = [];
    this.floats = [];
    this.shake = 0;
    this.flash = 0;

    const cy = Math.floor(ROWS / 2);
    const headX = Math.floor(COLS / 2);
    this.body = Array.from({ length: START_LEN }, (_, i) => ({ x: headX - i, y: cy }));
    this.prevBody = this.body.map((c) => ({ ...c }));
    this.food = this.spawnFood();
    this.onHud?.();
  }

  pause() {
    if (this.mode === 'playing') this.mode = 'paused';
  }

  resume() {
    if (this.mode === 'paused') this.mode = 'playing';
  }

  turn(dir: Dir) {
    if (this.mode !== 'playing') return;
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
    if (dir === last || dir === OPPOSITE[last]) return;
    if (this.queue.length >= 2) return;
    this.queue.push(dir);
  }

  update(dt: number) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 50);
    this.flash = Math.max(0, this.flash - dt * 2.6);

    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 3;
      p.vy *= 1 - dt * 3;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const f of this.floats) {
      f.life -= dt;
      f.y -= dt * 34;
    }
    this.floats = this.floats.filter((f) => f.life > 0);

    if (this.mode !== 'playing') return;

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    this.acc += dt;
    while (this.mode === 'playing' && this.acc >= this.interval) {
      this.acc -= this.interval;
      this.step();
    }
  }

  private step() {
    const next = this.queue.shift() ?? this.dir;
    this.dir = next;

    const head = this.body[0];
    const nx = head.x + DIRS[next].x;
    const ny = head.y + DIRS[next].y;

    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
      this.die('撞上了围墙');
      return;
    }

    const eating = !!this.food && this.food.x === nx && this.food.y === ny;
    const checkLen = eating ? this.body.length : this.body.length - 1;
    for (let i = 0; i < checkLen; i++) {
      if (this.body[i].x === nx && this.body[i].y === ny) {
        this.die('咬到了自己');
        return;
      }
    }

    this.prevBody = this.body.map((c) => ({ ...c }));
    this.body.unshift({ x: nx, y: ny });

    if (!eating) {
      this.body.pop();
      return;
    }

    const food = this.food!;
    const gold = food.kind === 'gold';
    this.combo = Math.min(5, this.combo + 1);
    this.comboTimer = 2.4;

    const gain = (gold ? 50 : 10) * Math.max(1, this.combo);
    this.score += gain;
    this.eaten += 1;

    this.floats.push({
      x: nx,
      y: ny,
      text: `+${gain}`,
      life: 0.9,
      max: 0.9,
      gold,
    });
    this.burst(food.x, food.y, gold ? 26 : 14, gold ? '#ffd76a' : '#ff8f6b', gold ? 240 : 160);
    this.flash = Math.min(1, this.flash + (gold ? 0.35 : 0.1));

    const level = 1 + Math.floor(this.eaten / 5);
    this.interval = Math.max(MIN_TICK, BASE_TICK - (level - 1) * 0.012);

    this.food = this.spawnFood();
    if (gold) sfx.gold();
    else sfx.eat();

    if (level > this.speedLevel) {
      this.speedLevel = level;
      this.onBanner?.(`速度提升 · ${level} 级`);
    }
    this.onHud?.();
  }

  private spawnFood(): Food | null {
    const occupied = new Set(this.body.map((c) => `${c.x},${c.y}`));
    const free: Cell[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!occupied.has(`${x},${y}`)) free.push({ x, y });
      }
    }
    if (!free.length) {
      this.endGame('填满了整个棋盘');
      return null;
    }
    const pick = free[Math.floor(Math.random() * free.length)];
    const gold = this.eaten > 0 && this.eaten % GOLD_EVERY === 0;
    return { x: pick.x, y: pick.y, kind: gold ? 'gold' : 'apple' };
  }

  private die(reason: string) {
    if (this.mode !== 'playing') return;
    const head = this.body[0];
    this.shake = 16;
    this.flash = 1;
    this.burst(head.x, head.y, 28, '#ff8f6b', 220);
    sfx.die();
    this.endGame(reason);
  }

  private endGame(reason: string) {
    this.mode = 'over';
    this.best = Math.max(this.best, this.score);
    this.onGameOver?.(reason, this.score, this.best);
  }

  private burst(cx: number, cy: number, count: number, color: string, power: number) {
    const px = cx * CELL + CELL / 2;
    const py = cy * CELL + GRID_TOP + CELL / 2;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (0.3 + Math.random() * 0.7) * power;
      this.particles.push({
        x: px,
        y: py,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.3 + Math.random() * 0.4,
        max: 0.7,
        size: 1.6 + Math.random() * 2.8,
        color,
      });
    }
    if (this.particles.length > 200) {
      this.particles.splice(0, this.particles.length - 200);
    }
  }
}
