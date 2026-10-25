import {
  BRICK,
  COLS,
  EMPTY,
  HEIGHT,
  PALETTE,
  ROWS,
  STEEL,
  TILE,
  TREE,
  WATER,
  WIDTH,
  BASE_SIZE,
} from './constants';
import type { TankGame } from './game';
import type { EnemyKind, PowerupType, Tank } from './types';

const ENEMY_COLORS: Record<EnemyKind, { body: string; dark: string; trim: string }> = {
  scout: { body: '#e0735f', dark: '#87362c', trim: '#ffb59f' },
  grunt: { body: '#d0556b', dark: '#7a2337', trim: '#ff9fb2' },
  heavy: { body: '#a06cd5', dark: '#523172', trim: '#d9b6ff' },
  boss: { body: '#9c4438', dark: '#3d1612', trim: '#ffbf6b' },
  elite: { body: '#e8c65c', dark: '#7a5611', trim: '#fff3b5' },
};

const POWER_COLORS: Record<PowerupType, string> = {
  repair: '#6fdca0',
  shield: '#6cccf5',
  rapid: '#f8b84f',
  freeze: '#8fd4ff',
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/* ---------------- 静态地面缓存 ---------------- */
let groundCanvas: HTMLCanvasElement | null = null;

function getGround() {
  if (groundCanvas) return groundCanvas;
  const c = document.createElement('canvas');
  c.width = WIDTH;
  c.height = HEIGHT;
  const g = c.getContext('2d')!;

  g.fillStyle = PALETTE.bg;
  g.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = g.createRadialGradient(WIDTH / 2, HEIGHT / 2, 40, WIDTH / 2, HEIGHT / 2, 620);
  glow.addColorStop(0, 'rgba(78, 100, 130, 0.16)');
  glow.addColorStop(1, 'rgba(8, 11, 15, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, WIDTH, HEIGHT);

  g.strokeStyle = PALETTE.grid;
  g.lineWidth = 1;
  for (let x = 0; x <= WIDTH; x += TILE) {
    g.beginPath();
    g.moveTo(x + 0.5, 0);
    g.lineTo(x + 0.5, HEIGHT);
    g.stroke();
  }
  for (let y = 0; y <= HEIGHT; y += TILE) {
    g.beginPath();
    g.moveTo(0, y + 0.5);
    g.lineTo(WIDTH, y + 0.5);
    g.stroke();
  }

  // 轻微地面噪点
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * WIDTH;
    const y = Math.random() * HEIGHT;
    const a = Math.random() * 0.05;
    g.fillStyle = `rgba(190, 210, 230, ${a})`;
    g.fillRect(x, y, 1.4, 1.4);
  }

  groundCanvas = c;
  return c;
}

/* ---------------- 地块 ---------------- */
function drawBrick(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = PALETTE.brickDark;
  ctx.fillRect(x, y, TILE, TILE);
  const pad = 2;
  const hw = TILE / 2;
  for (let j = 0; j < 2; j++) {
    for (let i = 0; i < 2; i++) {
      const bx = x + i * hw + pad;
      const by = y + j * hw + pad;
      const bw = hw - pad * 2;
      const bh = hw - pad * 2;
      ctx.fillStyle = j === 0 && i === 1 ? PALETTE.brickLight : PALETTE.brick;
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
      ctx.fillRect(bx, by, bw, 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
      ctx.fillRect(bx, by + bh - 2, bw, 2);
    }
  }
}

function drawSteel(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const grad = ctx.createLinearGradient(x, y, x + TILE, y + TILE);
  grad.addColorStop(0, PALETTE.steelLight);
  grad.addColorStop(0.55, PALETTE.steel);
  grad.addColorStop(1, PALETTE.steelDark);
  ctx.fillStyle = grad;
  ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 2.5, y + 2.5, TILE - 5, TILE - 5);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  for (const [dx, dy] of [
    [7, 7],
    [TILE - 7, 7],
    [7, TILE - 7],
    [TILE - 7, TILE - 7],
  ]) {
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWater(ctx: CanvasRenderingContext2D, x: number, y: number, col: number, row: number, t: number) {
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(x, y, TILE, TILE);
  const wobble = Math.sin(t * 1.8 + col * 0.8 + row * 0.55);
  ctx.strokeStyle = 'rgba(84, 176, 214, 0.45)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const yy = y + 9 + i * 11 + wobble * 2;
    ctx.beginPath();
    ctx.moveTo(x + 5, yy);
    ctx.quadraticCurveTo(x + TILE / 2, yy + 3.5, x + TILE - 5, yy);
    ctx.stroke();
  }
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, col: number, row: number, t: number) {
  const sway = Math.sin(t * 1.4 + col * 0.5 + row * 0.8) * 1.6;
  ctx.fillStyle = PALETTE.tree;
  ctx.beginPath();
  ctx.arc(x + 12 + sway, y + 26, 15, 0, Math.PI * 2);
  ctx.arc(x + 29 + sway, y + 15, 13, 0, Math.PI * 2);
  ctx.arc(x + 26 + sway, y + 31, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.treeLight;
  ctx.beginPath();
  ctx.arc(x + 15 + sway, y + 18, 8, 0, Math.PI * 2);
  ctx.arc(x + 26 + sway, y + 24, 7, 0, Math.PI * 2);
  ctx.fill();
}

/* ---------------- 基地 ---------------- */
function drawBase(ctx: CanvasRenderingContext2D, g: TankGame, t: number) {
  const { x, y, hp, maxHp, flash } = g.base;
  const s = BASE_SIZE;
  const half = s / 2;

  ctx.save();
  ctx.translate(x, y);

  // 基地无敌：显示青色护盾
  if (g.baseInvincible) {
    const shield = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.arc(0, 0, half + 10 + shield * 3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(108, 204, 245, ${0.06 + shield * 0.05})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(140, 224, 255, ${0.3 + shield * 0.25})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  roundRect(ctx, -half + 4, -half + 8, s, s, 14);
  ctx.fill();

  const grad = ctx.createLinearGradient(0, -half, 0, half);
  if (hp > 0) {
    grad.addColorStop(0, '#2b323d');
    grad.addColorStop(1, '#171c24');
  } else {
    grad.addColorStop(0, '#241a17');
    grad.addColorStop(1, '#12100f');
  }
  ctx.fillStyle = grad;
  roundRect(ctx, -half, -half, s, s, 13);
  ctx.fill();

  const accent = hp > 0 ? PALETTE.base : '#8a4a3a';
  ctx.strokeStyle = accent;
  ctx.globalAlpha = hp > 0 ? 0.9 : 0.5;
  ctx.lineWidth = 2.5;
  roundRect(ctx, -half + 4, -half + 4, s - 8, s - 8, 10);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 星形徽记
  const pulse = 0.72 + Math.sin(t * 2.2) * 0.08;
  ctx.fillStyle = hp > 0 ? accent : '#6b3428';
  ctx.globalAlpha = hp > 0 ? pulse : 0.55;
  ctx.beginPath();
  const outer = s * 0.29;
  const inner = outer * 0.44;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // 受损裂纹
  if (hp < maxHp) {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-half + 12, -8);
    ctx.lineTo(-10, 6);
    ctx.lineTo(-18, 20);
    ctx.stroke();
    if (hp <= 1) {
      ctx.beginPath();
      ctx.moveTo(half - 14, -22);
      ctx.lineTo(10, -4);
      ctx.lineTo(20, 12);
      ctx.stroke();
    }
  }

  if (flash > 0) {
    ctx.fillStyle = `rgba(255, 210, 150, ${flash * 0.55})`;
    roundRect(ctx, -half, -half, s, s, 13);
    ctx.fill();
  }

  ctx.restore();
}

/* ---------------- 坦克 ---------------- */
function drawTank(ctx: CanvasRenderingContext2D, g: TankGame, tank: Tank, t: number) {
  const isEnemy = tank.team === 'enemy';
  const palette = isEnemy
    ? ENEMY_COLORS[tank.kind as EnemyKind]
    : tank.ownerId === 'p2'
      ? { body: '#d9eef8', dark: '#7ea8bd', trim: '#5fd0e6' }
      : { body: PALETTE.playerHull, dark: '#8795a7', trim: PALETTE.playerTrim };

  const isBoss = tank.kind === 'boss';
  const isElite = tank.kind === 'elite';
  const isBig = isBoss || isElite;

  const scale = (tank.r / 14) * 1.2;
  const hl = 26 * scale;
  const hw = 20 * scale;

  if (tank.spawnT > 0) {
    const spawnMax = isBig ? 1.3 : 0.85;
    const k = clamp01(1 - tank.spawnT / spawnMax);
    ctx.save();
    ctx.globalAlpha = 0.25 + k * 0.5;
    ctx.strokeStyle = isBig ? '#ff8a5c' : '#ffb15c';
    ctx.lineWidth = isBig ? 3 : 2;
    ctx.beginPath();
    ctx.arc(tank.x, tank.y, (1 - k) * (isBig ? 56 : 34) + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(tank.x, tank.y, isBig ? 56 : 34, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 177, 92, 0.22)';
    ctx.stroke();
    ctx.restore();
  }

  // Boss / 精英的气场光环
  if (isBig) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = isBoss
      ? `rgba(255, 106, 74, ${0.22 + pulse * 0.28})`
      : `rgba(255, 214, 106, ${0.2 + pulse * 0.26})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(tank.x, tank.y, tank.r + 6 + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const blink =
    tank.invuln > 0 && tank.team === 'player'
      ? 0.55 + 0.45 * Math.sin(t * 22)
      : 1;

  ctx.save();
  ctx.translate(tank.x, tank.y);

  // 影子（双层，靠近车体更实）
  ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
  ctx.beginPath();
  ctx.ellipse(3, 5, hl + 4, hw + 4, tank.hullAngle, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
  ctx.beginPath();
  ctx.ellipse(2, 3, hl, hw, tank.hullAngle, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = blink;

  // 车体
  ctx.save();
  ctx.rotate(tank.hullAngle);

  const tread = tank.tread % 1;
  const treadH = 9 * scale;
  for (const sy of [-hw, hw - treadH]) {
    // 履带底座
    const trackGrad = ctx.createLinearGradient(0, sy, 0, sy + treadH);
    trackGrad.addColorStop(0, '#3b4553');
    trackGrad.addColorStop(0.45, '#20262e');
    trackGrad.addColorStop(1, '#15191f');
    roundRect(ctx, -hl, sy, hl * 2, treadH, 3.5 * scale);
    ctx.fillStyle = trackGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 履带板
    const gap = 9 * scale;
    const offset = tread * gap;
    for (let x = -hl + 2 + offset; x < hl - 2; x += gap) {
      roundRect(ctx, x, sy + 1 * scale, 5.4 * scale, treadH - 2 * scale, 1.6 * scale);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.17)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // 负重轮
    const wheelR = 2.1 * scale;
    for (let i = 0; i < 4; i++) {
      const wx = -hl + treadH * 0.95 + i * ((hl * 2 - treadH * 1.9) / 3);
      ctx.beginPath();
      ctx.arc(wx, sy + treadH / 2, wheelR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10, 14, 18, 0.8)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(wx - wheelR * 0.3, sy + treadH / 2 - wheelR * 0.3, wheelR * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fill();
    }
  }

  const bodyTop = -hw + 10 * scale;
  const bodyH = (hw - 10) * 2;
  const bodyLeft = -hl + 3 * scale;
  const bodyW = (hl - 3) * 2;
  const bodyR = 5 * scale;

  // 车体底色
  roundRect(ctx, bodyLeft, bodyTop, bodyW, bodyH, bodyR);
  ctx.fillStyle = palette.body;
  ctx.fill();

  // 金属明暗：上亮下暗，塑造立体感
  const grad = ctx.createLinearGradient(0, bodyTop, 0, bodyTop + bodyH);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.26)');
  grad.addColorStop(0.28, 'rgba(255, 255, 255, 0.06)');
  grad.addColorStop(0.62, 'rgba(0, 0, 0, 0.1)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.48)');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 顶部棱线高光
  ctx.beginPath();
  ctx.moveTo(bodyLeft + 3 * scale, bodyTop + 1.4);
  ctx.lineTo(bodyLeft + bodyW - 3 * scale, bodyTop + 1.4);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // 装甲板接缝
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 1;
  for (const px of [-hl * 0.4, hl * 0.4]) {
    ctx.beginPath();
    ctx.moveTo(px, bodyTop + 2.5 * scale);
    ctx.lineTo(px, bodyTop + bodyH - 2.5 * scale);
    ctx.stroke();
  }

  // 铆钉
  for (const rx of [-hl * 0.68, hl * 0.68]) {
    for (const ry of [-hw * 0.38, hw * 0.38]) {
      ctx.beginPath();
      ctx.arc(rx, ry, 1.3 * scale, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
  }

  // 斜向高光（金属反光）
  ctx.save();
  roundRect(ctx, bodyLeft, bodyTop, bodyW, bodyH, bodyR);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  const sheen = ctx.createLinearGradient(-hl, -hw, hl * 0.3, hw);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0)');
  sheen.addColorStop(0.42, 'rgba(255, 255, 255, 0.1)');
  sheen.addColorStop(0.56, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(bodyLeft, bodyTop, bodyW, bodyH);
  ctx.restore();

  // Boss / 精英的附加装甲
  if (isBig) {
    ctx.strokeStyle = isBoss ? 'rgba(255, 191, 107, 0.55)' : 'rgba(255, 243, 181, 0.6)';
    ctx.lineWidth = 1.4;
    roundRect(ctx, -hl * 0.78, -hw * 0.5, hl * 1.3, hw, 4 * scale);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    for (const px of [-hl * 0.5, 0, hl * 0.5]) {
      ctx.beginPath();
      ctx.arc(px, -hw * 0.22, 1.8 * scale, 0, Math.PI * 2);
      ctx.arc(px, hw * 0.22, 1.8 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // 炮塔
  ctx.save();
  ctx.rotate(tank.turretAngle);
  roundRect(ctx, 0, -3.2 * scale, hl + 6 * scale, 6.4 * scale, 2.4 * scale);
  if (isEnemy) {
    const barrel = ctx.createLinearGradient(0, -3.2 * scale, 0, 3.2 * scale);
    barrel.addColorStop(0, palette.trim);
    barrel.addColorStop(0.45, palette.body);
    barrel.addColorStop(1, palette.dark);
    ctx.fillStyle = barrel;
  } else if (tank.ownerId === 'p2') {
    const barrel = ctx.createLinearGradient(0, -3.2 * scale, 0, 3.2 * scale);
    barrel.addColorStop(0, '#9be6f7');
    barrel.addColorStop(0.5, '#5fc6df');
    barrel.addColorStop(1, '#2f7e95');
    ctx.fillStyle = barrel;
  } else {
    const barrel = ctx.createLinearGradient(0, -3.2 * scale, 0, 3.2 * scale);
    barrel.addColorStop(0, '#f7c471');
    barrel.addColorStop(0.5, '#e3a44a');
    barrel.addColorStop(1, '#a9762c');
    ctx.fillStyle = barrel;
  }
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 炮管顶部高光
  ctx.beginPath();
  ctx.moveTo(2 * scale, -2.5 * scale);
  ctx.lineTo(hl + 3 * scale, -2.5 * scale);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
  ctx.lineWidth = 0.9;
  ctx.stroke();

  if (!isEnemy) {
    // 炮口制退器
    roundRect(ctx, hl + 3 * scale, -4.6 * scale, 4.4 * scale, 9.2 * scale, 1.8 * scale);
    ctx.fillStyle = '#8b5f22';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 226, 170, 0.5)';
    ctx.stroke();
  }

  // 炮塔座圈（带高光）
  const ring = ctx.createRadialGradient(-3.2 * scale, -3.2 * scale, 1, 0, 0, 11 * scale);
  ring.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
  ring.addColorStop(0.4, palette.body);
  ring.addColorStop(1, palette.dark);
  ctx.beginPath();
  ctx.arc(0, 0, 10 * scale, 0, Math.PI * 2);
  ctx.fillStyle = ring;
  ctx.fill();
  ctx.strokeStyle = palette.trim;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // 座圈上沿反光
  ctx.beginPath();
  ctx.arc(0, 0, 8.4 * scale, -Math.PI * 0.92, -Math.PI * 0.12);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.3 * scale;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, 6.2 * scale, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 3.2 * scale, 0, Math.PI * 2);
  ctx.fillStyle = palette.trim;
  ctx.fill();

  if (tank.muzzle > 0) {
    const k = tank.muzzle / 0.07;
    ctx.fillStyle = `rgba(255, 225, 160, ${k})`;
    ctx.beginPath();
    ctx.arc(hl + 10 * scale, 0, 7 * scale * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 170, 70, ${k * 0.8})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hl + 4 * scale, -6 * scale * k);
    ctx.lineTo(hl + 16 * scale, 0);
    ctx.lineTo(hl + 4 * scale, 6 * scale * k);
    ctx.stroke();
  }
  ctx.restore();

  // 冻结算覆层
  if (g.freezeT > 0 && isEnemy) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(96, 190, 255, 0.22)';
    ctx.beginPath();
    ctx.arc(0, 0, hl, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  // 受击白闪
  if (tank.hitFlash > 0) {
    ctx.globalAlpha = tank.hitFlash * 0.6;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, hl * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 敌方血条（Boss / 精英常驻显示，并标注身份）
  if (isEnemy && (tank.hp < tank.maxHp || isBig)) {
    const w = isBig ? 54 : 28;
    const h = isBig ? 5 : 3;
    const y = -hw - (isBig ? 16 : 12);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(-w / 2, y, w, h);
    ctx.fillStyle = isBoss
      ? '#ff8a5c'
      : isElite
        ? '#ffe27a'
        : tank.kind === 'heavy'
          ? '#c9a2ff'
          : '#ff9a9a';
    ctx.fillRect(-w / 2, y, (w * Math.max(0, tank.hp)) / tank.maxHp, h);
    if (isBig) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-w / 2, y, w, h);
      ctx.fillStyle = isBoss ? '#ffb98c' : '#ffe9a3';
      ctx.font = '700 9px "SF Mono", Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(isBoss ? 'BOSS' : '精英', 0, y - 4);
    }
  }

  ctx.restore();
}

/* ---------------- 子弹 / 补给 / 粒子 ---------------- */
function drawBullet(ctx: CanvasRenderingContext2D, b: { x: number; y: number; vx: number; vy: number; team: string }) {
  const color = b.team === 'player' ? '#ffd490' : '#ff9a9a';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(b.x, b.y, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPowerup(
  ctx: CanvasRenderingContext2D,
  p: { x: number; y: number; type: PowerupType; life: number; t: number }
) {
  const color = POWER_COLORS[p.type];
  const alpha = p.life < 3 ? 0.45 + 0.55 * Math.abs(Math.sin(p.life * 8)) : 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(p.x, p.y + Math.sin(p.t * 3) * 3);

  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = 'rgba(12, 20, 26, 0.9)';
  roundRect(ctx, -14, -14, 28, 28, 8);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  switch (p.type) {
    case 'repair':
      ctx.fillRect(-2, -7, 4, 14);
      ctx.fillRect(-7, -2, 14, 4);
      break;
    case 'shield':
      ctx.moveTo(0, -8);
      ctx.lineTo(7, -4);
      ctx.lineTo(6, 3);
      ctx.quadraticCurveTo(4, 7.5, 0, 8);
      ctx.quadraticCurveTo(-4, 7.5, -6, 3);
      ctx.lineTo(-7, -4);
      ctx.closePath();
      ctx.stroke();
      break;
    case 'rapid':
      ctx.moveTo(1, -8);
      ctx.lineTo(-5, 1);
      ctx.lineTo(0, 1);
      ctx.lineTo(-2, 8);
      ctx.lineTo(5, -2);
      ctx.lineTo(0, -2);
      ctx.closePath();
      ctx.fill();
      break;
    case 'freeze':
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        ctx.moveTo(Math.cos(a) * -7, Math.sin(a) * -7);
        ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7);
      }
      ctx.stroke();
      break;
  }
  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, g: TankGame) {
  ctx.save();
  for (const p of g.particles) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    if (p.glow) ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.4, p.size), 0, Math.PI * 2);
    ctx.fill();
    if (p.glow) ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '600 13px "SF Mono", Consolas, monospace';
  for (const t of g.texts) {
    ctx.globalAlpha = Math.min(1, t.life * 1.6);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.restore();
}

/* ---------------- 主绘制 ---------------- */
export function drawGame(
  ctx: CanvasRenderingContext2D,
  g: TankGame,
  pointer: { x: number; y: number; active?: boolean },
  time: number
) {
  const shake = g.shakeOffset;
  ctx.save();
  ctx.translate(shake.x, shake.y);

  ctx.drawImage(getGround(), 0, 0);

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const code = g.tiles[row * COLS + col];
      if (code === EMPTY || code === TREE) continue;
      const x = col * TILE;
      const y = row * TILE;
      if (code === BRICK) drawBrick(ctx, x, y);
      else if (code === STEEL) drawSteel(ctx, x, y);
      else if (code === WATER) drawWater(ctx, x, y, col, row, time);
    }
  }

  drawBase(ctx, g, time);

  for (const p of g.powerups) drawPowerup(ctx, p);

  for (const b of g.bullets) drawBullet(ctx, b);

  for (const p of g.players) {
    if (p.hp > 0 || p.spawnT > 0) drawTank(ctx, g, p, time);
  }
  for (const e of g.enemies) drawTank(ctx, g, e, time);

  // 树丛盖在坦克上方
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (g.tiles[row * COLS + col] === TREE) {
        drawTree(ctx, col * TILE, row * TILE, col, row, time);
      }
    }
  }

  drawParticles(ctx, g);

  ctx.restore();

  // 受击红色边缘
  if (g.damageFlash > 0) {
    const a = g.damageFlash * 0.3;
    const grad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.28, WIDTH / 2, HEIGHT / 2, HEIGHT * 0.78);
    grad.addColorStop(0, 'rgba(255, 60, 40, 0)');
    grad.addColorStop(1, `rgba(255, 60, 40, ${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  // 冻结时轻微冷色
  if (g.freezeT > 0) {
    ctx.fillStyle = 'rgba(90, 180, 255, 0.05)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  if (g.mode === 'playing' && pointer.active) drawReticle(ctx, pointer, g);
}

function drawReticle(
  ctx: CanvasRenderingContext2D,
  pointer: { x: number; y: number },
  g: TankGame
) {
  ctx.save();
  ctx.translate(pointer.x, pointer.y);
  ctx.strokeStyle = 'rgba(242, 166, 59, 0.9)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(242, 166, 59, 0.55)';
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 14, Math.sin(a) * 14);
    ctx.lineTo(Math.cos(a) * 19, Math.sin(a) * 19);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255, 225, 180, 0.95)';
  ctx.beginPath();
  ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
  ctx.fill();

  if (g.rapidT > 0) {
    ctx.strokeStyle = 'rgba(255, 200, 110, 0.5)';
    ctx.beginPath();
    ctx.arc(0, 0, 15, -0.4, 0.4);
    ctx.stroke();
  }
  ctx.restore();
}
