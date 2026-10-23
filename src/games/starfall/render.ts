import { GRAZE_R, HEIGHT, PLAYER_HIT_R, WIDTH } from './constants';
import type { Enemy, StarfallGame } from './game';

interface Star {
  x: number;
  y: number;
  z: number;
  s: number;
}

const stars: Star[] = Array.from({ length: 140 }, () => ({
  x: Math.random() * WIDTH,
  y: Math.random() * HEIGHT,
  z: 0.3 + Math.random() * 1.15,
  s: 0.5 + Math.random() * 1.5,
}));

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, now: number) {
  ctx.save();
  ctx.translate(e.x, e.y);

  if (e.kind === 'scout') {
    ctx.shadowColor = '#ff5f96';
    ctx.shadowBlur = 16;
    ctx.fillStyle = 'rgba(255, 95, 150, 0.16)';
    ctx.strokeStyle = '#ff6f9f';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.lineTo(-16, -12);
    ctx.lineTo(0, -4);
    ctx.lineTo(16, -12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd0e0';
    ctx.beginPath();
    ctx.arc(0, 2, 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'wing') {
    ctx.rotate(Math.sin(e.t * 2 + e.phase) * 0.16);
    ctx.shadowColor = '#c58cff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(197, 140, 255, 0.14)';
    ctx.strokeStyle = '#b884ff';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(-20, 0);
    ctx.lineTo(-7, -16);
    ctx.lineTo(7, -16);
    ctx.lineTo(20, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(220, 190, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-9, -4);
    ctx.lineTo(9, -4);
    ctx.stroke();
    ctx.fillStyle = '#efe2ff';
    ctx.beginPath();
    ctx.arc(0, 4, 2.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'turret') {
    ctx.shadowColor = '#ffb15e';
    ctx.shadowBlur = 20;
    ctx.fillStyle = 'rgba(255, 177, 94, 0.14)';
    ctx.strokeStyle = '#ffb15e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * 17;
      const py = Math.sin(a) * 17;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.save();
    ctx.rotate(now * 1.4);
    ctx.strokeStyle = 'rgba(255, 200, 130, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#fff0d0';
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const pulse = 1 + Math.sin(now * 3) * 0.02;
    ctx.scale(pulse, pulse);
    ctx.shadowColor = '#ff9a4d';
    ctx.shadowBlur = 34;
    ctx.fillStyle = 'rgba(255, 120, 70, 0.13)';
    ctx.strokeStyle = 'rgba(255, 170, 110, 0.85)';
    ctx.lineWidth = 2.4;

    ctx.beginPath();
    ctx.moveTo(0, 44);
    ctx.lineTo(-46, 16);
    ctx.lineTo(-58, -16);
    ctx.lineTo(-30, -34);
    ctx.lineTo(30, -34);
    ctx.lineTo(58, -16);
    ctx.lineTo(46, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(20, 8, 12, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-24, -16, 48, 30, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 190, 130, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    for (const sx of [-32, 32]) {
      ctx.save();
      ctx.translate(sx, 4);
      ctx.rotate(Math.sin(now * 2 + sx) * 0.1);
      ctx.fillStyle = 'rgba(255, 177, 94, 0.25)';
      ctx.strokeStyle = '#ffb15e';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(-8, -14, 16, 28, 5);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.shadowColor = '#ff7a4d';
    ctx.shadowBlur = 22;
    ctx.fillStyle = '#ffcf9a';
    ctx.beginPath();
    ctx.arc(0, 8, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (e.hitFlash > 0) {
    ctx.globalAlpha = e.hitFlash * 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, e.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, game: StarfallGame, now: number) {
  const p = game.player;
  const blink = p.invuln > 0 && Math.floor(now * 18) % 2 === 0;

  if (p.focus && game.mode === 'playing') {
    ctx.save();
    ctx.strokeStyle = 'rgba(159, 242, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, GRAZE_R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (!blink) {
    ctx.save();
    ctx.translate(p.x, p.y);

    const flame = 8 + Math.sin(now * 26) * 3;
    const fg = ctx.createLinearGradient(0, 10, 0, 30);
    fg.addColorStop(0, 'rgba(160, 240, 255, 0.9)');
    fg.addColorStop(1, 'rgba(90, 160, 255, 0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-5, 12);
    ctx.lineTo(0, 12 + flame);
    ctx.lineTo(5, 12);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = '#6fe6ff';
    ctx.shadowBlur = 22;
    const hull = ctx.createLinearGradient(0, -22, 0, 16);
    hull.addColorStop(0, '#f4fdff');
    hull.addColorStop(0.5, '#b7e6f5');
    hull.addColorStop(1, '#5f8fae');
    ctx.fillStyle = hull;
    ctx.strokeStyle = 'rgba(190, 245, 255, 0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(-7, -6);
    ctx.lineTo(-19, 6);
    ctx.lineTo(-13, 14);
    ctx.lineTo(-4, 11);
    ctx.lineTo(4, 11);
    ctx.lineTo(13, 14);
    ctx.lineTo(19, 6);
    ctx.lineTo(7, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(100, 240, 255, 0.9)';
    ctx.beginPath();
    ctx.ellipse(0, -6, 3.4, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(242, 166, 59, 0.85)';
    ctx.fillRect(-15, 3, 3, 7);
    ctx.fillRect(12, 3, 3, 7);

    if (p.invuln > 0) {
      ctx.strokeStyle = `rgba(159, 242, 255, ${0.25 + Math.sin(now * 12) * 0.15})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, 27, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (p.focus) {
      ctx.fillStyle = '#ff5f7a';
      ctx.beginPath();
      ctx.arc(0, 0, PLAYER_HIT_R, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function drawGame(ctx: CanvasRenderingContext2D, game: StarfallGame, now: number) {
  ctx.save();
  if (game.shake > 0.1) {
    ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
  }

  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, '#05060f');
  bg.addColorStop(0.55, '#080a16');
  bg.addColorStop(1, '#04050b');
  ctx.fillStyle = bg;
  ctx.fillRect(-40, -40, WIDTH + 80, HEIGHT + 80);

  const neb1 = ctx.createRadialGradient(WIDTH * 0.2, 80, 10, WIDTH * 0.2, 80, 420);
  neb1.addColorStop(0, 'rgba(94, 200, 230, 0.1)');
  neb1.addColorStop(1, 'rgba(94, 200, 230, 0)');
  ctx.fillStyle = neb1;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const neb2 = ctx.createRadialGradient(WIDTH * 0.85, HEIGHT * 0.3, 10, WIDTH * 0.85, HEIGHT * 0.3, 420);
  neb2.addColorStop(0, 'rgba(170, 110, 235, 0.1)');
  neb2.addColorStop(1, 'rgba(170, 110, 235, 0)');
  ctx.fillStyle = neb2;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (const s of stars) {
    const y = (s.y + now * 30 * s.z) % (HEIGHT + 20);
    ctx.globalAlpha = 0.18 + s.z * 0.4;
    ctx.fillStyle = s.z > 1 ? '#cfe8ff' : '#8fa9c8';
    ctx.fillRect(s.x, y, s.s, s.s * 1.6);
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = 'rgba(120, 180, 255, 0.045)';
  ctx.lineWidth = 1;
  const off = (now * 28) % 56;
  ctx.beginPath();
  for (let y = -56 + off; y < HEIGHT; y += 56) {
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
  }
  ctx.stroke();

  for (const e of game.enemies) drawEnemy(ctx, e, now);

  // 玩家子弹
  for (const b of game.pb) {
    ctx.save();
    ctx.shadowColor = '#8ff2ff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#d8fbff';
    ctx.fillRect(b.x - 2, b.y - 13, 4, 17);
    ctx.restore();
  }

  // 敌弹
  for (const b of game.eb) {
    ctx.save();
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = b.color;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#fff4f8';
    ctx.beginPath();
    ctx.arc(b.x - b.r * 0.2, b.y - b.r * 0.25, b.r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawPlayer(ctx, game, now);

  for (const p of game.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // BOSS 血条
  const boss = game.enemies.find((e) => e.kind === 'boss');
  if (boss) {
    const w = 420;
    const x = (WIDTH - w) / 2;
    const y = 68;
    ctx.save();
    ctx.fillStyle = 'rgba(8, 10, 18, 0.7)';
    ctx.beginPath();
    ctx.roundRect(x - 2, y - 2, w + 4, 12, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 95, 130, 0.16)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, 8, 4);
    ctx.fill();
    const ratio = Math.max(0, boss.hp / boss.maxHp);
    const bar = ctx.createLinearGradient(x, 0, x + w, 0);
    bar.addColorStop(0, '#ff7a9e');
    bar.addColorStop(1, '#ffb15e');
    ctx.fillStyle = bar;
    ctx.beginPath();
    ctx.roundRect(x, y, w * ratio, 8, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 205, 220, 0.75)';
    ctx.font = '600 10px "SF Mono", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BOSS', WIDTH / 2, y - 8);
    ctx.restore();
  }

  if (game.flash > 0.01) {
    ctx.fillStyle = `rgba(190, 235, 255, ${game.flash * 0.2})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  ctx.restore();
}
