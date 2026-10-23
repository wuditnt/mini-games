import { MAX_BOMBS, START_LIVES, WIDTH, HEIGHT } from './constants';
import { StarfallGame } from './game';
import { drawGame } from './render';
import { Input } from '../../engine/input';
import { sfx } from '../../engine/audio';
import { addRun } from '../../data/runs';
import type { GameHandle, MountOptions } from '../types';

const BEST_KEY = 'starfall.best';

const isTouchDevice = () =>
  window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

export function mount(host: HTMLElement, opts: MountOptions): GameHandle {
  const touchDevice = isTouchDevice();

  host.innerHTML = `
    <div class="stage-frame crt${touchDevice ? ' is-touch' : ''}">
      <canvas></canvas>
      <div class="hud">
        <div class="hud-row">
          <div class="hud-item">
            <span class="hud-label">得分</span>
            <span class="hud-value" data-score>0</span>
          </div>
          <div class="hud-item">
            <span class="hud-label">波次</span>
            <span class="hud-value" data-wave>1</span>
          </div>
          <div class="hud-item">
            <span class="hud-label">擦弹</span>
            <span class="hud-value" data-graze>0</span>
          </div>
          <div class="hud-grow"></div>
          <div class="hud-item hud-right">
            <span class="hud-label">最高</span>
            <span class="hud-value" data-best>0</span>
          </div>
          <button class="hud-btn" type="button" data-action="bomb" aria-label="炸弹">✹</button>
          <button class="hud-btn" type="button" data-action="pause" aria-label="暂停">❚❚</button>
        </div>
        <div class="banner" data-banner></div>
        <div class="hud-row bottom">
          <div class="meter">
            <span class="hud-label">生命</span>
            <div class="pips" data-lives></div>
          </div>
          <div class="meter">
            <span class="hud-label">炸弹</span>
            <div class="pips" data-bombs></div>
          </div>
          <div class="hud-grow"></div>
          <div class="hint" data-hint>WASD / 方向键移动 · Shift 低速 · 空格放炸弹 · Esc 暂停</div>
        </div>
      </div>

      <div class="overlay" data-ov="menu">
        <div class="ov-card">
          <p class="ov-kicker">STARFALL</p>
          <h2>星际弹幕</h2>
          <p class="ov-desc">驾驶战机穿梭于弹幕之间。贴近敌弹擦过可积累能量，能量充满获得炸弹。</p>
          <div class="ov-keys" data-keys>
            <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>移动</span></div>
            <div><kbd>Shift</kbd><span>低速精细移动</span></div>
            <div><kbd>空格</kbd><span>释放炸弹</span></div>
            <div><kbd>Esc</kbd><span>暂停</span></div>
          </div>
          <button class="btn-primary" type="button" data-action="start">开始出击</button>
        </div>
      </div>

      <div class="overlay hidden" data-ov="pause">
        <div class="ov-card">
          <p class="ov-kicker">PAUSED</p>
          <h2>已暂停</h2>
          <p class="ov-desc" data-pause-desc>按 Esc 或点击继续，回到战场。</p>
          <div class="btn-row">
            <button class="btn-primary" type="button" data-action="resume">继续</button>
            <button class="btn-secondary" type="button" data-action="restart">重新开始</button>
            <button class="btn-secondary" type="button" data-action="exit">返回大厅</button>
          </div>
        </div>
      </div>

      <div class="overlay hidden" data-ov="over">
        <div class="ov-card">
          <p class="ov-kicker">GAME OVER</p>
          <h2>出击失败</h2>
          <p class="ov-reason" data-reason></p>
          <div class="ov-stats">
            <div class="ov-stat">
              <span class="hud-label">本局得分</span>
              <strong data-final>0</strong>
            </div>
            <div class="ov-stat">
              <span class="hud-label">最高分</span>
              <strong class="accent" data-best-over>0</strong>
            </div>
          </div>
          <div class="btn-row">
            <button class="btn-primary" type="button" data-action="restart">再来一局</button>
            <button class="btn-secondary" type="button" data-action="exit">返回大厅</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const frame = host.querySelector<HTMLDivElement>('.stage-frame')!;
  const canvas = host.querySelector<HTMLCanvasElement>('canvas')!;
  const ctx = canvas.getContext('2d')!;

  const el = {
    score: host.querySelector<HTMLElement>('[data-score]')!,
    wave: host.querySelector<HTMLElement>('[data-wave]')!,
    graze: host.querySelector<HTMLElement>('[data-graze]')!,
    best: host.querySelector<HTMLElement>('[data-best]')!,
    lives: host.querySelector<HTMLElement>('[data-lives]')!,
    bombs: host.querySelector<HTMLElement>('[data-bombs]')!,
    hint: host.querySelector<HTMLElement>('[data-hint]')!,
    banner: host.querySelector<HTMLElement>('[data-banner]')!,
    reason: host.querySelector<HTMLElement>('[data-reason]')!,
    final: host.querySelector<HTMLElement>('[data-final]')!,
    bestOver: host.querySelector<HTMLElement>('[data-best-over]')!,
    keys: host.querySelector<HTMLElement>('[data-keys]')!,
    pauseDesc: host.querySelector<HTMLElement>('[data-pause-desc]')!,
  };

  if (touchDevice) {
    el.keys.innerHTML = `
      <div><kbd>拖动</kbd><span>移动战机</span></div>
      <div><kbd>✹</kbd><span>释放炸弹</span></div>
      <div><kbd>暂停</kbd><span>点右上角按钮</span></div>
    `;
    el.hint.textContent = '拖动屏幕移动战机 · 点 ✹ 释放炸弹';
    el.pauseDesc.textContent = '点击继续，回到战场。';
  }

  const overlays = Array.from(host.querySelectorAll<HTMLElement>('.overlay'));
  const storedBest = Number(localStorage.getItem(BEST_KEY) ?? '0');
  const game = new StarfallGame(Number.isFinite(storedBest) ? storedBest : 0);

  /* ---------------- 画布尺寸 ---------------- */
  let scaleX = 1;
  let scaleY = 1;

  const resize = () => {
    const rect = frame.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    scaleX = canvas.width / WIDTH;
    scaleY = canvas.height / HEIGHT;
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(frame);

  /* ---------------- 输入 ---------------- */
  const input = new Input(canvas, {
    toWorld: (clientX, clientY) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((clientX - r.left) / r.width) * WIDTH,
        y: ((clientY - r.top) / r.height) * HEIGHT,
      };
    },
    onKey: (code) => {
      if (code === 'Escape') {
        if (game.mode === 'playing') pause();
        else if (game.mode === 'paused') resume();
      } else if (code === 'Enter') {
        if (game.mode === 'menu' || game.mode === 'over') start();
      } else if (code === 'Space') {
        if (game.mode === 'menu') start();
        else if (game.mode === 'playing') game.controls.bomb = true;
      } else if (code === 'KeyR' && game.mode === 'over') {
        start();
      }
    },
  });

  /* ---------------- 触屏拖动 ---------------- */
  let drag: { x: number; y: number; ox: number; oy: number } | null = null;

  const onPointerDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-action]')) return;
    if (game.mode !== 'playing' || e.pointerType === 'mouse') return;
    drag = { x: game.player.x, y: game.player.y, ox: e.clientX, oy: e.clientY };
    game.controls.targetX = game.player.x;
    game.controls.targetY = game.player.y;
    try {
      frame.setPointerCapture(e.pointerId);
    } catch {
      /* 忽略 */
    }
    e.preventDefault();
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!drag || game.mode !== 'playing' || e.pointerType === 'mouse') return;
    const r = canvas.getBoundingClientRect();
    const dx = ((e.clientX - drag.ox) / r.width) * WIDTH * 1.15;
    const dy = ((e.clientY - drag.oy) / r.height) * HEIGHT * 1.15;
    game.controls.targetX = drag.x + dx;
    game.controls.targetY = drag.y + dy;
    e.preventDefault();
  };

  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    drag = null;
    game.controls.targetX = null;
    game.controls.targetY = null;
  };

  frame.addEventListener('pointerdown', onPointerDown);
  frame.addEventListener('pointermove', onPointerMove);
  frame.addEventListener('pointerup', onPointerUp);
  frame.addEventListener('pointercancel', onPointerUp);

  /* ---------------- 界面状态 ---------------- */
  const showOverlay = (name: 'menu' | 'pause' | 'over' | null) => {
    for (const o of overlays) o.classList.toggle('hidden', o.dataset.ov !== name);
  };

  const blurActive = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };

  let startHintTimer = 0;
  let startedAt = 0;

  function start() {
    sfx.unlock();
    sfx.click();
    startedAt = Date.now();
    drag = null;
    game.controls.targetX = null;
    game.controls.targetY = null;
    game.controls.bomb = false;
    game.begin();
    showOverlay(null);
    frame.classList.add('is-playing');
    blurActive();
    el.hint.classList.remove('fade');
    window.clearTimeout(startHintTimer);
    startHintTimer = window.setTimeout(() => el.hint.classList.add('fade'), 9000);
  }

  function pause() {
    if (game.mode !== 'playing') return;
    game.pause();
    drag = null;
    game.controls.targetX = null;
    game.controls.targetY = null;
    showOverlay('pause');
    frame.classList.remove('is-playing');
    el.hint.classList.add('fade');
  }

  function resume() {
    if (game.mode !== 'paused') return;
    game.resume();
    showOverlay(null);
    frame.classList.add('is-playing');
    blurActive();
  }

  frame.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'start' || action === 'restart') start();
    else if (action === 'resume') resume();
    else if (action === 'pause') pause();
    else if (action === 'bomb') game.controls.bomb = true;
    else if (action === 'exit') opts.onExit();
  });

  /* ---------------- 游戏回调 ---------------- */
  game.onBanner = (text) => {
    el.banner.textContent = text;
    el.banner.classList.remove('show');
    void el.banner.offsetWidth;
    el.banner.classList.add('show');
    sfx.wave();
  };

  game.onGameOver = (reason, score, best) => {
    localStorage.setItem(BEST_KEY, String(best));
    addRun({
      gameId: 'starfall',
      gameTitle: '星际弹幕',
      score,
      wave: game.wave,
      duration: startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0,
      result: reason,
    });
    sfx.gameOver();
    el.reason.textContent = reason;
    el.final.textContent = String(score);
    el.bestOver.textContent = String(best);
    showOverlay('over');
    frame.classList.remove('is-playing');
    el.hint.classList.add('fade');
    updateHud(true);
  };

  /* ---------------- HUD ---------------- */
  const cache = { score: -1, wave: -1, graze: -1, best: -1, lives: -1, bombs: -1 };

  const renderPips = (container: HTMLElement, count: number, total: number, cls: string) => {
    if (container.childElementCount !== total) {
      container.innerHTML = Array.from(
        { length: total },
        () => `<i class="pip ${cls}"></i>`
      ).join('');
    }
    Array.from(container.children).forEach((node, i) => {
      node.classList.toggle('on', i < count);
    });
  };

  function updateHud(force = false) {
    if (force || game.score !== cache.score) {
      cache.score = game.score;
      el.score.textContent = String(game.score);
    }
    if (force || game.wave !== cache.wave) {
      cache.wave = game.wave;
      el.wave.textContent = String(Math.max(1, game.wave));
    }
    if (force || game.graze !== cache.graze) {
      cache.graze = game.graze;
      el.graze.textContent = String(game.graze);
    }
    const bestNow = Math.max(game.best, game.score);
    if (force || bestNow !== cache.best) {
      cache.best = bestNow;
      el.best.textContent = String(bestNow);
    }
    const lives = Math.max(0, game.lives);
    if (force || lives !== cache.lives) {
      cache.lives = lives;
      renderPips(el.lives, lives, START_LIVES, '');
    }
    const bombs = Math.max(0, game.bombs);
    if (force || bombs !== cache.bombs) {
      cache.bombs = bombs;
      renderPips(el.bombs, bombs, MAX_BOMBS, 'base');
    }
  }
  updateHud(true);

  /* ---------------- 主循环 ---------------- */
  let raf = 0;
  let last = performance.now();

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;

    const kx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const ky = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    game.controls.mx = kx;
    game.controls.my = ky;
    game.controls.focus = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
    if (kx !== 0 || ky !== 0) {
      game.controls.targetX = null;
      game.controls.targetY = null;
    }

    game.update(dt);

    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    drawGame(ctx, game, now / 1000);
    updateHud();
  };
  raf = requestAnimationFrame(loop);

  if (new URLSearchParams(location.search).has('play')) start();

  /* ---------------- 失焦自动暂停 ---------------- */
  const onVisibility = () => {
    if (document.hidden) pause();
  };
  document.addEventListener('visibilitychange', onVisibility);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.clearTimeout(startHintTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      ro.disconnect();
      input.dispose();
      frame.removeEventListener('pointerdown', onPointerDown);
      frame.removeEventListener('pointermove', onPointerMove);
      frame.removeEventListener('pointerup', onPointerUp);
      frame.removeEventListener('pointercancel', onPointerUp);
      frame.remove();
    },
  };
}
