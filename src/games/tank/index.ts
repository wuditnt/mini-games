import { HEIGHT, WIDTH } from './constants';
import { TankGame } from './game';
import { drawGame } from './render';
import { Input } from '../../engine/input';
import { TouchControls } from '../../engine/touch';
import { sfx } from '../../engine/audio';
import { addRun } from '../../data/runs';
import type { GameHandle, MountOptions } from '../types';

const BEST_KEY = 'tank.best';

export function mount(host: HTMLElement, opts: MountOptions): GameHandle {
  host.innerHTML = `
    <div class="stage-frame crt">
      <canvas></canvas>
      <div class="hud">
        <div class="hud-row">
          <div class="hud-item">
            <span class="hud-label">得分</span>
            <span class="hud-value" data-score>0</span>
          </div>
          <div class="hud-item">
            <span class="hud-label">波次</span>
            <span class="hud-value" data-wave>0</span>
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
          <div class="meters">
            <div class="meter">
              <span class="hud-label">护甲</span>
              <div class="pips" data-armor></div>
            </div>
            <div class="meter">
              <span class="hud-label">基地</span>
              <div class="pips" data-base></div>
            </div>
          </div>
          <div class="hud-grow"></div>
          <div class="hint" data-hint>WASD 移动 · 鼠标瞄准 · 左键开火 · Esc 暂停</div>
        </div>
      </div>

      <div class="overlay" data-ov="menu">
        <div class="ov-card">
          <p class="ov-kicker">TANK BATTLE</p>
          <h2>坦克大战</h2>
          <p class="ov-desc">守住基地，击退一波又一波装甲部队。击毁敌方坦克有机会掉落补给。</p>
          <div class="ov-keys" data-keys>
            <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>移动</span></div>
            <div><kbd>鼠标</kbd><span>瞄准</span></div>
            <div><kbd>左键</kbd><span>开火</span></div>
            <div><kbd>Esc</kbd><span>暂停</span></div>
          </div>
          <button class="btn-primary" type="button" data-action="start">开始战斗</button>
        </div>
      </div>

      <div class="overlay hidden" data-ov="pause">
        <div class="ov-card">
          <p class="ov-kicker">PAUSED</p>
          <h2>已暂停</h2>
          <p class="ov-desc" data-pause-desc>按 Esc 或点击继续，返回战场。</p>
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
          <h2>战斗结束</h2>
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
  const touch = new TouchControls(host, frame);

  const el = {
    score: host.querySelector<HTMLElement>('[data-score]')!,
    wave: host.querySelector<HTMLElement>('[data-wave]')!,
    best: host.querySelector<HTMLElement>('[data-best]')!,
    armor: host.querySelector<HTMLElement>('[data-armor]')!,
    base: host.querySelector<HTMLElement>('[data-base]')!,
    hint: host.querySelector<HTMLElement>('[data-hint]')!,
    banner: host.querySelector<HTMLElement>('[data-banner]')!,
    reason: host.querySelector<HTMLElement>('[data-reason]')!,
    final: host.querySelector<HTMLElement>('[data-final]')!,
    bestOver: host.querySelector<HTMLElement>('[data-best-over]')!,
    keys: host.querySelector<HTMLElement>('[data-keys]')!,
    pauseDesc: host.querySelector<HTMLElement>('[data-pause-desc]')!,
  };

  if (touch.enabled) {
    el.keys.innerHTML = `
      <div><kbd>左半屏</kbd><span>拖动移动</span></div>
      <div><kbd>右半屏</kbd><span>拖动瞄准 · 自动开火</span></div>
      <div><kbd>暂停</kbd><span>点右上角按钮</span></div>
    `;
    el.pauseDesc.textContent = '点击继续，返回战场。';
  }

  const overlays = Array.from(host.querySelectorAll<HTMLElement>('.overlay'));
  const storedBest = Number(localStorage.getItem(BEST_KEY) ?? '0');
  const game = new TankGame(Number.isFinite(storedBest) ? storedBest : 0);

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
      } else if (code === 'KeyR' && game.mode === 'over') {
        start();
      }
    },
  });

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
    game.begin();
    game.best = Math.max(game.best, game.score);
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
  };

  game.onGameOver = (reason, score, best) => {
    localStorage.setItem(BEST_KEY, String(best));
    addRun({
      gameId: 'tank',
      gameTitle: '坦克大战',
      score,
      wave: game.wave,
      duration: startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0,
      result: reason,
    });
    el.reason.textContent = reason;
    el.final.textContent = String(score);
    el.bestOver.textContent = String(best);
    showOverlay('over');
    frame.classList.remove('is-playing');
    el.hint.classList.add('fade');
    updateHud(true);
  };

  /* ---------------- HUD ---------------- */
  const cache = { score: -1, wave: -1, best: -1, armor: -1, base: -1 };

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
      el.wave.textContent = String(game.wave);
    }
    const bestNow = Math.max(game.best, game.score);
    if (force || bestNow !== cache.best) {
      cache.best = bestNow;
      el.best.textContent = String(bestNow);
    }
    const hp = Math.max(0, game.player.hp);
    if (force || hp !== cache.armor) {
      cache.armor = hp;
      renderPips(el.armor, hp, game.player.maxHp, '');
    }
    const baseHp = Math.max(0, game.base.hp);
    if (force || baseHp !== cache.base) {
      cache.base = baseHp;
      renderPips(el.base, baseHp, game.base.maxHp, 'base');
    }
  }

  game.onHud = () => updateHud();
  updateHud(true);

  /* ---------------- 主循环 ---------------- */
  let raf = 0;
  let last = performance.now();

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;

    touch.setActive(game.mode === 'playing');

    const kx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const ky = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (kx !== 0 || ky !== 0) {
      game.controls.mx = kx;
      game.controls.my = ky;
    } else {
      game.controls.mx = touch.move.x;
      game.controls.my = touch.move.y;
    }

    if (touch.aim.active && touch.aim.mag > 0) {
      game.controls.aimX = game.player.x + touch.aim.x * 420;
      game.controls.aimY = game.player.y + touch.aim.y * 420;
      game.controls.firing = true;
    } else {
      game.controls.aimX = input.pointer.x;
      game.controls.aimY = input.pointer.y;
      game.controls.firing = input.pointer.down;
    }

    game.update(dt);

    const touchAiming = touch.aim.active && touch.aim.mag > 0;
    const reticle = touchAiming
      ? {
          x: Math.min(WIDTH - 16, Math.max(16, game.player.x + touch.aim.x * 150)),
          y: Math.min(HEIGHT - 16, Math.max(16, game.player.y + touch.aim.y * 150)),
          active: true,
        }
      : input.pointer;

    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    drawGame(ctx, game, reticle, now / 1000);
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
      touch.dispose();
      frame.remove();
    },
  };
}
