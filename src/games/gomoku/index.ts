import { BOARD_W, BOARD_X, BOARD_Y, CELL, HEIGHT, SIZE, WIDTH } from './constants';
import { GomokuGame } from './game';
import { drawGame } from './render';
import { Input } from '../../engine/input';
import { sfx } from '../../engine/audio';
import { addRun } from '../../data/runs';
import { isMobileDevice } from '../../lib/device';
import type { GameHandle, MountOptions } from '../types';

const RECORD_KEY = 'gomoku.record';

interface Record {
  wins: number;
  losses: number;
  draws: number;
}

const loadRecord = (): Record => {
  try {
    const raw = JSON.parse(localStorage.getItem(RECORD_KEY) ?? '{}');
    return {
      wins: Number(raw.wins) || 0,
      losses: Number(raw.losses) || 0,
      draws: Number(raw.draws) || 0,
    };
  } catch {
    return { wins: 0, losses: 0, draws: 0 };
  }
};

export function mount(host: HTMLElement, opts: MountOptions): GameHandle {
  const touchDevice = isMobileDevice();

  host.innerHTML = `
    <div class="stage-frame crt${touchDevice ? ' is-touch' : ''}">
      <canvas></canvas>
      <div class="hud">
        <div class="hud-row">
          <div class="hud-item">
            <span class="hud-label">手数</span>
            <span class="hud-value" data-moves>0</span>
          </div>
          <div class="hud-item hud-record">
            <span class="hud-label">战绩</span>
            <span class="hud-value" data-record>0胜 0负</span>
          </div>
          <div class="hud-grow"></div>
          <button class="hud-btn" type="button" data-action="undo" aria-label="悔棋">↺</button>
          <button class="hud-btn" type="button" data-action="pause" aria-label="暂停">❚❚</button>
        </div>
        <div class="banner" data-banner></div>
        <div class="hud-row bottom">
          <div class="hud-item">
            <span class="hud-label">状态</span>
            <span class="hud-value" data-status>轮到你</span>
          </div>
          <div class="hud-grow"></div>
          <div class="hint" data-hint>点击交叉点落子 · 你执黑先行 · Z 悔棋 · Esc 暂停</div>
        </div>
      </div>

      <div class="overlay" data-ov="menu">
        <div class="ov-card">
          <p class="ov-kicker">GOMOKU</p>
          <h2>五子棋</h2>
          <p class="ov-desc">你执黑先行，与电脑轮流落子。横、竖、斜任意方向先连成五子即获胜。</p>
          <div class="ov-keys" data-keys>
            <div><kbd>点击</kbd><span>落子</span></div>
            <div><kbd>Z</kbd><span>悔棋</span></div>
            <div><kbd>Esc</kbd><span>暂停</span></div>
          </div>
          <button class="btn-primary" type="button" data-action="start">开始对局</button>
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
          <h2 data-over-title>本局结束</h2>
          <p class="ov-reason" data-reason></p>
          <div class="ov-stats">
            <div class="ov-stat">
              <span class="hud-label">总手数</span>
              <strong data-final>0</strong>
            </div>
            <div class="ov-stat">
              <span class="hud-label">累计战绩</span>
              <strong class="accent" data-record-over>0胜 0负</strong>
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
  if (!touchDevice) canvas.style.cursor = 'crosshair';
  const ctx = canvas.getContext('2d')!;

  const el = {
    moves: host.querySelector<HTMLElement>('[data-moves]')!,
    record: host.querySelector<HTMLElement>('[data-record]')!,
    status: host.querySelector<HTMLElement>('[data-status]')!,
    banner: host.querySelector<HTMLElement>('[data-banner]')!,
    hint: host.querySelector<HTMLElement>('[data-hint]')!,
    reason: host.querySelector<HTMLElement>('[data-reason]')!,
    overTitle: host.querySelector<HTMLElement>('[data-over-title]')!,
    final: host.querySelector<HTMLElement>('[data-final]')!,
    recordOver: host.querySelector<HTMLElement>('[data-record-over]')!,
    keys: host.querySelector<HTMLElement>('[data-keys]')!,
    pauseDesc: host.querySelector<HTMLElement>('[data-pause-desc]')!,
  };

  if (touchDevice) {
    el.keys.innerHTML = `
      <div><kbd>点击棋盘</kbd><span>落子</span></div>
      <div><kbd>右上角</kbd><span>悔棋 / 暂停</span></div>
    `;
    el.hint.textContent = '点击交叉点落子 · 你执黑先行';
    el.pauseDesc.textContent = '点击继续，回到棋盘。';
  }

  const overlays = Array.from(host.querySelectorAll<HTMLElement>('.overlay'));
  const game = new GomokuGame();
  let record = loadRecord();

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

  /* ---------------- 落子交互 ---------------- */
  const cellFromPoint = (clientX: number, clientY: number) => {
    const r = canvas.getBoundingClientRect();
    const wx = ((clientX - r.left) / r.width) * WIDTH;
    const wy = ((clientY - r.top) / r.height) * HEIGHT;
    // 棋盘外扩半格：鼠标落在交点附近任意位置都能吸附到最近的交叉点
    if (
      wx < BOARD_X - CELL / 2 ||
      wx > BOARD_X + BOARD_W + CELL / 2 ||
      wy < BOARD_Y - CELL / 2 ||
      wy > BOARD_Y + BOARD_W + CELL / 2
    ) {
      return null;
    }
    const cx = Math.min(SIZE - 1, Math.max(0, Math.round((wx - BOARD_X) / CELL)));
    const cy = Math.min(SIZE - 1, Math.max(0, Math.round((wy - BOARD_Y) / CELL)));
    return { x: cx, y: cy };
  };

  const onCanvasMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    game.hover = cellFromPoint(e.clientX, e.clientY);
  };

  const onCanvasLeave = () => {
    game.hover = null;
  };

  const onCanvasDown = (e: PointerEvent) => {
    if (game.mode !== 'playing') return;
    e.preventDefault();
    const cell = cellFromPoint(e.clientX, e.clientY);
    if (!cell) return;
    const ok = game.place(cell.x, cell.y);
    if (ok && e.pointerType !== 'mouse') game.hover = null;
  };

  canvas.addEventListener('pointermove', onCanvasMove);
  canvas.addEventListener('pointerleave', onCanvasLeave);
  canvas.addEventListener('pointerdown', onCanvasDown);

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
      if (code === 'Escape') {
        if (game.mode === 'playing') pause();
        else if (game.mode === 'paused') resume();
      } else if (code === 'KeyZ') {
        game.undo();
      } else if (code === 'Enter' || code === 'Space') {
        if (game.mode === 'menu' || game.mode === 'over') start();
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
    else if (action === 'undo') game.undo();
    else if (action === 'exit') opts.onExit();
  });

  /* ---------------- 游戏回调 ---------------- */
  game.onPlace = () => {
    sfx.place();
  };

  game.onBanner = (text) => {
    el.banner.textContent = text;
    el.banner.classList.remove('show');
    void el.banner.offsetWidth;
    el.banner.classList.add('show');
  };

  game.onGameOver = (reason, result, moves) => {
    record = {
      wins: record.wins + (result === 'win' ? 1 : 0),
      losses: record.losses + (result === 'lose' ? 1 : 0),
      draws: record.draws + (result === 'draw' ? 1 : 0),
    };
    localStorage.setItem(RECORD_KEY, JSON.stringify(record));

    addRun({
      gameId: 'gomoku',
      gameTitle: '五子棋',
      score: result === 'win' ? 100 : result === 'draw' ? 50 : 0,
      wave: moves,
      duration: startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0,
      result,
    });

    if (result === 'win') sfx.win();
    else if (result === 'lose') sfx.gameOver();
    else sfx.wave();

    el.overTitle.textContent = result === 'win' ? '你赢了' : result === 'lose' ? '惜败' : '平局';
    el.reason.textContent = reason;
    el.final.textContent = String(moves);
    el.recordOver.textContent = `${record.wins}胜 ${record.losses}负`;
    showOverlay('over');
    frame.classList.remove('is-playing');
    el.hint.classList.add('fade');
    updateHud(true);
  };

  /* ---------------- HUD ---------------- */
  const cache = { moves: -1, status: '', record: '' };

  function updateHud(force = false) {
    if (force || game.moves.length !== cache.moves) {
      cache.moves = game.moves.length;
      el.moves.textContent = String(cache.moves);
    }
    const status = game.mode === 'over' || game.winner
      ? '本局结束'
      : game.thinking
        ? 'AI 思考中…'
        : game.mode === 'paused'
          ? '已暂停'
          : '轮到你';
    if (force || status !== cache.status) {
      cache.status = status;
      el.status.textContent = status;
    }
    const rec = `${record.wins}胜 ${record.losses}负`;
    if (force || rec !== cache.record) {
      cache.record = rec;
      el.record.textContent = rec;
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
      canvas.removeEventListener('pointermove', onCanvasMove);
      canvas.removeEventListener('pointerleave', onCanvasLeave);
      canvas.removeEventListener('pointerdown', onCanvasDown);
      frame.remove();
    },
  };
}
