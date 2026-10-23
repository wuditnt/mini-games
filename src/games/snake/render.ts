import { CELL, COLS, GRID_TOP, HEIGHT, ROWS, WIDTH } from './constants';
import type { Dir, SnakeGame } from './game';

const DIR_VEC: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const boardH = ROWS * CELL;

function drawFood(ctx: CanvasRenderingContext2D, game: SnakeGame, now: number) {
  const f = game.food;
  if (!f) return;
  const cx = f.x * CELL + CELL / 2;
  const cy = GRID_TOP + f.y * CELL + CELL / 2;
  const pulse = 1 + Math.sin(now * 4.2) * 0.07;
  const gold = f.kind === 'gold';

  ctx.save();
  ctx.translate(cx, cy);

  ctx.globalAlpha = 0.22;
  ctx.fillStyle = gold ? '#ffd76a' : '#ff7a5c';
  ctx.beginPath();
  ctx.arc(0, 0, 20 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const g = ctx.createRadialGradient(-3, -3, 2, 0, 0, 11 * pulse);
  if (gold) {
    g.addColorStop(0, '#fff3c4');
    g.addColorStop(0.6, '#ffd76a');
    g.addColorStop(1, '#d99b1e');
  } else {
    g.addColorStop(0, '#ffb199');
    g.addColorStop(0.6, '#ff7a5c');
    g.addColorStop(1, '#c33c33');
  }

  ctx.shadowColor = gold ? '#ffd76a' : '#ff7a5c';
  ctx.shadowBlur = 16;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 9.5 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#7ce0a3';
  ctx.beginPath();
  ctx.ellipse(4, -10, 4.4, 2.2, -0.6, 0, Math.PI * 2);
  ctx.fill();

  if (gold) {
    ctx.save();
    ctx.rotate(now * 1.6);
    ctx.strokeStyle = 'rgba(255, 246, 200, 0.65)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawSnake(ctx: CanvasRenderingContext2D, game: SnakeGame) {
  if (!game.body.length) return;
  const t = game.mode === 'playing' ? Math.min(1, game.acc / game.interval) : 1;
  const len = game.body.length;

  for (let i = len - 1; i >= 0; i--) {
    const cur = game.body[i];
    const prev = game.prevBody[i] ?? game.prevBody[game.prevBody.length - 1] ?? cur;
    const gx = prev.x + (cur.x - prev.x) * t;
    const gy = prev.y + (cur.y - prev.y) * t;
    const cx = gx * CELL + CELL / 2;
    const cy = GRID_TOP + gy * CELL + CELL / 2;

    const f = len > 1 ? i / (len - 1) : 0;
    const hue = 190 - f * 16;
    const light = 64 - f * 24;
    const size = CELL - 4 - f * 3;

    if (i === 0) {
      ctx.save();
      ctx.shadowColor = '#8ff2ff';
      ctx.shadowBlur = 18;
    }

    ctx.fillStyle = `hsl(${hue}, ${80 - f * 26}%, ${light}%)`;
    ctx.beginPath();
    ctx.roundRect(cx - size / 2, cy - size / 2, size, size, 8);
    ctx.fill();

    if (i === 0) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(220, 252, 255, 0.9)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }
  }

  // 蛇头眼睛
  const head = game.body[0];
  const prevHead = game.prevBody[0] ?? head;
  const hx = (prevHead.x + (head.x - prevHead.x) * t) * CELL + CELL / 2;
  const hy = GRID_TOP + (prevHead.y + (head.y - prevHead.y) * t) * CELL + CELL / 2;
  const d = DIR_VEC[game.dir];
  const px = -d.y;
  const py = d.x;

  for (const side of [-1, 1]) {
    const ex = hx + d.x * 4 + px * 6.5 * side;
    const ey = hy + d.y * 4 + py * 6.5 * side;
    ctx.fillStyle = '#f7feff';
    ctx.beginPath();
    ctx.arc(ex, ey, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b1a22';
    ctx.beginPath();
    ctx.arc(ex + d.x * 1.2, ey + d.y * 1.2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 连击提示
  if (game.combo >= 2 && game.mode === 'playing') {
    const alpha = Math.min(1, game.comboTimer / 0.8);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffd08a';
    ctx.shadowColor = '#f2a63b';
    ctx.shadowBlur = 14;
    ctx.font = '700 20px "SF Mono", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`连击 ×${game.combo}`, WIDTH / 2, GRID_TOP + 52);
    ctx.restore();
  }
}

export function drawGame(ctx: CanvasRenderingContext2D, game: SnakeGame, now: number) {
  ctx.save();
  if (game.shake > 0.1) {
    ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
  }

  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, '#05070d');
  bg.addColorStop(0.6, '#070a12');
  bg.addColorStop(1, '#040509');
  ctx.fillStyle = bg;
  ctx.fillRect(-40, -40, WIDTH + 80, HEIGHT + 80);

  const halo = ctx.createRadialGradient(WIDTH / 2, GRID_TOP + boardH / 2, 40, WIDTH / 2, GRID_TOP + boardH / 2, 520);
  halo.addColorStop(0, 'rgba(94, 200, 230, 0.07)');
  halo.addColorStop(1, 'rgba(94, 200, 230, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 棋盘
  ctx.fillStyle = 'rgba(8, 12, 20, 0.72)';
  ctx.beginPath();
  ctx.roundRect(0, GRID_TOP, WIDTH, boardH, 14);
  ctx.fill();

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if ((x + y) % 2 === 0) continue;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.014)';
      ctx.fillRect(x * CELL, GRID_TOP + y * CELL, CELL, CELL);
    }
  }

  ctx.strokeStyle = 'rgba(94, 200, 230, 0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 1; x < COLS; x++) {
    ctx.moveTo(x * CELL, GRID_TOP);
    ctx.lineTo(x * CELL, GRID_TOP + boardH);
  }
  for (let y = 1; y < ROWS; y++) {
    ctx.moveTo(0, GRID_TOP + y * CELL);
    ctx.lineTo(WIDTH, GRID_TOP + y * CELL);
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(94, 200, 230, 0.34)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(1, GRID_TOP + 1, WIDTH - 2, boardH - 2, 14);
  ctx.stroke();

  drawFood(ctx, game, now);
  drawSnake(ctx, game);

  for (const p of game.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.font = '700 18px "SF Mono", Consolas, monospace';
  for (const f of game.floats) {
    ctx.globalAlpha = Math.max(0, f.life / f.max);
    ctx.fillStyle = f.gold ? '#ffe9a8' : '#ffc9b3';
    ctx.fillText(f.text, f.x * CELL + CELL / 2, GRID_TOP + f.y * CELL + 20);
  }
  ctx.globalAlpha = 1;

  if (game.flash > 0.01) {
    ctx.fillStyle = `rgba(190, 235, 255, ${game.flash * 0.18})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  ctx.restore();
}
