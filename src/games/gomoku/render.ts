import { BOARD_W, BOARD_X, BOARD_Y, CELL, HEIGHT, SIZE, STONE_R, WIDTH } from './constants';
import type { GomokuGame } from './game';

const px = (x: number) => BOARD_X + x * CELL;
const py = (y: number) => BOARD_Y + y * CELL;

const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const STARS = [
  [3, 3],
  [11, 3],
  [7, 7],
  [3, 11],
  [11, 11],
];

function drawStone(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  player: number,
  scale: number
) {
  if (scale <= 0.02) return;
  const r = STONE_R * scale;

  ctx.save();
  ctx.translate(cx, cy);

  ctx.globalAlpha = 0.35 * scale;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(1.5, 2.5, r * 0.98, r * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const g = ctx.createRadialGradient(-r * 0.32, -r * 0.38, r * 0.1, 0, 0, r * 1.05);
  if (player === 1) {
    g.addColorStop(0, '#75808f');
    g.addColorStop(0.45, '#2a313b');
    g.addColorStop(1, '#080b10');
  } else {
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#f3ecdc');
    g.addColorStop(1, '#b8ad96');
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = player === 1 ? 'rgba(255, 255, 255, 0.16)' : 'rgba(78, 62, 34, 0.32)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  if (player === 2) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.36, r * 0.32, r * 0.18, -0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

export function drawGame(ctx: CanvasRenderingContext2D, game: GomokuGame, now: number) {
  ctx.save();
  if (game.shake > 0.1) {
    ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
  }

  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, '#05070d');
  bg.addColorStop(0.65, '#08080c');
  bg.addColorStop(1, '#040507');
  ctx.fillStyle = bg;
  ctx.fillRect(-40, -40, WIDTH + 80, HEIGHT + 80);

  const glow = ctx.createRadialGradient(WIDTH / 2, py(7), 60, WIDTH / 2, py(7), 460);
  glow.addColorStop(0, 'rgba(242, 166, 59, 0.09)');
  glow.addColorStop(1, 'rgba(242, 166, 59, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 棋盘底板
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  const panel = ctx.createLinearGradient(BOARD_X, BOARD_Y, BOARD_X + BOARD_W, BOARD_Y + BOARD_W);
  panel.addColorStop(0, '#3a2c1f');
  panel.addColorStop(0.55, '#2c2117');
  panel.addColorStop(1, '#1d1711');
  ctx.fillStyle = panel;
  ctx.beginPath();
  ctx.roundRect(BOARD_X - 16, BOARD_Y - 16, BOARD_W + 32, BOARD_W + 32, 12);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(242, 197, 133, 0.24)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(BOARD_X - 16, BOARD_Y - 16, BOARD_W + 32, BOARD_W + 32, 12);
  ctx.stroke();

  // 木纹
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = '#7a5a38';
  ctx.lineWidth = 1;
  for (let i = 1; i < 9; i++) {
    const yy = BOARD_Y - 16 + i * 68;
    ctx.beginPath();
    ctx.moveTo(BOARD_X - 8, yy);
    ctx.bezierCurveTo(
      BOARD_X + BOARD_W * 0.3,
      yy - 8,
      BOARD_X + BOARD_W * 0.7,
      yy + 8,
      BOARD_X + BOARD_W + 8,
      yy - 2
    );
    ctx.stroke();
  }
  ctx.restore();

  // 网格
  ctx.strokeStyle = 'rgba(236, 214, 178, 0.28)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let i = 0; i < SIZE; i++) {
    ctx.moveTo(px(0), py(i));
    ctx.lineTo(px(SIZE - 1), py(i));
    ctx.moveTo(px(i), py(0));
    ctx.lineTo(px(i), py(SIZE - 1));
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(236, 214, 178, 0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(px(0), py(0), BOARD_W, BOARD_W);

  ctx.fillStyle = 'rgba(236, 214, 178, 0.75)';
  for (const [sx, sy] of STARS) {
    ctx.beginPath();
    ctx.arc(px(sx), py(sy), 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // 落子预览
  if (game.hover && game.canPlace) {
    const idx = game.hover.y * SIZE + game.hover.x;
    if (game.board[idx] === 0) {
      ctx.globalAlpha = 0.45;
      drawStone(ctx, px(game.hover.x), py(game.hover.y), 1, 1);
      ctx.globalAlpha = 1;
    }
  }

  // 棋子
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const p = game.board[y * SIZE + x];
      if (!p) continue;
      const idx = y * SIZE + x;
      const born = game.stonesAt.get(idx) ?? 0;
      const age = Math.min(1, Math.max(0, (game.time - born) / 0.18));
      const scale = age >= 1 ? 1 : Math.max(0.05, easeOutBack(age));
      drawStone(ctx, px(x), py(y), p, scale);
    }
  }

  // 最后一手标记
  if (game.lastMove) {
    const { x, y } = game.lastMove;
    ctx.strokeStyle = 'rgba(242, 166, 59, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px(x), py(y), 6.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 胜利连线
  if (game.winLine.length >= 2) {
    const a = game.winLine[0];
    const b = game.winLine[game.winLine.length - 1];
    const pulse = 0.6 + Math.sin(now * 6) * 0.4;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = '#ffd08a';
    ctx.shadowColor = '#f2a63b';
    ctx.shadowBlur = 16;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px(a.x), py(a.y));
    ctx.lineTo(px(b.x), py(b.y));
    ctx.stroke();
    ctx.restore();

    for (const c of game.winLine) {
      ctx.strokeStyle = `rgba(255, 208, 138, ${0.5 + pulse * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px(c.x), py(c.y), STONE_R + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // 粒子
  for (const b of game.bursts) {
    ctx.globalAlpha = Math.max(0, b.life / b.max);
    ctx.fillStyle = b.color;
    ctx.fillRect(px(b.x) - b.size / 2, py(b.y) - b.size / 2, b.size, b.size);
  }
  ctx.globalAlpha = 1;

  if (game.flash > 0.01) {
    ctx.fillStyle = `rgba(255, 224, 180, ${game.flash * 0.14})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  ctx.restore();
}
