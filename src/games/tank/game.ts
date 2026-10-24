import {
  BASE_CENTER,
  BASE_SIZE,
  BRICK,
  COLS,
  EMPTY,
  HEIGHT,
  MAP,
  PLAYER_START,
  ROWS,
  SPAWN_POINTS,
  STEEL,
  TILE,
  TREE,
  WATER,
  WIDTH,
} from './constants';
import type {
  BaseState,
  Bullet,
  EnemyKind,
  FloatText,
  Mode,
  Particle,
  Powerup,
  PowerupType,
  Tank,
  Team,
} from './types';
import { sfx } from '../../engine/audio';

export interface Controls {
  mx: number;
  my: number;
  aimX: number;
  aimY: number;
  firing: boolean;
}

interface EnemyStats {
  hp: number;
  speed: number;
  fireDelay: number;
  bulletSpeed: number;
  radius: number;
  score: number;
}

const ENEMY_STATS: Record<EnemyKind, EnemyStats> = {
  scout: { hp: 1, speed: 124, fireDelay: 1.5, bulletSpeed: 300, radius: 14, score: 120 },
  grunt: { hp: 2, speed: 88, fireDelay: 1.1, bulletSpeed: 340, radius: 16, score: 220 },
  heavy: { hp: 3, speed: 60, fireDelay: 1.55, bulletSpeed: 380, radius: 18, score: 400 },
};

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

const angleDelta = (a: number, b: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

const lerpAngle = (a: number, b: number, t: number) => a + angleDelta(a, b) * clamp(t, 0, 1);

let uid = 1;

function createPlayer(ownerId: string, x: number, y: number): Tank {
  return {
    id: uid++,
    team: 'player',
    kind: 'player',
    ownerId,
    x,
    y,
    r: 14,
    hullAngle: -Math.PI / 2,
    turretAngle: -Math.PI / 2,
    hp: 4,
    maxHp: 4,
    speed: 200,
    cooldown: 0,
    fireDelay: 0.3,
    bulletSpeed: 660,
    spawnT: 0,
    invuln: 1.6,
    hitFlash: 0,
    muzzle: 0,
    tread: 0,
    moving: false,
    respawnT: 0,
    ai: null,
  };
}

function createEnemy(kind: EnemyKind, x: number, y: number): Tank {
  const s = ENEMY_STATS[kind];
  return {
    id: uid++,
    team: 'enemy',
    kind,
    x,
    y,
    r: s.radius,
    hullAngle: Math.PI / 2,
    turretAngle: Math.PI / 2,
    hp: s.hp,
    maxHp: s.hp,
    speed: s.speed,
    cooldown: 0.8,
    fireDelay: s.fireDelay,
    bulletSpeed: s.bulletSpeed,
    spawnT: 0.85,
    invuln: 0,
    hitFlash: 0,
    muzzle: 0,
    tread: 0,
    moving: false,
    respawnT: 0,
    ai: { dir: Math.PI / 2, retarget: 0, blocked: 0 },
  };
}

function buildWave(n: number): EnemyKind[] {
  const scouts = 1 + Math.floor(n * 0.7);
  const grunts = 2 + Math.floor(n * 0.9);
  const heavies = Math.max(0, Math.floor((n - 2) / 2));
  const list: EnemyKind[] = [];
  for (let i = 0; i < scouts; i++) list.push('scout');
  for (let i = 0; i < grunts; i++) list.push('grunt');
  for (let i = 0; i < heavies; i++) list.push('heavy');
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, 12);
}

export class TankGame {
  mode: Mode = 'menu';
  tiles = new Uint8Array(COLS * ROWS);
  score = 0;
  best = 0;
  wave = 0;
  time = 0;

  /** 玩家坦克（单人 1 辆，联机合作 2 辆），ownerId 区分归属 */
  players: Tank[] = [createPlayer('p1', PLAYER_START.x, PLAYER_START.y)];
  coop = false;
  /** 本机控制的玩家（房主/单人为 p1，队员在 guest 视图中为 p2） */
  localOwner = 'p1';
  /** 地块版本号，联机快照据此决定是否同步地形 */
  tilesRev = 0;
  enemies: Tank[] = [];
  bullets: Bullet[] = [];
  particles: Particle[] = [];
  powerups: Powerup[] = [];
  texts: FloatText[] = [];

  base: BaseState = { ...BASE_CENTER, hp: 3, maxHp: 3, flash: 0 };

  controls: Controls = {
    mx: 0,
    my: 0,
    aimX: WIDTH / 2,
    aimY: HEIGHT / 2 - 120,
    firing: false,
  };

  shake = 0;
  hitStop = 0;
  rapidT = 0;
  freezeT = 0;
  damageFlash = 0;
  overReason = '';

  onHud: () => void = () => {};
  onBanner: (text: string) => void = () => {};
  onGameOver: (reason: string, score: number, best: number) => void = () => {};

  private spawnQueue: EnemyKind[] = [];
  private spawnTimer = 0;
  private spawnIndex = 0;
  private intermission = 0;
  private remoteControls = new Map<string, Controls>();

  constructor(best = 0) {
    this.best = best;
    this.reset();
  }

  reset() {
    this.tiles = new Uint8Array(COLS * ROWS);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const ch = MAP[row][col];
        this.tiles[row * COLS + col] =
          ch === '#'
            ? BRICK
            : ch === 'S'
              ? STEEL
              : ch === 'W'
                ? WATER
                : ch === 'T'
                  ? TREE
                  : EMPTY;
      }
    }

    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.powerups = [];
    this.texts = [];

    this.score = 0;
    this.wave = 0;
    this.time = 0;
    this.shake = 0;
    this.hitStop = 0;
    this.rapidT = 0;
    this.freezeT = 0;
    this.damageFlash = 0;
    this.overReason = '';
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.spawnIndex = 0;
    this.intermission = 0;

    this.base = { ...BASE_CENTER, hp: 3, maxHp: 3, flash: 0 };
    const offset = this.coop ? 68 : 0;
    this.players = [createPlayer('p1', PLAYER_START.x - offset, PLAYER_START.y)];
    if (this.coop) {
      this.players.push(createPlayer('p2', PLAYER_START.x + offset, PLAYER_START.y));
    }
    this.remoteControls.clear();
    this.tilesRev++;
    this.controls.firing = false;
  }

  begin(coop = false) {
    this.coop = coop;
    this.reset();
    this.mode = 'playing';
    this.startWave(1);
    this.onHud();
  }

  /** 联机时由网络层写入远端玩家的输入 */
  setControls(ownerId: string, controls: Controls) {
    this.remoteControls.set(ownerId, controls);
  }

  /** 队友掉线时移除其坦克，剩余玩家继续单人作战 */
  removePlayer(ownerId: string) {
    this.players = this.players.filter((p) => p.ownerId !== ownerId);
    this.remoteControls.delete(ownerId);
    this.coop = this.players.length > 1;
    this.onHud();
  }

  private controlsFor(p: Tank): Controls {
    if (!p.ownerId || p.ownerId === this.localOwner) return this.controls;
    const remote = this.remoteControls.get(p.ownerId);
    if (remote) return remote;
    return { mx: 0, my: 0, aimX: p.x, aimY: p.y - 120, firing: false };
  }

  pause() {
    if (this.mode === 'playing') this.mode = 'paused';
  }

  resume() {
    if (this.mode === 'paused') this.mode = 'playing';
  }

  update(dt: number) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 32);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.4);
    this.base.flash = Math.max(0, this.base.flash - dt * 3);

    if (this.mode !== 'playing') return;

    if (this.hitStop > 0) {
      this.hitStop -= dt;
      dt *= 0.2;
    }

    this.rapidT = Math.max(0, this.rapidT - dt);
    this.freezeT = Math.max(0, this.freezeT - dt);

    for (const p of this.players) this.updatePlayer(p, dt);
    for (const e of this.enemies) this.updateEnemy(e, dt);
    this.resolveOverlap();
    this.updateBullets(dt);
    this.updatePowerups(dt);
    this.updateParticles(dt);
    this.updateWaves(dt);
    this.onHud();
  }

  /* ---------------- 玩家 ---------------- */

  private updatePlayer(p: Tank, dt: number) {
    if (p.hp <= 0) {
      p.moving = false;
      if (p.respawnT > 0) {
        p.respawnT -= dt;
        if (p.respawnT <= 0) this.revive(p);
      }
      return;
    }

    p.cooldown = Math.max(0, p.cooldown - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt * 3.2);
    p.muzzle = Math.max(0, p.muzzle - dt);

    const c = this.controlsFor(p);
    let mx = c.mx;
    let my = c.my;
    const len = Math.hypot(mx, my);
    if (len > 0.001) {
      mx /= len;
      my /= len;
      const step = p.speed * dt;
      const moved = this.moveTank(p, mx * step, my * step);
      p.moving = moved.x || moved.y;
      if (p.moving) {
        p.tread += step * 0.1;
        if (Math.random() < dt * 26) this.dust(p.x - mx * 12, p.y - my * 12);
      }
      p.hullAngle = lerpAngle(p.hullAngle, Math.atan2(my, mx), dt * 15);
    } else {
      p.moving = false;
    }

    p.turretAngle = Math.atan2(c.aimY - p.y, c.aimX - p.x);

    const inFlight = this.bullets.reduce(
      (n, b) => n + (b.team === 'player' && b.owner === p.ownerId ? 1 : 0),
      0
    );
    if (c.firing && p.cooldown <= 0 && inFlight < 5) {
      this.fire(p);
      p.cooldown = this.rapidT > 0 ? 0.13 : p.fireDelay;
    }
  }

  private revive(p: Tank) {
    const offset = this.coop ? (p.ownerId === 'p2' ? 68 : -68) : 0;
    p.hp = 2;
    p.x = PLAYER_START.x + offset;
    p.y = PLAYER_START.y;
    p.cooldown = 0.4;
    p.spawnT = 0.8;
    p.invuln = 2;
    p.respawnT = 0;
    this.burst(p.x, p.y, 12, '#a8e6ff');
    this.float('重返战场', p.x, p.y - 26, '#9fd8ff');
    sfx.pickup();
    this.onHud();
  }

  /* ---------------- 敌人 AI ---------------- */

  private updateEnemy(e: Tank, dt: number) {
    if (e.spawnT > 0) {
      e.spawnT -= dt;
      return;
    }

    e.cooldown = Math.max(0, e.cooldown - dt);
    e.hitFlash = Math.max(0, e.hitFlash - dt * 4);
    e.muzzle = Math.max(0, e.muzzle - dt);

    const ai = e.ai!;
    const frozen = this.freezeT > 0;
    const target = this.pickTarget(e);
    const targetAngle = Math.atan2(target.y - e.y, target.x - e.x);

    if (!frozen) {
      ai.retarget -= dt;
      if (ai.retarget <= 0) {
        ai.retarget = 0.8 + Math.random() * 0.9;
        ai.dir = this.pickDir(e, targetAngle);
      }
      const step = e.speed * dt;
      const moved = this.moveTank(e, Math.cos(ai.dir) * step, Math.sin(ai.dir) * step);
      e.moving = moved.x || moved.y;
      if (e.moving) {
        e.tread += step * 0.1;
        if (Math.random() < dt * 12) this.dust(e.x, e.y);
      } else {
        ai.blocked += dt;
        if (ai.blocked > 0.12) {
          ai.dir = this.pickDir(e, targetAngle, true);
          ai.retarget = 0.55 + Math.random() * 0.5;
          ai.blocked = 0;
        }
      }
      e.hullAngle = lerpAngle(e.hullAngle, ai.dir, dt * 8);
    } else {
      e.moving = false;
    }

    const visible = this.hasLineOfSight(e.x, e.y, target.x, target.y);
    const aimAt = visible ? targetAngle : ai.dir;
    e.turretAngle = lerpAngle(e.turretAngle, aimAt, dt * 3.4);

    if (frozen) return;

    const dist = Math.hypot(target.x - e.x, target.y - e.y);
    const err = Math.abs(angleDelta(e.turretAngle, aimAt));
    const align = visible ? err < 0.22 && dist < 470 : err < 0.16;
    const eager = visible ? 1 : Math.random() < dt * 0.9 ? 1 : 0;
    if (align && e.cooldown <= 0 && eager) {
      this.fire(e);
      e.cooldown = e.fireDelay;
    }
  }

  private pickTarget(e: Tank): { x: number; y: number } {
    let best: Tank | null = null;
    let bestDist = Infinity;
    for (const p of this.players) {
      if (p.hp <= 0) continue;
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    if (best && (bestDist < 300 || Math.random() < 0.34)) return best;
    return this.base;
  }

  private pickDir(e: Tank, targetAngle: number, force = false): number {
    const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    const current = e.ai?.dir ?? Math.PI / 2;
    if (!force && Math.random() < 0.1) return dirs[Math.floor(Math.random() * 4)];

    let best = current;
    let bestScore = -Infinity;
    for (const d of dirs) {
      const probe = 32;
      if (this.blocked(e.x + Math.cos(d) * probe, e.y + Math.sin(d) * probe, e.r)) continue;
      let score = Math.cos(d - targetAngle) * 2 + Math.random() * 0.7;
      if (Math.abs(angleDelta(d, current)) > 2.6) score -= 1.5;
      if (score > bestScore) {
        bestScore = score;
        best = d;
      }
    }
    return best;
  }

  /* ---------------- 碰撞与地形 ---------------- */

  private blocked(x: number, y: number, r: number): boolean {
    if (x - r < 2 || x + r > WIDTH - 2 || y - r < 2 || y + r > HEIGHT - 2) return true;
    const c0 = Math.floor((x - r) / TILE);
    const c1 = Math.floor((x + r) / TILE);
    const r0 = Math.floor((y - r) / TILE);
    const r1 = Math.floor((y + r) / TILE);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const code = this.tiles[row * COLS + col];
        if (code !== BRICK && code !== STEEL && code !== WATER) continue;
        const nx = clamp(x, col * TILE, col * TILE + TILE);
        const ny = clamp(y, row * TILE, row * TILE + TILE);
        const dx = x - nx;
        const dy = y - ny;
        if (dx * dx + dy * dy < r * r) return true;
      }
    }
    return false;
  }

  private moveTank(t: Tank, dx: number, dy: number) {
    let mx = 0;
    let my = 0;
    // 低帧率时单帧位移可能很大，拆成小步进避免直接判定为撞墙
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
    const sx = dx / steps;
    const sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      if (sx !== 0 && !this.blocked(t.x + sx, t.y, t.r)) {
        t.x += sx;
        mx = sx;
      }
      if (sy !== 0 && !this.blocked(t.x, t.y + sy, t.r)) {
        t.y += sy;
        my = sy;
      }
    }
    return { x: mx !== 0, y: my !== 0 };
  }

  private resolveOverlap() {
    const all = [...this.players, ...this.enemies].filter((t) => t.spawnT <= 0 && t.hp > 0);
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        const min = a.r + b.r + 2;
        if (d < 0.001) {
          dx = 1;
          dy = 0;
          d = 1;
        }
        if (d >= min) continue;
        const push = (min - d) / 2;
        const nx = (dx / d) * push;
        const ny = (dy / d) * push;
        if (!this.blocked(a.x - nx, a.y - ny, a.r)) {
          a.x -= nx;
          a.y -= ny;
        }
        if (!this.blocked(b.x + nx, b.y + ny, b.r)) {
          b.x += nx;
          b.y += ny;
        }
      }
    }
  }

  private hasLineOfSight(x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    const steps = Math.ceil(dist / 12);
    for (let i = 1; i < steps; i++) {
      const x = x1 + (dx * i) / steps;
      const y = y1 + (dy * i) / steps;
      const code = this.tiles[Math.floor(y / TILE) * COLS + Math.floor(x / TILE)];
      if (code === BRICK || code === STEEL) return false;
    }
    return true;
  }

  /* ---------------- 开火与伤害 ---------------- */

  private fire(t: Tank) {
    const a = t.turretAngle;
    const ox = Math.cos(a) * (t.r + 10);
    const oy = Math.sin(a) * (t.r + 10);
    this.bullets.push({
      x: t.x + ox,
      y: t.y + oy,
      vx: Math.cos(a) * t.bulletSpeed,
      vy: Math.sin(a) * t.bulletSpeed,
      team: t.team,
      owner: t.team === 'player' ? t.ownerId : undefined,
      dmg: 1,
      life: 2.4,
      r: 3,
    });
    t.muzzle = 0.07;
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        x: t.x + ox,
        y: t.y + oy,
        vx: Math.cos(a) * (60 + Math.random() * 120) + (Math.random() - 0.5) * 60,
        vy: Math.sin(a) * (60 + Math.random() * 120) + (Math.random() - 0.5) * 60,
        life: 0.18,
        max: 0.18,
        size: 2 + Math.random() * 2,
        color: '#ffd28a',
        drag: 6,
        grow: 0,
        glow: true,
      });
    }
    if (t.team === 'player') {
      this.addShake(1.4);
      sfx.shoot();
    } else {
      sfx.enemyShoot();
    }
  }

  private updateBullets(dt: number) {
    const alive: Bullet[] = [];
    const kills: Tank[] = [];

    for (const b of this.bullets) {
      b.life -= dt;
      if (b.life <= 0) continue;

      const steps = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy) * dt) / 7));
      let dead = false;

      for (let s = 0; s < steps && !dead; s++) {
        b.x += (b.vx * dt) / steps;
        b.y += (b.vy * dt) / steps;

        if (b.x < 0 || b.x > WIDTH || b.y < 0 || b.y > HEIGHT) {
          dead = true;
          break;
        }

        const col = Math.floor(b.x / TILE);
        const row = Math.floor(b.y / TILE);
        const code = this.tiles[row * COLS + col];

        if (code === BRICK) {
          this.tiles[row * COLS + col] = EMPTY;
          this.tilesRev++;
          this.brickBurst(col, row);
          sfx.brick();
          this.addShake(1.6);
          dead = true;
          break;
        }
        if (code === STEEL) {
          this.spark(b.x, b.y, '#b6c4d6');
          sfx.ping();
          dead = true;
          break;
        }

        const targets = b.team === 'player' ? this.enemies : this.players;
        for (const t of targets) {
          if (t.spawnT > 0 || t.hp <= 0) continue;
          const dx = t.x - b.x;
          const dy = t.y - b.y;
          if (dx * dx + dy * dy < (t.r + b.r) * (t.r + b.r)) {
            if (b.team === 'player') {
              t.hp -= b.dmg;
              t.hitFlash = 1;
              this.burst(b.x, b.y, 6, '#ff9a5c');
              sfx.hit();
              if (t.hp <= 0) kills.push(t);
            } else {
              this.hurtPlayer(t);
            }
            dead = true;
            break;
          }
        }
        if (dead) break;

        const half = BASE_SIZE / 2;
        if (
          Math.abs(b.x - this.base.x) < half &&
          Math.abs(b.y - this.base.y) < half
        ) {
          if (b.team === 'enemy') {
            this.hurtBase();
          } else {
            this.destroyOwnBase();
          }
          dead = true;
          break;
        }
      }

      if (!dead) alive.push(b);
    }

    this.bullets = alive;

    // 子弹对撞抵消
    for (let i = 0; i < this.bullets.length; i++) {
      const a = this.bullets[i];
      if (!a) continue;
      for (let j = i + 1; j < this.bullets.length; j++) {
        const b = this.bullets[j];
        if (!b || a.team === b.team) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) < 9) {
          this.spark((a.x + b.x) / 2, (a.y + b.y) / 2, '#ffe1a8');
          sfx.ping();
          this.bullets[i] = undefined as unknown as Bullet;
          this.bullets[j] = undefined as unknown as Bullet;
          break;
        }
      }
    }
    this.bullets = this.bullets.filter(Boolean);

    if (kills.length) {
      this.enemies = this.enemies.filter((e) => !kills.includes(e));
      for (const e of kills) this.onEnemyKilled(e);
    }
  }

  private hurtPlayer(p: Tank) {
    if (p.invuln > 0 || p.spawnT > 0 || p.hp <= 0) return;
    p.hp -= 1;
    p.invuln = 1.25;
    p.hitFlash = 1;
    this.damageFlash = 1;
    this.addShake(7);
    this.hitStop = Math.max(this.hitStop, 0.04);
    this.burst(p.x, p.y, 9, '#ff8f6b');
    sfx.hit();
    if (p.hp <= 0) {
      p.hp = 0;
      this.explode(p.x, p.y, 1.8);
      this.addShake(9);
      if (this.coop) {
        p.respawnT = 4;
        this.float('重生 4s', p.x, p.y - 26, '#ffb59f');
        if (this.players.every((q) => q.hp <= 0)) this.endGame('全员被击毁');
      } else {
        this.endGame('你的坦克被击毁');
      }
    }
    this.onHud();
  }

  private hurtBase() {
    this.base.hp -= 1;
    this.base.flash = 1;
    this.addShake(10);
    this.hitStop = Math.max(this.hitStop, 0.05);
    this.burst(this.base.x, this.base.y - 10, 12, '#ffb15c');
    sfx.explode();
    if (this.base.hp <= 0) this.endGame('基地被摧毁');
    this.onHud();
  }

  private destroyOwnBase() {
    this.base.hp = 0;
    this.base.flash = 1;
    this.addShake(16);
    this.hitStop = Math.max(this.hitStop, 0.08);
    this.burst(this.base.x, this.base.y, 28, '#ffcf87');
    this.spark(this.base.x, this.base.y, '#fff3d6');
    sfx.explode();
    this.endGame('你摧毁了自己的基地');
    this.onHud();
  }

  private onEnemyKilled(e: Tank) {
    const s = ENEMY_STATS[e.kind as EnemyKind];
    this.score += s.score;
    this.texts.push({
      x: e.x,
      y: e.y - 14,
      text: `+${s.score}`,
      life: 0.9,
      color: '#ffd08a',
    });
    this.explode(e.x, e.y, 1 + e.r / 16);
    this.addShake(5);
    this.hitStop = Math.max(this.hitStop, 0.035);
    sfx.explode();
    if (Math.random() < 0.24) this.dropPowerup(e.x, e.y);
    this.onHud();
  }

  private endGame(reason: string) {
    if (this.mode === 'over') return;
    this.mode = 'over';
    this.overReason = reason;
    this.best = Math.max(this.best, this.score);
    this.addShake(14);
    const p = this.players[0];
    if (p) this.explode(p.x, p.y, 2.4);
    sfx.gameOver();
    this.onGameOver(reason, this.score, this.best);
    this.onHud();
  }

  /* ---------------- 补给 ---------------- */

  private dropPowerup(x: number, y: number) {
    let type: PowerupType = (['repair', 'shield', 'rapid', 'freeze'] as PowerupType[])[
      Math.floor(Math.random() * 4)
    ];
    if (type === 'repair' && this.players.every((p) => p.hp >= p.maxHp)) type = 'rapid';
    this.powerups.push({
      x: clamp(x, 34, WIDTH - 34),
      y: clamp(y, 34, HEIGHT - 34),
      type,
      life: 12,
      t: 0,
    });
  }

  private updatePowerups(dt: number) {
    this.powerups = this.powerups.filter((pu) => {
      pu.life -= dt;
      pu.t += dt;
      if (pu.life <= 0) return false;
      for (const p of this.players) {
        if (p.hp <= 0) continue;
        if (Math.hypot(pu.x - p.x, pu.y - p.y) < 26) {
          this.applyPowerup(pu.type, p);
          return false;
        }
      }
      return true;
    });
  }

  private applyPowerup(type: PowerupType, p: Tank) {
    switch (type) {
      case 'repair':
        p.hp = Math.min(p.maxHp, p.hp + 1);
        this.float('护甲 +1', p.x, p.y - 26, '#7fe0a8');
        break;
      case 'shield':
        p.invuln = Math.max(p.invuln, 8);
        this.float('护盾 8s', p.x, p.y - 26, '#7cd7ff');
        break;
      case 'rapid':
        this.rapidT = 8;
        this.float('速射 8s', p.x, p.y - 26, '#ffd08a');
        break;
      case 'freeze':
        this.freezeT = 5;
        this.float('冻结 5s', p.x, p.y - 26, '#9fd8ff');
        break;
    }
    sfx.pickup();
    this.burst(p.x, p.y, 10, '#a8e6ff');
    this.onHud();
  }

  /* ---------------- 波次 ---------------- */

  private startWave(n: number) {
    this.wave = n;
    this.spawnQueue = buildWave(n);
    this.spawnTimer = 0.7;
    this.intermission = 0;
    this.onBanner(`第 ${n} 波`);
    sfx.wave();
    this.onHud();
  }

  private updateWaves(dt: number) {
    if (this.intermission > 0) {
      this.intermission -= dt;
      if (this.intermission <= 0) this.startWave(this.wave + 1);
      return;
    }

    if (this.spawnQueue.length > 0) {
      const maxAlive = Math.min(8, 4 + Math.floor(this.wave / 2));
      if (this.enemies.length < maxAlive) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          const kind = this.spawnQueue.shift();
          if (kind) this.spawnEnemy(kind);
          this.spawnTimer = Math.max(0.62, 1.7 - this.wave * 0.09);
        }
      }
      return;
    }

    if (this.enemies.length === 0) {
      this.score += 60 * this.wave;
      this.texts.push({
        x: WIDTH / 2,
        y: HEIGHT / 2 - 40,
        text: `波次奖励 +${60 * this.wave}`,
        life: 1.5,
        color: '#ffd08a',
      });
      const spot = this.randomFreePoint();
      this.dropPowerup(spot.x, spot.y);
      this.intermission = 2.6;
      this.onBanner(`第 ${this.wave} 波 完成`);
      this.onHud();
    }
  }

  private spawnEnemy(kind: EnemyKind) {
    const point = SPAWN_POINTS[this.spawnIndex % SPAWN_POINTS.length];
    this.spawnIndex++;
    const e = createEnemy(kind, point.x + (Math.random() - 0.5) * 8, point.y);
    this.enemies.push(e);
  }

  private randomFreePoint() {
    for (let i = 0; i < 50; i++) {
      const x = 60 + Math.random() * (WIDTH - 120);
      const y = 60 + Math.random() * (HEIGHT - 200);
      if (!this.blocked(x, y, 24)) return { x, y };
    }
    return { x: WIDTH / 2, y: HEIGHT / 2 };
  }

  /* ---------------- 特效 ---------------- */

  addShake(v: number) {
    this.shake = Math.min(13, this.shake + v);
  }

  spark(x: number, y: number, color: string) {
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 260,
        vy: (Math.random() - 0.5) * 260,
        life: 0.25 + Math.random() * 0.2,
        max: 0.45,
        size: 1.4 + Math.random() * 1.6,
        color,
        drag: 4,
        grow: 0,
        glow: true,
      });
    }
  }

  dust(x: number, y: number) {
    this.particles.push({
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 22,
      vy: (Math.random() - 0.5) * 22,
      life: 0.5,
      max: 0.5,
      size: 3 + Math.random() * 3,
      color: 'rgba(140, 150, 165, 0.5)',
      drag: 2,
      grow: 6,
      glow: false,
    });
  }

  burst(x: number, y: number, count: number, color: string) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 320,
        vy: (Math.random() - 0.5) * 320,
        life: 0.3 + Math.random() * 0.3,
        max: 0.6,
        size: 1.6 + Math.random() * 2.4,
        color,
        drag: 4,
        grow: 0,
        glow: true,
      });
    }
  }

  explode(x: number, y: number, scale: number) {
    const count = Math.round(18 * scale);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 220 * scale;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.32 + Math.random() * 0.35,
        max: 0.67,
        size: 1.5 + Math.random() * 3,
        color: Math.random() < 0.5 ? '#ffb24d' : '#ffe9c2',
        drag: 3.2,
        grow: 0,
        glow: true,
      });
    }
    for (let i = 0; i < Math.round(8 * scale); i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 16,
        vx: Math.cos(a) * 36,
        vy: Math.sin(a) * 36 - 16,
        life: 0.6 + Math.random() * 0.5,
        max: 1.1,
        size: 4 + Math.random() * 6,
        color: 'rgba(70, 74, 82, 0.5)',
        drag: 1.6,
        grow: 12,
        glow: false,
      });
    }
  }

  private brickBurst(col: number, row: number) {
    const cx = col * TILE + TILE / 2;
    const cy = row * TILE + TILE / 2;
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 120;
      this.particles.push({
        x: cx + (Math.random() - 0.5) * TILE,
        y: cy + (Math.random() - 0.5) * TILE,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.25,
        max: 0.6,
        size: 2 + Math.random() * 2.5,
        color: Math.random() < 0.5 ? '#9c5540' : '#6b3729',
        drag: 3,
        grow: 0,
        glow: false,
      });
    }
  }

  float(text: string, x: number, y: number, color: string) {
    this.texts.push({ x, y, text, life: 1.1, color });
  }

  private updateParticles(dt: number) {
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      if (p.life <= 0) return false;
      p.vx -= p.vx * p.drag * dt;
      p.vy -= p.vy * p.drag * dt;
      p.vy += (p.grow > 0 ? 0 : 42) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += p.grow * dt;
      return true;
    });
    if (this.particles.length > 500) this.particles.splice(0, this.particles.length - 500);

    this.texts = this.texts.filter((t) => {
      t.life -= dt;
      t.y -= dt * 26;
      return t.life > 0;
    });
  }

  /** 联机客机只跑计时与特效，不做任何模拟 */
  tickVisuals(dt: number) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 32);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.4);
    this.base.flash = Math.max(0, this.base.flash - dt * 3);
    this.updateParticles(dt);
  }

  /** 供渲染层使用 */
  get shakeOffset() {
    if (this.shake < 0.2) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * this.shake,
      y: (Math.random() - 0.5) * this.shake,
    };
  }

  get playerBullets() {
    return this.bullets.filter((b) => b.team === 'player');
  }

  static readonly BASE_HALF = BASE_SIZE / 2;
}

export { ENEMY_STATS };
export type { Team };
