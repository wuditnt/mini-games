import { HEIGHT, WIDTH } from './constants';
import { SnakeGame } from './game';
import type { Dir } from './game';
import { drawGame } from './render';
import { Input } from '../../engine/input';
import { sfx } from '../../engine/audio';
import { addRun } from '../../data/runs';
import type { GameHandle, MountOptions } from '../types';

const BEST_KEY = 'snake.best';

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
            <span class="hud-label">速度</span>
            <span class="hud-value" data-speed>1</span>
          </div>
          <div class="hud-grow"></div>
          <div class="hud-item hud-right">
            <span class="hud-label">最高</span>
            <span class="hud-value" data-best>0</span>
          </div>
          <button class="hud-btn" type="button" data-action="pause" aria-label="暂停">❚❚</button>
        </div>
        <div class="banner" data-banner></div>
        <div class="hud-row bottom">
          <div class="hud-item">
            <span class="hud-label">长度</span>
            <span class="hud-value" data-length>4</span>
          </div>
          <div class="hud-item">
            <span class="hud-label">连击</span>
            <span class="hud-value" data-combo>×1</span>
          </div>
          <div class="hud-grow"></div>
          <div class="hint" data-hint>WASD / 方向键转向 · 空格重开 · Esc 暂停</div>
        </div>
      </div>

      <div class="overlay" data-ov="menu">
        <div class="ov-card">
          <p class="ov-kicker">SNAKE</p>
          <h2>贪吃蛇</h2>
          <p class="ov-desc">吞下果实让身体变长，连续进食可叠加连击倍率。碰墙或咬到自己即结束。</p>
          <div class="ov-keys" data-keys>
            <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>转向</span></div>
            <div><kbd>方向键</kbd><span>转向</span></div>
            <div><kbd>Esc</kbd><span>暂停</span></div>
          </div>
          <button class="btn-primary" type="button" data-action="start">开始游戏</button>
        </div>
      </div>

      <div class="overlay hidden" data-ov="pause">
        <div class="ov-card">
          <p class="ov-kicker">PAUSED</p>
          <h2>已暂停</h2>
          <p class="ov-desc" data-pause-desc>按 Esc 或点击继续，回到棋盘。</p>
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
          <h2>本局结束</h2>
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
    speed: host.querySelector<HTMLElement>('[data-speed]')!,
    best: host.querySelector<HTMLElement>('[data-best]')!,
    length: host.querySelector<HTMLElement>('[data-length]')!,
    combo: host.querySelector<HTMLElement>('[data-combo]')!,
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
      <div><kbd>滑动</kbd><span>控制转向</span></div>
      <div><kbd>暂停</kbd><span>点右上角按钮</span></div>
    `;
    el.hint.textContent = '滑动屏幕控制转向 · 点右上角暂停';
    el.pauseDesc.textContent = '点击继续，回到棋盘。';
  }

  const overlays = Array.from(host.querySelectorAll<HTMLElement>('.overlay'));
  const storedBest = Number(localStorage.getItem(BEST_KEY) ?? '0');
  const game = new SnakeGame(Number.isFinite(storedBest) ? storedBest : 0);

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

  /* ---------------- 键盘 ---------------- */
  const input = new Input(canvas, {
    toWorld: (clientX, clientY) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((clientX - r.left) / r.width) * WIDTH,
        y: ((clientY - r.top) / r.height) * HEIGHT,
      };
    },
    onKey: (code) => {
      const dirMap: Record<string, Dir> = {
        KeyW: 'up',
        ArrowUp: 'up',
        KeyS: 'down',
        ArrowDown: 'down',
        KeyA: 'left',
        ArrowLeft: 'left',
        KeyD: 'right',
        ArrowRight: 'right',
      };
      if (dirMap[code]) {
        game.turn(dirMap[code]);
        return;
      }
      if (code === 'Escape') {
        if (game.mode === 'playing') pause();
        else if (game.mode === 'paused') resume();
      } else if (code === 'Enter') {
        if (game.mode === 'menu' || game.mode === 'over') start();
      } else if (code === 'Space') {
        if (game.mode === 'menu' || game.mode === 'over') start();
      } else if (code === 'KeyR' && game.mode === 'over') {
        start();
      }
    },
  });

  /* ---------------- 滑动转向 ---------------- */
  let swipe: { x: number; y: number } | null = null;

  const dirFromDelta = (dx: number, dy: number): Dir | null => {
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return null;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  };

  const onPointerDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-action]')) return;
    if (game.mode !== 'playing') return;
    swipe = { x: e.clientX, y: e.clientY };
    try {
      frame.setPointerCapture(e.pointerId);
    } catch {
      /* 忽略 */
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!swipe || game.mode !== 'playing') return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    const dir = dirFromDelta(dx, dy);
    if (dir) {
      game.turn(dir);
      swipe = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  };

  const onPointerUp = () => {
    swipe = null;
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
    swipe = null;
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
    swipe = null;
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
      gameId: 'snake',
      gameTitle: '贪吃蛇',
      score,
      wave: game.speedLevel,
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
  const cache = { score: -1, speed: -1, best: -1, length: -1, combo: -1 };

  function updateHud(force = false) {
    if (force || game.score !== cache.score) {
      cache.score = game.score;
      el.score.textContent = String(game.score);
    }
    if (force || game.speedLevel !== cache.speed) {
      cache.speed = game.speedLevel;
      el.speed.textContent = String(game.speedLevel);
    }
    const bestNow = Math.max(game.best, game.score);
    if (force || bestNow !== cache.best) {
      cache.best = bestNow;
      el.best.textContent = String(bestNow);
    }
    const len = game.body.length;
    if (force || len !== cache.length) {
      cache.length = len;
      el.length.textContent = String(len);
    }
    const combo = Math.max(1, game.combo);
    if (force || combo !== cache.combo) {
      cache.combo = combo;
      el.combo.textContent = `×${combo}`;
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
