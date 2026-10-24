import { sfx } from '../../engine/audio';
import { TankGame } from './game';
import type { Mode, PowerupType, Tank, Team } from './types';

/** 快照中的坦克：只保留渲染与判定需要的最小字段 */
export interface TankSnap {
  id: number;
  team: Team;
  kind: string;
  owner?: string;
  x: number;
  y: number;
  r: number;
  hull: number;
  turret: number;
  hp: number;
  maxHp: number;
  inv: number;
  spawn: number;
  flash: number;
  muzzle: number;
  tread: number;
  moving: boolean;
  respawn: number;
}

export interface BulletSnap {
  x: number;
  y: number;
  vx: number;
  vy: number;
  team: Team;
  dmg: number;
  r: number;
}

export interface PowerupSnap {
  x: number;
  y: number;
  type: PowerupType;
  life: number;
  t: number;
}

export interface Snapshot {
  tick: number;
  tilesRev: number;
  /** 仅在房主端地形发生变化时才携带 */
  tiles?: number[];
  players: TankSnap[];
  enemies: TankSnap[];
  bullets: BulletSnap[];
  powerups: PowerupSnap[];
  base: { x: number; y: number; hp: number; maxHp: number; flash: number };
  score: number;
  wave: number;
  mode: Mode;
  overReason: string;
  rapidT: number;
  freezeT: number;
}

function packTank(t: Tank): TankSnap {
  return {
    id: t.id,
    team: t.team,
    kind: t.kind,
    owner: t.ownerId,
    x: Math.round(t.x * 10) / 10,
    y: Math.round(t.y * 10) / 10,
    r: t.r,
    hull: t.hullAngle,
    turret: t.turretAngle,
    hp: t.hp,
    maxHp: t.maxHp,
    inv: t.invuln,
    spawn: t.spawnT,
    flash: t.hitFlash,
    muzzle: t.muzzle,
    tread: Math.round(t.tread * 100) / 100,
    moving: t.moving,
    respawn: t.respawnT,
  };
}

/** 房主端：把当前模拟状态打包成快照 */
export function encodeSnapshot(g: TankGame, tick: number, sendTiles: boolean): Snapshot {
  const snap: Snapshot = {
    tick,
    tilesRev: g.tilesRev,
    players: g.players.map(packTank),
    enemies: g.enemies.map(packTank),
    bullets: g.bullets.map((b) => ({
      x: Math.round(b.x * 10) / 10,
      y: Math.round(b.y * 10) / 10,
      vx: b.vx,
      vy: b.vy,
      team: b.team,
      dmg: b.dmg,
      r: b.r,
    })),
    powerups: g.powerups.map((p) => ({ x: p.x, y: p.y, type: p.type, life: p.life, t: p.t })),
    base: { ...g.base },
    score: g.score,
    wave: g.wave,
    mode: g.mode,
    overReason: g.overReason,
    rapidT: g.rapidT,
    freezeT: g.freezeT,
  };
  if (sendTiles) snap.tiles = Array.from(g.tiles);
  return snap;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const angleLerp = (a: number, b: number, k: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
};

function lerpTank(a: TankSnap, b: TankSnap, k: number): Tank {
  return {
    id: b.id,
    team: b.team,
    kind: b.kind as Tank['kind'],
    ownerId: b.owner,
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    r: b.r,
    hullAngle: angleLerp(a.hull, b.hull, k),
    turretAngle: angleLerp(a.turret, b.turret, k),
    hp: b.hp,
    maxHp: b.maxHp,
    speed: 0,
    cooldown: 0,
    fireDelay: 0,
    bulletSpeed: 0,
    spawnT: b.spawn,
    invuln: b.inv,
    hitFlash: b.flash,
    muzzle: b.muzzle,
    tread: a.tread + (b.tread - a.tread) * k,
    moving: b.moving,
    respawnT: b.respawn,
    ai: null,
  };
}

const INTERP_DELAY = 0.1;
const MAX_BUFFER = 30;

/**
 * 客机视图：用快照插值还原画面，并根据快照差分补上音效与爆炸特效。
 * 不参与任何模拟，所有判定都在房主端完成。
 */
export class GuestView {
  readonly game: TankGame;
  readonly ownId = 'p2';
  onOver: (reason: string, score: number) => void = () => {};

  private buffer: Array<{ at: number; snap: Snapshot }> = [];
  private prev: Snapshot | null = null;
  private appliedTilesRev = -1;
  private overFired = false;

  constructor(best = 0) {
    this.game = new TankGame(best);
    this.game.localOwner = this.ownId;
    this.game.mode = 'menu';
    this.game.tilesRev = 0;
  }

  reset(best: number) {
    this.buffer = [];
    this.prev = null;
    this.appliedTilesRev = -1;
    this.overFired = false;
    const g = this.game;
    g.best = best;
    g.players = [];
    g.enemies = [];
    g.bullets = [];
    g.powerups = [];
    g.particles = [];
    g.texts = [];
    g.score = 0;
    g.wave = 0;
    g.overReason = '';
    g.mode = 'playing';
    g.tilesRev = 0;
  }

  push(snap: Snapshot) {
    const g = this.game;

    if (this.prev && this.prev.mode === 'over' && snap.mode === 'playing') {
      // 房主重开了新一局
      this.buffer = [];
      this.prev = null;
      g.particles = [];
      g.texts = [];
      this.overFired = false;
      this.appliedTilesRev = -1;
    }

    if (snap.tiles && snap.tilesRev !== this.appliedTilesRev) {
      g.tiles = new Uint8Array(snap.tiles);
      this.appliedTilesRev = snap.tilesRev;
    }

    const now = performance.now();
    this.buffer.push({ at: now, snap });
    if (this.buffer.length > MAX_BUFFER) this.buffer.shift();

    if (this.prev) this.applyEffects(this.prev, snap);
    this.prev = snap;
  }

  /** 每帧调用：插值并写回渲染用状态，同时推进本地特效 */
  update(dt: number, now: number) {
    if (this.buffer.length) {
      const target = now / 1000 - INTERP_DELAY;
      let index = -1;
      for (let i = 0; i < this.buffer.length; i++) {
        if (this.buffer[i].at / 1000 <= target) index = i;
        else break;
      }
      if (index < 0) index = 0;
      const a = this.buffer[index].snap;
      const b = this.buffer[Math.min(index + 1, this.buffer.length - 1)].snap;
      const span = this.buffer[Math.min(index + 1, this.buffer.length - 1)].at - this.buffer[index].at;
      const k = span > 0 ? clamp01((target - this.buffer[index].at / 1000) / (span / 1000)) : 1;
      this.apply(a, b, k, now);
    }
    this.game.tickVisuals(dt);
  }

  private apply(a: Snapshot, b: Snapshot, k: number, now: number) {
    const g = this.game;

    const prevPlayers = new Map(a.players.map((p) => [p.id, p]));
    g.players = b.players.map((p) => lerpTank(prevPlayers.get(p.id) ?? p, p, k));
    const prevEnemies = new Map(a.enemies.map((e) => [e.id, e]));
    g.enemies = b.enemies.map((e) => lerpTank(prevEnemies.get(e.id) ?? e, e, k));

    const ahead = Math.max(0, Math.min(0.06, now / 1000 - this.buffer[this.buffer.length - 1].at / 1000));
    g.bullets = b.bullets.map((bullet) => ({
      x: bullet.x + bullet.vx * ahead,
      y: bullet.y + bullet.vy * ahead,
      vx: bullet.vx,
      vy: bullet.vy,
      team: bullet.team,
      dmg: bullet.dmg,
      life: 1,
      r: bullet.r,
    }));
    g.powerups = b.powerups.map((p) => ({ ...p }));
    g.base = { ...b.base };
    g.score = b.score;
    g.wave = b.wave;
    g.mode = b.mode;
    g.overReason = b.overReason;
    g.rapidT = b.rapidT;

    if (b.mode === 'over' && !this.overFired) {
      this.overFired = true;
      this.onOver(b.overReason || '战斗结束', b.score);
    }
  }

  /** 用两份快照的差异推导音效与爆炸（客机不跑模拟，只能靠差分） */
  private applyEffects(prev: Snapshot, next: Snapshot) {
    const g = this.game;

    const aliveEnemies = new Set(next.enemies.map((e) => e.id));
    for (const e of prev.enemies) {
      if (e.hp > 0 && !aliveEnemies.has(e.id)) {
        g.explode(e.x, e.y, 1 + e.r / 16);
        g.addShake(5);
        sfx.explode();
      }
    }

    for (const p of next.players) {
      const old = prev.players.find((q) => q.id === p.id);
      if (!old) continue;
      if (p.hp < old.hp) {
        g.burst(p.x, p.y, 9, '#ff8f6b');
        sfx.hit();
        if (p.owner === this.ownId) {
          g.damageFlash = 1;
          g.addShake(7);
        }
      }
      if (old.hp > 0 && p.hp <= 0) g.explode(p.x, p.y, 1.8);
    }

    if (next.base.hp < prev.base.hp) {
      g.explode(next.base.x, next.base.y, 1.6);
      g.addShake(8);
      sfx.explode();
    }

    if (next.bullets.length > prev.bullets.length) {
      const added = next.bullets.slice(prev.bullets.length);
      if (added.some((b) => b.team === 'player')) sfx.shoot();
      if (added.some((b) => b.team === 'enemy')) sfx.enemyShoot();
    }

    if (next.wave !== prev.wave && next.wave > prev.wave) {
      g.onBanner(`第 ${next.wave} 波`);
      sfx.wave();
    }

    if (next.mode === 'over' && prev.mode !== 'over') {
      g.addShake(14);
      sfx.gameOver();
    }
  }
}
