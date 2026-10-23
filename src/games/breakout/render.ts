import { HEIGHT, PADDLE_H, ROW_COLORS, WIDTH } from './constants';
import type { BreakoutGame, Brick } from './game';

function drawBrick(ctx: CanvasRenderingContext2D, brick: Brick) {
  const color = ROW_COLORS[brick.row % ROW_COLORS.length];
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(brick.x, brick.y, brick.w, brick.h, 6);
  ctx.fill();

  ctx.globalAlpha = brick.hp > 1 ? 0.95 : 0.6;
  ctx.strokeStyle = color;
  ctx.lineWidth = brick.hp > 1 ? 2 : 1.2;
  ctx.stroke();

  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(brick.x + 3, brick.y + 3, brick.w - 6, 5, 3);
  ctx.fill();

  if (brick.hp > 1) {
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(brick.x + 5, brick.y + 5, brick.w - 10, brick.h - 10, 4);
    ctx.stroke();
  }

  if (brick.flash > 0) {
    ctx.globalAlpha = brick.flash * 0.55;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(brick.x, brick.y, brick.w, brick.h, 6);
    ctx.fill();
  }
  ctx.restore();
}

export function drawGame(ctx: CanvasRenderingContext2D, game: BreakoutGame, now: number) {
  ctx.save();
  if (game.shake > 0.1) {
    ctx.translate(
      (Math.random() - 0.5) * game.shake,
      (Math.random() - 0.5) * game.shake
    );
  }

  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, '#0b1119');
  bg.addColorStop(0.62, '#080b10');
  bg.addColorStop(1, '#05070a');
  ctx.fillStyle = bg;
  ctx.fillRect(-30, -30, WIDTH + 60, HEIGHT + 60);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.028)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 40; x < WIDTH; x += 40) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
  }
  for (let y = 40; y < HEIGHT; y += 40) {
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
  }
  ctx.stroke();

  const glow = ctx.createRadialGradient(WIDTH / 2, 40, 10, WIDTH / 2, 40, 460);
  glow.addColorStop(0, 'rgba(242, 166, 59, 0.1)');
  glow.addColorStop(1, 'rgba(242, 166, 59, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = 'rgba(255, 120, 110, 0.22)';
  ctx.fillRect(0, HEIGHT - 5, WIDTH, 2);

  for (const brick of game.bricks) drawBrick(ctx, brick);

  // 补给胶囊
  for (const c of game.capsules) {
    const isWide = c.type === 'wide';
    const color = isWide ? '#f2a63b' : '#5ec8e6';
    const pulse = 1 + Math.sin(now * 6 + c.x) * 0.06;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = isWide ? 'rgba(242, 166, 59, 0.18)' : 'rgba(94, 200, 230, 0.18)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-11, -11, 22, 22, 6);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.font = '600 11px "SF Mono", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isWide ? 'W' : 'M', 0, 0.5);
    ctx.restore();
  }

  // 挡板
  const p = game.paddle;
  ctx.save();
  ctx.shadowColor = 'rgba(242, 166, 59, 0.55)';
  ctx.shadowBlur = 22;
  const pg = ctx.createLinearGradient(0, p.y, 0, p.y + PADDLE_H);
  pg.addColorStop(0, '#f4f9ff');
  pg.addColorStop(0.55, '#c2d2e2');
  pg.addColorStop(1, '#8b9fb2');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.roundRect(p.x - p.w / 2, p.y, p.w, PADDLE_H, 8);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(242, 166, 59, 0.9)';
  ctx.beginPath();
  ctx.roundRect(p.x - p.w / 2, p.y + PADDLE_H - 3, p.w, 3, 2);
  ctx.fill();
  ctx.restore();

  // 球与拖尾
  for (const b of game.balls) {
    for (let i = b.trail.length - 1; i >= 0; i--) {
      const t = b.trail[i];
      const alpha = (1 - i / b.trail.length) * 0.34;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffd79a';
      ctx.beginPath();
      ctx.arc(t.x, t.y, b.r * (1 - i / (b.trail.length + 4)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.shadowColor = '#ffd08a';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#fff8ec';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 粒子
  for (const p2 of game.particles) {
    ctx.globalAlpha = Math.max(0, p2.life / p2.max);
    ctx.fillStyle = p2.color;
    ctx.fillRect(p2.x - p2.size / 2, p2.y - p2.size / 2, p2.size, p2.size);
  }
  ctx.globalAlpha = 1;

  // 连击提示
  if (game.combo >= 3 && game.mode === 'playing') {
    const mult = Math.min(1 + Math.floor(game.combo / 3), 5);
    ctx.save();
    ctx.globalAlpha = Math.min(1, game.comboTimer / 1.2);
    ctx.fillStyle = '#ffd08a';
    ctx.font = '600 15px "SF Mono", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`连击 x${mult}`, WIDTH / 2, p.y - 44);
    ctx.restore();
  }

  if (game.flash > 0.01) {
    ctx.fillStyle = `rgba(255, 206, 130, ${game.flash * 0.16})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  ctx.restore();
}
