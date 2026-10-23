import { HEIGHT, START_LIVES, WIDTH } from './constants';
import { BreakoutGame } from './game';
import { drawGame } from './render';
import { Input } from '../../engine/input';
import { sfx } from '../../engine/audio';
import { addRun } from '../../data/runs';
import { isMobileDevice } from '../../lib/device';
import type { GameHandle, MountOptions } from '../types';

const BEST_KEY = 'breakout.best';

export function mount(host: HTMLElement, opts: MountOptions): GameHandle {
  const touchDevice = isMobileDevice();

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
            <span class="hud-label">关卡</span>
            <span class="hud-value" data-level>1</span>
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
          <div class="meter">
            <span class="hud-label">生命</span>
            <div class="pips" data-lives></div>
          </div>
          <div class="hud-grow"></div>
          <div class="hint" data-hint>A / D 或 ← → 移动 · 空格或点击发球 · Esc 暂停</div>
        </div>
      </div>

      <div class="overlay" data-ov="menu">
        <div class="ov-card">
          <p class="ov-kicker">BREAKOUT</p>
          <h2>打砖块</h2>
          <p class="ov-desc">反弹小球击碎全部砖块。接住补给获得强化，连续命中可提高得分倍率。</p>
          <div class="ov-keys" data-keys>
            <div><kbd>A</kbd><kbd>D</kbd><span>移动挡板</span></div>
            <div><kbd>←</kbd><kbd>→</kbd><span>移动挡板</span></div>
            <div><kbd>空格</kbd><span>发球</span></div>
            <div><kbd>Esc</kbd><span>暂停</span></div>
          </div>
          <button class="btn-primary" type="button" data-action="start">开始游戏</button>
        </div>
      </div>

      <div class="overlay hidden" data-ov="pause">
        <div class="ov-card">
          <p class="ov-kicker">PAUSED</p>
          <h2>已暂停</h2>
          <p class="ov-desc" data-pause-desc>按 Esc 或点击继续，回到游戏。</p>
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
          <h2>游戏结束</h2>
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
    level: host.querySelector<HTMLElement>('[data-level]')!,
    best: host.querySelector<HTMLElement>('[data-best]')!,
    lives: host.querySelector<HTMLElement>('[data-lives]')!,
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
      <div><kbd>拖动</kbd><span>移动挡板</span></div>
      <div><kbd>点击</kbd><span>发球</span></div>
      <div><kbd>暂停</kbd><span>点右上角按钮</span></div>
    `;
    el.hint.textContent = '拖动屏幕控制挡板 · 点击发球';
    el.pauseDesc.textContent = '点击继续，回到游戏。';
  }

  const overlays = Array.from(host.querySelectorAll<HTMLElement>('.overlay'));
  const storedBest = Number(localStorage.getItem(BEST_KEY) ?? '0');
  const game = new BreakoutGame(Number.isFinite(storedBest) ? storedBest : 0);

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
      } else if (code === 'Enter' || code === 'Space') {
        if (game.mode === 'menu') start();
        else if (game.mode === 'playing') game.controls.launch = true;
      } else if (code === 'KeyR' && game.mode === 'over') {
        start();
      }
    },
  });

  const toWorldX = (clientX: number) => {
    const r = canvas.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * WIDTH;
  };

  let touchX: number | null = null;

  const onPointerDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-action]')) return;
    if (game.mode !== 'playing') return;
    if (e.pointerType === 'mouse') {
      game.controls.launch = true;
      return;
    }
    touchX = toWorldX(e.clientX);
    game.controls.targetX = touchX;
    game.controls.launch = true;
    try {
      frame.setPointerCapture(e.pointerId);
    } catch {
      /* 忽略 */
    }
    e.preventDefault();
  };

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' || game.mode !== 'playing') return;
    touchX = toWorldX(e.clientX);
    e.preventDefault();
  };

  frame.addEventListener('pointerdown', onPointerDown);
  frame.addEventListener('pointermove', onPointerMove);

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
    touchX = null;
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
      gameId: 'breakout',
      gameTitle: '打砖块',
      score,
      wave: game.level,
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
  const cache = { score: -1, level: -1, best: -1, lives: -1 };

  const renderLives = (count: number) => {
    if (el.lives.childElementCount !== START_LIVES) {
      el.lives.innerHTML = Array.from(
        { length: START_LIVES },
        () => '<i class="pip"></i>'
      ).join('');
    }
    Array.from(el.lives.children).forEach((node, i) => {
      node.classList.toggle('on', i < count);
    });
  };

  function updateHud(force = false) {
    if (force || game.score !== cache.score) {
      cache.score = game.score;
      el.score.textContent = String(game.score);
    }
    if (force || game.level !== cache.level) {
      cache.level = game.level;
      el.level.textContent = String(game.level);
    }
    const bestNow = Math.max(game.best, game.score);
    if (force || bestNow !== cache.best) {
      cache.best = bestNow;
      el.best.textContent = String(bestNow);
    }
    const lives = Math.max(0, game.lives);
    if (force || lives !== cache.lives) {
      cache.lives = lives;
      renderLives(lives);
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
    if (kx !== 0) {
      game.controls.moveDir = kx;
      game.controls.targetX = null;
    } else {
      game.controls.moveDir = 0;
      game.controls.targetX =
        touchX ?? (input.pointer.active ? input.pointer.x : null);
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
      frame.remove();
    },
  };
}
