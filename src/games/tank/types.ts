export type Team = 'player' | 'enemy';
export type EnemyKind = 'scout' | 'grunt' | 'heavy' | 'boss' | 'elite';
export type PowerupType = 'repair' | 'shield' | 'rapid' | 'freeze';
export type Mode = 'menu' | 'playing' | 'paused' | 'over';

export interface Tank {
  id: number;
  team: Team;
  kind: 'player' | EnemyKind;
  /** 玩家坦克的归属（单人/房主为 p1，队友为 p2）；敌人为空 */
  ownerId?: string;
  x: number;
  y: number;
  r: number;
  hullAngle: number;
  turretAngle: number;
  hp: number;
  maxHp: number;
  speed: number;
  cooldown: number;
  fireDelay: number;
  bulletSpeed: number;
  /** >0 表示正在传送入场 */
  spawnT: number;
  invuln: number;
  hitFlash: number;
  muzzle: number;
  tread: number;
  moving: boolean;
  /** >0 表示阵亡后的复活倒计时（联机合作） */
  respawnT: number;
  /** 击毁该敌人获得的分数（Boss / 精英随关卡缩放） */
  score?: number;
  ai: { dir: number; retarget: number; blocked: number } | null;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  team: Team;
  /** 发射者（玩家子弹用于分摊射击上限，不参与渲染） */
  owner?: string;
  dmg: number;
  life: number;
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
  drag: number;
  grow: number;
  glow: boolean;
}

export interface Powerup {
  x: number;
  y: number;
  type: PowerupType;
  life: number;
  t: number;
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

export interface BaseState {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  flash: number;
}
