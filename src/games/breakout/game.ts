import {
  BALL_R,
  BALL_SPEED,
  BRICK_GAP,
  BRICK_H,
  BRICK_W,
  COLS,
  GRID_LEFT,
  GRID_TOP,
  HEIGHT,
  PADDLE_H,
  PADDLE_SPEED,
  PADDLE_W,
  PADDLE_Y,
  ROWS,
  START_LIVES,
  WIDTH,
} from './constants';

export type Mode = 'menu' | 'playing' | 'paused' | 'over';
export type CapsuleType = 'wide' | 'multi';

export interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  row: number;
  flash: number;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  stuck: boolean;
  trail: Array<{ x: number; y: number }>;
}

export interface Capsule {
  x: number;
  y: number;
  vy: number;
  type: CapsuleType;
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

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export class BreakoutGame {
  mode: Mode = 'menu';
  score = 0;
  best = 0;
  level = 1;
  lives = START_LIVES;
  combo = 0;
  comboTimer = 0;
  time = 0;

  paddle = { x: WIDTH / 2, y: PADDLE_Y, w: PADDLE_W, baseW: PADDLE_W, wide: 0 };
  balls: Ball[] = [];
  bricks: Brick[] = [];
  capsules: Capsule[] = [];
  particles: Particle[] = [];

  shake = 0;
  flash = 0;
  private ballSpeed = BALL_SPEED;

  controls = {
    moveDir: 0,
    targetX: null as number | null,
    launch: false,
  };

  onHud?: () => void;
  onBanner?: (text: string) => void;
  onGameOver?: (reason: string, score: number, best: number) => void;

  constructor(best = 0) {
    this.best = best;
    this.buildBricks();
    this.resetBall();
  }

  begin() {
    this.mode = 'playing';
    this.score = 0;
    this.level = 1;
    this.lives = START_LIVES;
    this.combo = 0;
    this.comboTimer = 0;
    this.paddle.w = this.paddle.baseW;
    this.paddle.wide = 0;
    this.paddle.x = WIDTH / 2;
    this.balls = [];
    this.capsules = [];
    this.particles = [];
    this.ballSpeed = BALL_SPEED;
    this.buildBricks();
    this.resetBall();
    this.onHud?.();
  }

  pause() {
    if (this.mode === 'playing') this.mode = 'paused';
  }

  resume() {
    if (this.mode === 'paused') this.mode = 'playing';
  }

  private buildBricks() {
    this.bricks = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const maxHp = (row < 2 ? 2 : 1) + (this.level >= 3 ? 1 : 0);
        this.bricks.push({
          x: GRID_LEFT + col * (BRICK_W + BRICK_GAP),
          y: GRID_TOP + row * (BRICK_H + BRICK_GAP),
          w: BRICK_W,
          h: BRICK_H,
          hp: maxHp,
          maxHp,
          row,
          flash: 0,
        });
      }
    }
    this.ballSpeed = Math.min(BALL_SPEED + (this.level - 1) * 36, 760);
  }

  private resetBall() {
    this.balls = [
      {
        x: this.paddle.x,
        y: PADDLE_Y - 26,
        vx: 0,
        vy: 0,
        r: BALL_R,
        stuck: true,
        trail: [],
      },
    ];
  }

  private addBall(x: number, y: number, angle: number) {
    this.balls.push({
      x,
      y,
      vx: Math.cos(angle) * this.ballSpeed,
      vy: Math.sin(angle) * this.ballSpeed,
      r: BALL_R,
      stuck: false,
      trail: [],
    });
  }

  private launch() {
    for (const b of this.balls) {
      if (!b.stuck) continue;
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
      b.vx = Math.cos(angle) * this.ballSpeed;
      b.vy = Math.sin(angle) * this.ballSpeed;
      b.stuck = false;
    }
  }

  update(dt: number) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 44);
    this.flash = Math.max(0, this.flash - dt * 3);
    for (const b of this.bricks) b.flash = Math.max(0, b.flash - dt * 4);

    for (const p of this.particles) {
      p.life -= dt;
      p.vy += 640 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    if (this.mode !== 'playing') return;

    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer <= 0) this.combo = 0;

    // 挡板
    const p = this.paddle;
    if (this.controls.targetX !== null) {
      p.x += (this.controls.targetX - p.x) * Math.min(1, dt * 22);
    } else if (this.controls.moveDir !== 0) {
      p.x += this.controls.moveDir * PADDLE_SPEED * dt;
    }
    p.x = clamp(p.x, p.w / 2 + 8, WIDTH - p.w / 2 - 8);

    if (p.wide > 0) {
      p.wide -= dt;
      if (p.wide <= 0) p.w = p.baseW;
    }

    if (this.controls.launch) {
      this.controls.launch = false;
      this.launch();
    }

    // 球粘在挡板上
    for (const b of this.balls) {
      if (!b.stuck) continue;
      b.x = clamp(p.x, b.r + 6, WIDTH - b.r - 6);
      b.y = PADDLE_Y - 26;
    }

    // 分步推进，避免穿透
    const speed = Math.max(
      this.ballSpeed,
      ...this.balls.map((b) => Math.hypot(b.vx, b.vy))
    );
    const steps = Math.max(1, Math.ceil((speed * dt) / 6));
    const h = dt / steps;

    const lost: Ball[] = [];
    for (let s = 0; s < steps; s++) {
      for (const b of this.balls) {
        if (b.stuck || lost.includes(b)) continue;
        this.stepBall(b, h, lost);
      }
    }

    // 记录轨迹
    for (const b of this.balls) {
      if (b.stuck) {
        b.trail.length = 0;
        continue;
      }
      b.trail.unshift({ x: b.x, y: b.y });
      if (b.trail.length > 10) b.trail.pop();
    }

    if (lost.length) {
      this.balls = this.balls.filter((b) => !lost.includes(b));
      if (!this.balls.length) this.loseLife();
    }

    this.updateCapsules(dt);

    if (!this.bricks.length) this.nextLevel();
  }

  private stepBall(b: Ball, dt: number, lost: Ball[]) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.x - b.r < 0) {
      b.x = b.r;
      b.vx = Math.abs(b.vx);
      this.spark(b.x, b.y, '#7fd6ee');
    } else if (b.x + b.r > WIDTH) {
      b.x = WIDTH - b.r;
      b.vx = -Math.abs(b.vx);
      this.spark(b.x, b.y, '#7fd6ee');
    }

    if (b.y - b.r < 0) {
      b.y = b.r;
      b.vy = Math.abs(b.vy);
      this.spark(b.x, b.y, '#7fd6ee');
    }

    // 挡板
    const p = this.paddle;
    if (
      b.vy > 0 &&
      b.y + b.r >= p.y &&
      b.y - b.r <= p.y + PADDLE_H &&
      b.x >= p.x - p.w / 2 - b.r &&
      b.x <= p.x + p.w / 2 + b.r
    ) {
      const off = clamp((b.x - p.x) / (p.w / 2), -1, 1);
      const angle = -Math.PI / 2 + off * 0.95;
      const spd = Math.min(this.ballSpeed + 12, 820);
      b.vx = Math.cos(angle) * spd;
      b.vy = Math.sin(angle) * spd;
      b.y = p.y - b.r - 1;
      this.combo = 0;
      this.comboTimer = 0;
      this.spark(b.x, p.y, '#ffe3b0');
    }

    // 砖块
    for (const brick of this.bricks) {
      if (
        b.x + b.r <= brick.x ||
        b.x - b.r >= brick.x + brick.w ||
        b.y + b.r <= brick.y ||
        b.y - b.r >= brick.y + brick.h
      ) {
        continue;
      }
      const overlapX = Math.min(
        b.x + b.r - brick.x,
        brick.x + brick.w - (b.x - b.r)
      );
      const overlapY = Math.min(
        b.y + b.r - brick.y,
        brick.y + brick.h - (b.y - b.r)
      );
      if (overlapX < overlapY) b.vx = -b.vx;
      else b.vy = -b.vy;
      this.hitBrick(brick, b.x, b.y);
      break;
    }

    if (b.y - b.r > HEIGHT) lost.push(b);
  }

  private hitBrick(brick: Brick, x: number, y: number) {
    brick.hp -= 1;
    brick.flash = 1;
    this.shake = Math.max(this.shake, 2.4);

    if (brick.hp > 0) {
      this.burst(x, y, 4, `hsl(${30 + brick.row * 32} 80% 62%)`, 90);
      this.spark(x, y, '#ffe1b0');
    } else {
      this.bricks = this.bricks.filter((b) => b !== brick);
      this.burst(
        x,
        y,
        10,
        `hsl(${30 + brick.row * 32} 82% 60%)`,
        150
      );
      this.shake = Math.max(this.shake, 4);
      this.flash = Math.min(1, this.flash + 0.08);
      if (Math.random() < 0.16) {
        this.capsules.push({
          x: brick.x + brick.w / 2,
          y: brick.y + brick.h / 2,
          vy: 150,
          type: Math.random() < 0.5 ? 'wide' : 'multi',
        });
      }
    }

    const mult = Math.min(1 + Math.floor(this.combo / 3), 5);
    this.score += 10 * mult;
    this.combo += 1;
    this.comboTimer = 2.4;
    this.onHud?.();
  }

  private updateCapsules(dt: number) {
    const p = this.paddle;
    const caught: Capsule[] = [];
    for (const c of this.capsules) {
      c.y += c.vy * dt;
      if (
        c.y > p.y - 10 &&
        c.y < p.y + 26 &&
        Math.abs(c.x - p.x) < p.w / 2 + 14
      ) {
        caught.push(c);
        if (c.type === 'wide') {
          p.w = p.baseW * 1.5;
          p.wide = 10;
        } else {
          const angles = [-Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5];
          for (const a of angles) {
            this.addBall(p.x, PADDLE_Y - 30, a);
          }
        }
        this.burst(c.x, p.y - 6, 12, '#8be8ff', 130);
        this.shake = Math.max(this.shake, 2);
        this.onHud?.();
      }
    }
    this.capsules = this.capsules.filter(
      (c) => !caught.includes(c) && c.y < HEIGHT + 80
    );
  }

  private loseLife() {
    this.lives -= 1;
    this.shake = Math.max(this.shake, 8);
    this.flash = 1;
    this.onHud?.();
    if (this.lives <= 0) {
      this.endGame('球全部掉落');
      return;
    }
    this.resetBall();
  }

  private nextLevel() {
    this.level += 1;
    this.score += this.level * 50;
    this.ballSpeed = Math.min(BALL_SPEED + (this.level - 1) * 36, 760);
    this.buildBricks();
    this.capsules = [];
    this.resetBall();
    this.onBanner?.(`第 ${this.level} 关`);
    this.onHud?.();
  }

  private endGame(reason: string) {
    this.mode = 'over';
    this.best = Math.max(this.best, this.score);
    this.onGameOver?.(reason, this.score, this.best);
  }

  private spark(x: number, y: number, color: string) {
    this.burst(x, y, 3, color, 70);
  }

  private burst(x: number, y: number, count: number, color: string, power: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (0.35 + Math.random() * 0.65) * power;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 20,
        life: 0.35 + Math.random() * 0.4,
        max: 0.75,
        size: 1.5 + Math.random() * 2.5,
        color,
      });
    }
    if (this.particles.length > 220) {
      this.particles.splice(0, this.particles.length - 220);
    }
  }
}
