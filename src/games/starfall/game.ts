import {
  ENEMY_BULLET_LIMIT,
  ENERGY_FULL,
  FIRE_INTERVAL,
  FOCUS_SPEED,
  GRAZE_R,
  HEIGHT,
  MAX_BOMBS,
  PLAYER_BULLET_SPEED,
  PLAYER_HIT_R,
  PLAYER_SPEED,
  PLAYER_Y_START,
  START_BOMBS,
  START_LIVES,
  WIDTH,
} from './constants';
import { sfx } from '../../engine/audio';

export type Mode = 'menu' | 'playing' | 'paused' | 'over';
export type EnemyKind = 'scout' | 'wing' | 'turret' | 'boss';

export interface Enemy {
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  t: number;
  fireCd: number;
  pattern: number;
  burst: number;
  phase: number;
  hitFlash: number;
  score: number;
  stopY: number;
}

export interface EBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  grazed: boolean;
}

export interface PBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
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

interface Spawn {
  at: number;
  kind: EnemyKind;
  x: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export class StarfallGame {
  mode: Mode = 'menu';
  score = 0;
  best = 0;
  wave = 0;
  lives = START_LIVES;
  bombs = START_BOMBS;
  graze = 0;
  energy = 0;
  time = 0;

  player = { x: WIDTH / 2, y: PLAYER_Y_START, invuln: 0, fireCd: 0, focus: false };
  enemies: Enemy[] = [];
  pb: PBullet[] = [];
  eb: EBullet[] = [];
  particles: Particle[] = [];

  shake = 0;
  flash = 0;

  private spawnPlan: Spawn[] = [];
  private waveClock = 0;
  private transition = 0;
  private cleared = false;
  private bossSpiral = 0;

  controls = {
    mx: 0,
    my: 0,
    focus: false,
    bomb: false,
    targetX: null as number | null,
    targetY: null as number | null,
  };

  onHud?: () => void;
  onBanner?: (text: string) => void;
  onGameOver?: (reason: string, score: number, best: number) => void;

  constructor(best = 0) {
    this.best = best;
  }

  begin() {
    this.mode = 'playing';
    this.score = 0;
    this.wave = 0;
    this.lives = START_LIVES;
    this.bombs = START_BOMBS;
    this.graze = 0;
    this.energy = 0;
    this.time = 0;
    this.player.x = WIDTH / 2;
    this.player.y = PLAYER_Y_START;
    this.player.invuln = 1.2;
    this.player.fireCd = 0;
    this.enemies = [];
    this.pb = [];
    this.eb = [];
    this.particles = [];
    this.shake = 0;
    this.flash = 0;
    this.bossSpiral = 0;
    this.transition = 0;
    this.cleared = false;
    this.startWave();
    this.onHud?.();
  }

  pause() {
    if (this.mode === 'playing') this.mode = 'paused';
  }

  resume() {
    if (this.mode === 'paused') this.mode = 'playing';
  }

  /* ---------------- 波次 ---------------- */

  private startWave() {
    this.wave += 1;
    this.waveClock = 0;
    this.transition = 0;
    this.cleared = false;
    this.spawnPlan = this.buildPlan();
    this.onBanner?.(this.wave % 5 === 0 ? '警告 · BOSS 来袭' : `第 ${this.wave} 波`);
  }

  private buildPlan(): Spawn[] {
    const plan: Spawn[] = [];
    if (this.wave % 5 === 0) {
      plan.push({ at: 0.7, kind: 'boss', x: WIDTH / 2 });
      plan.push({ at: 1.8, kind: 'scout', x: 180 });
      plan.push({ at: 2.3, kind: 'scout', x: WIDTH - 180 });
      return plan;
    }

    const count = Math.min(5 + Math.floor(this.wave * 1.6), 14);
    const gap = Math.max(0.28, 0.62 - this.wave * 0.03);
    const kinds: EnemyKind[] = ['scout'];
    if (this.wave >= 2) kinds.push('wing');
    if (this.wave >= 3) kinds.push('turret');
    for (let i = 0; i < count; i++) {
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      plan.push({ at: i * gap, kind, x: 110 + Math.random() * (WIDTH - 220) });
    }
    return plan;
  }

  private spawnEnemy(kind: EnemyKind, x: number) {
    const e: Enemy = {
      kind,
      x,
      y: -40,
      vx: 0,
      vy: 0,
      r: 15,
      hp: 3,
      maxHp: 3,
      t: 0,
      fireCd: 1.1,
      pattern: 0,
      burst: 0,
      phase: Math.random() * Math.PI * 2,
      hitFlash: 0,
      score: 120,
      stopY: 0,
    };

    switch (kind) {
      case 'scout':
        e.vy = 78 + this.wave * 3;
        break;
      case 'wing':
        e.vy = 96 + this.wave * 3;
        e.vx = (Math.random() < 0.5 ? -1 : 1) * (70 + this.wave * 2);
        e.hp = e.maxHp = 5;
        e.r = 16;
        e.score = 180;
        break;
      case 'turret':
        e.vy = 92;
        e.hp = e.maxHp = 9;
        e.r = 19;
        e.score = 300;
        e.stopY = 118 + Math.random() * 80;
        e.fireCd = 1.4;
        break;
      case 'boss':
        e.y = -100;
        e.vy = 62;
        e.hp = e.maxHp = 64 + this.wave * 8;
        e.r = 46;
        e.score = 3000;
        e.stopY = 132;
        e.fireCd = 1.3;
        break;
    }
    this.enemies.push(e);
  }

  /* ---------------- 主更新 ---------------- */

  update(dt: number) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 50);
    this.flash = Math.max(0, this.flash - dt * 2.4);

    for (const p of this.particles) {
      p.life -= dt;
      p.vx *= 1 - dt * 1.6;
      p.vy *= 1 - dt * 1.6;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    if (this.mode !== 'playing') return;

    this.player.invuln = Math.max(0, this.player.invuln - dt);
    this.player.focus = this.controls.focus;
    this.movePlayer(dt);
    this.firePlayer(dt);

    if (this.controls.bomb) {
      this.controls.bomb = false;
      this.useBomb();
    }

    this.waveClock += dt;
    while (this.spawnPlan.length && this.spawnPlan[0].at <= this.waveClock) {
      const s = this.spawnPlan.shift()!;
      this.spawnEnemy(s.kind, s.x);
    }

    for (const e of this.enemies) this.updateEnemy(e, dt);
    this.enemies = this.enemies.filter(
      (e) => e.hp > 0 && (e.kind === 'boss' || e.y < HEIGHT + 100)
    );

    this.stepBullets(dt);

    if (!this.spawnPlan.length && !this.enemies.length && !this.cleared) {
      this.cleared = true;
      this.score += this.wave * 60;
      this.transition = 1.05;
      this.onHud?.();
    }
    if (this.transition > 0) {
      this.transition -= dt;
      if (this.transition <= 0) this.startWave();
    }
  }

  private movePlayer(dt: number) {
    const p = this.player;
    const speed = p.focus ? FOCUS_SPEED : PLAYER_SPEED;

    if (this.controls.targetX !== null && this.controls.targetY !== null) {
      const dx = this.controls.targetX - p.x;
      const dy = this.controls.targetY - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.4) {
        const step = Math.min(dist, PLAYER_SPEED * 2.2 * dt);
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
      }
    } else {
      let mxn = this.controls.mx;
      let myn = this.controls.my;
      const len = Math.hypot(mxn, myn);
      if (len > 1) {
        mxn /= len;
        myn /= len;
      }
      p.x += mxn * speed * dt;
      p.y += myn * speed * dt;
    }

    p.x = clamp(p.x, 26, WIDTH - 26);
    p.y = clamp(p.y, 96, HEIGHT - 30);
  }

  private firePlayer(dt: number) {
    const p = this.player;
    p.fireCd -= dt;
    if (p.fireCd > 0) return;
    p.fireCd += FIRE_INTERVAL;
    if (this.pb.length > 180) return;
    this.pb.push(
      { x: p.x - 8, y: p.y - 20, vx: -26, vy: -PLAYER_BULLET_SPEED, r: 3 },
      { x: p.x + 8, y: p.y - 20, vx: 26, vy: -PLAYER_BULLET_SPEED, r: 3 }
    );
    sfx.starShot();
  }

  private updateEnemy(e: Enemy, dt: number) {
    e.t += dt;
    e.hitFlash = Math.max(0, e.hitFlash - dt * 5);

    if (e.kind === 'boss') {
      if (e.y < e.stopY) {
        e.y += e.vy * dt;
      } else {
        e.x = WIDTH / 2 + Math.sin(e.t * 0.7) * 300;
      }
      e.x = clamp(e.x, 90, WIDTH - 90);
      this.bossFire(e, dt);
      return;
    }

    if (e.kind === 'turret') {
      if (e.y < e.stopY) e.y += e.vy * dt;
      else e.y = e.stopY + Math.sin(e.t * 1.6) * 8;
    } else {
      e.y += e.vy * dt;
      if (e.kind === 'scout') {
        e.x += Math.sin(e.t * 2.2 + e.phase) * 42 * dt;
      } else {
        e.x += e.vx * dt;
        if (e.x < 70 || e.x > WIDTH - 70) e.vx *= -1;
      }
      e.x = clamp(e.x, 60, WIDTH - 60);
    }

    if (e.y > 18) {
      e.fireCd -= dt;
      if (e.fireCd <= 0) {
        this.enemyFire(e);
        e.fireCd = this.fireCooldown(e);
      }
    }
  }

  private fireCooldown(e: Enemy) {
    const base = e.kind === 'scout' ? 1.35 : e.kind === 'wing' ? 1.7 : 2.3;
    return Math.max(0.7, base - this.wave * 0.03) * (0.85 + Math.random() * 0.3);
  }

  private enemyFire(e: Enemy) {
    const speed = Math.min(190 + this.wave * 7, 340);
    const aim = Math.atan2(this.player.y - e.y, this.player.x - e.x);

    if (e.kind === 'scout') {
      this.shot(e.x, e.y + 10, aim, speed);
    } else if (e.kind === 'wing') {
      for (let i = -1; i <= 1; i++) this.shot(e.x, e.y + 8, aim + i * 0.2, speed * 0.95);
    } else {
      const n = 8;
      for (let i = 0; i < n; i++) {
        this.shot(e.x, e.y, e.phase + (i / n) * Math.PI * 2, speed * 0.72, 5, '#ffb15e');
      }
      e.phase += 0.28;
    }
  }

  private bossFire(e: Enemy, dt: number) {
    e.fireCd -= dt;
    if (e.fireCd > 0) return;
    const speed = Math.min(210 + this.wave * 5, 350);

    if (e.pattern === 0) {
      const aim = Math.atan2(this.player.y - e.y, this.player.x - e.x);
      for (let i = -2; i <= 2; i++) this.shot(e.x, e.y + 30, aim + i * 0.14, speed);
      e.pattern = 1;
      e.fireCd = 1.35;
    } else if (e.pattern === 1) {
      const n = 16;
      const off = Math.random() * 0.4;
      for (let i = 0; i < n; i++) {
        this.shot(e.x, e.y + 10, off + (i / n) * Math.PI * 2, speed * 0.78, 6, '#ffb15e');
      }
      e.pattern = 2;
      e.burst = 0;
      e.fireCd = 1.6;
    } else {
      for (let i = 0; i < 4; i++) {
        this.shot(e.x, e.y + 16, this.bossSpiral + (i * Math.PI) / 2, speed * 0.85, 5, '#c58cff');
      }
      this.bossSpiral += 0.3;
      e.burst += 1;
      if (e.burst >= 18) {
        e.pattern = 0;
        e.burst = 0;
        e.fireCd = 1.2;
      } else {
        e.fireCd = 0.14;
      }
    }
  }

  private shot(x: number, y: number, angle: number, speed: number, r = 5, color = '#ff6f9f') {
    if (this.eb.length >= ENEMY_BULLET_LIMIT) return;
    this.eb.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r,
      color,
      grazed: false,
    });
  }

  /* ---------------- 弹幕推进与碰撞 ---------------- */

  private stepBullets(dt: number) {
    for (const b of this.pb) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    this.checkPlayerHits();
    this.pb = this.pb.filter((b) => b.y > -30 && b.x > -20 && b.x < WIDTH + 20);

    const maxSpeed = this.eb.reduce((m, b) => Math.max(m, Math.hypot(b.vx, b.vy)), 1);
    const steps = Math.max(1, Math.ceil((maxSpeed * dt) / 7));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      for (const b of this.eb) {
        b.x += b.vx * h;
        b.y += b.vy * h;
        this.checkEnemyBullet(b);
      }
    }
    this.eb = this.eb.filter(
      (b) => b.x > -40 && b.x < WIDTH + 40 && b.y > -60 && b.y < HEIGHT + 40
    );
  }

  private checkPlayerHits() {
    for (const b of this.pb) {
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(b.x - e.x, b.y - e.y) <= e.r + b.r) {
          b.y = -999;
          this.damageEnemy(e, 1);
          break;
        }
      }
    }
  }

  private checkEnemyBullet(b: EBullet) {
    const p = this.player;
    const d = Math.hypot(b.x - p.x, b.y - p.y);

    if (d < b.r + PLAYER_HIT_R) {
      if (p.invuln <= 0) this.hurtPlayer();
      return;
    }

    if (!b.grazed && d < GRAZE_R + b.r) {
      b.grazed = true;
      this.graze += 1;
      this.score += 5;
      this.addEnergy(4);
      this.spark(b.x, b.y, '#9ff2ff');
      if (this.graze % 4 === 0) sfx.graze();
      this.onHud?.();
    }
  }

  private addEnergy(n: number) {
    if (this.bombs >= MAX_BOMBS) return;
    this.energy += n;
    if (this.energy >= ENERGY_FULL) {
      this.energy -= ENERGY_FULL;
      this.bombs = Math.min(MAX_BOMBS, this.bombs + 1);
      sfx.pickup();
      this.onHud?.();
    }
  }

  private damageEnemy(e: Enemy, dmg: number) {
    e.hp -= dmg;
    e.hitFlash = 1;
    if (e.hp > 0) {
      this.spark(e.x, e.y, '#ffd7a8');
      return;
    }
    this.killEnemy(e);
  }

  private killEnemy(e: Enemy) {
    e.hp = 0;
    this.score += e.score;
    const boss = e.kind === 'boss';
    this.shake = Math.max(this.shake, boss ? 20 : 3.5);
    this.flash = Math.min(1, this.flash + (boss ? 0.7 : 0.05));
    this.burst(
      e.x,
      e.y,
      boss ? 90 : e.kind === 'turret' ? 22 : 14,
      boss ? '#ffb15e' : '#ff8fb6',
      boss ? 320 : 160
    );
    if (boss) {
      for (const b of this.eb) this.spark(b.x, b.y, '#ffffff');
      this.eb = [];
      sfx.explode();
      this.onBanner?.('BOSS 已击破');
    } else {
      sfx.hit();
    }
    this.onHud?.();
  }

  /* ---------------- 炸弹 / 受击 ---------------- */

  private useBomb() {
    if (this.bombs <= 0) return;
    this.bombs -= 1;
    this.player.invuln = Math.max(this.player.invuln, 1.7);
    this.flash = 1;
    this.shake = 18;
    this.score += this.eb.length * 2;
    for (const b of this.eb) this.spark(b.x, b.y, '#bff6ff');
    this.eb = [];
    for (const e of this.enemies) this.damageEnemy(e, 12);
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    sfx.bomb();
    this.onHud?.();
  }

  private hurtPlayer() {
    if (this.mode !== 'playing' || this.player.invuln > 0) return;
    this.lives -= 1;
    this.player.invuln = 2.2;
    this.shake = 16;
    this.flash = 1;
    this.burst(this.player.x, this.player.y, 24, '#9ff2ff', 190);

    const keep: EBullet[] = [];
    for (const b of this.eb) {
      if (Math.hypot(b.x - this.player.x, b.y - this.player.y) < 160) {
        this.spark(b.x, b.y, '#cfeaff');
      } else {
        keep.push(b);
      }
    }
    this.eb = keep;
    sfx.hurt();
    this.onHud?.();

    if (this.lives <= 0) this.endGame('战机被击落');
  }

  private endGame(reason: string) {
    this.mode = 'over';
    this.best = Math.max(this.best, this.score);
    this.onGameOver?.(reason, this.score, this.best);
  }

  /* ---------------- 粒子 ---------------- */

  private spark(x: number, y: number, color: string) {
    this.burst(x, y, 3, color, 80);
  }

  private burst(x: number, y: number, count: number, color: string, power: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (0.3 + Math.random() * 0.7) * power;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.3 + Math.random() * 0.45,
        max: 0.75,
        size: 1.5 + Math.random() * 2.6,
        color,
      });
    }
    if (this.particles.length > 260) {
      this.particles.splice(0, this.particles.length - 260);
    }
  }
}
