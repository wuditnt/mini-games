import { HEIGHT, WIDTH } from './constants';
import { TankGame } from './game';
import type { Controls } from './game';
import { drawGame } from './render';
import { GuestView, encodeSnapshot } from './net';
import type { Snapshot } from './net';
import { Input } from '../../engine/input';
import { TouchControls } from '../../engine/touch';
import { sfx } from '../../engine/audio';
import { addRun } from '../../data/runs';
import { RoomPanel } from '../../net/roomPanel';
import { NetSession } from '../../net/session';
import type { NetRole } from '../../net/protocol';
import type { GameHandle, MountOptions } from '../types';

const BEST_KEY = 'tank.best';
const NET_STEP = 1 / 30;

type PlayMode = 'solo' | 'host' | 'guest' | null;
type OverlayName = 'menu' | 'room' | 'pause' | 'over' | 'net';

type GameMsg =
  | { t: 'start' }
  | { t: 'input'; c: Controls }
  | { t: 'pause'; v: boolean }
  | { t: 'restart' }
  | { t: 'snap'; s: Snapshot };

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
              <span class="hud-label" data-p1-label>护甲</span>
              <div class="pips" data-armor></div>
            </div>
            <div class="meter" data-mate hidden>
              <span class="hud-label">2P</span>
              <div class="pips" data-armor2></div>
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
          <p class="ov-desc">守住基地，击退一波又一波装甲部队。可以单人作战，也可以在同一局域网内双人合作。</p>
          <div class="ov-keys" data-keys>
            <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>移动</span></div>
            <div><kbd>鼠标</kbd><span>瞄准</span></div>
            <div><kbd>左键</kbd><span>开火</span></div>
            <div><kbd>Esc</kbd><span>暂停</span></div>
          </div>
          <div class="btn-row">
            <button class="btn-primary" type="button" data-action="start">单人作战</button>
            <button class="btn-secondary" type="button" data-action="coop">双人合作 · 局域网</button>
          </div>
        </div>
      </div>

      <div class="overlay hidden" data-ov="room">
        <div class="ov-card">
          <p class="ov-kicker">LAN CO-OP</p>
          <h2>双人合作</h2>
          <div data-room-body></div>
        </div>
      </div>

      <div class="overlay hidden" data-ov="pause">
        <div class="ov-card">
          <p class="ov-kicker">PAUSED</p>
          <h2>已暂停</h2>
          <p class="ov-desc" data-pause-desc>按 Esc 或点击继续，返回战场。</p>
          <div class="btn-row">
            <button class="btn-primary" type="button" data-action="resume">继续</button>
            <button class="btn-secondary" type="button" data-action="restart" data-restart>重新开始</button>
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

      <div class="overlay hidden" data-ov="net">
        <div class="ov-card">
          <p class="ov-kicker">DISCONNECTED</p>
          <h2>联机中断</h2>
          <p class="ov-reason" data-net-reason></p>
          <div class="btn-row">
            <button class="btn-primary" type="button" data-action="exit">返回大厅</button>
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
    p1Label: host.querySelector<HTMLElement>('[data-p1-label]')!,
    armor: host.querySelector<HTMLElement>('[data-armor]')!,
    mate: host.querySelector<HTMLElement>('[data-mate]')!,
    armor2: host.querySelector<HTMLElement>('[data-armor2]')!,
    base: host.querySelector<HTMLElement>('[data-base]')!,
    hint: host.querySelector<HTMLElement>('[data-hint]')!,
    banner: host.querySelector<HTMLElement>('[data-banner]')!,
    reason: host.querySelector<HTMLElement>('[data-reason]')!,
    final: host.querySelector<HTMLElement>('[data-final]')!,
    bestOver: host.querySelector<HTMLElement>('[data-best-over]')!,
    keys: host.querySelector<HTMLElement>('[data-keys]')!,
    pauseDesc: host.querySelector<HTMLElement>('[data-pause-desc]')!,
    restartBtn: host.querySelector<HTMLElement>('[data-restart]')!,
    netReason: host.querySelector<HTMLElement>('[data-net-reason]')!,
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
  const local: Controls = game.controls;

  let mode: PlayMode = null;
  let session: NetSession | null = null;
  let guest: GuestView | null = null;
  let view: TankGame = game;
  let overlayName: OverlayName | null = 'menu';
  let startedAt = 0;
  let snapAcc = 0;
  let inputAcc = 0;
  let snapTick = 0;
  let sentTilesRev = -1;
  let startHintTimer = 0;

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

  /* ---------------- 界面状态 ---------------- */
  const showOverlay = (name: OverlayName | null) => {
    overlayName = name;
    for (const o of overlays) o.classList.toggle('hidden', o.dataset.ov !== name);
  };

  const blurActive = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };

  const setPlayingChrome = (playing: boolean) => {
    frame.classList.toggle('is-playing', playing);
    el.hint.classList.toggle('fade', !playing);
    if (playing) {
      window.clearTimeout(startHintTimer);
      startHintTimer = window.setTimeout(() => el.hint.classList.add('fade'), 9000);
    }
  };

  const showBanner = (text: string) => {
    el.banner.textContent = text;
    el.banner.classList.remove('show');
    void el.banner.offsetWidth;
    el.banner.classList.add('show');
  };

  /* ---------------- 房间面板 ---------------- */
  const roomPanel = new RoomPanel({
    host: host.querySelector<HTMLElement>('[data-room-body]')!,
    onStart: (s, role) => startNetGame(s, role),
    onBack: () => showOverlay('menu'),
  });

  const openRoom = () => {
    sfx.unlock();
    sfx.click();
    frame.classList.remove('is-playing');
    showOverlay('room');
    roomPanel.reset();
  };

  /* ---------------- 对局开始 ---------------- */
  const resetHudCache = () => {
    cache.score = -1;
    cache.wave = -1;
    cache.best = -1;
    cache.armor = -1;
    cache.armor2 = -1;
    cache.base = -1;
    cache.count = -1;
  };

  function startSolo() {
    sfx.unlock();
    sfx.click();
    mode = 'solo';
    guest = null;
    view = game;
    game.localOwner = 'p1';
    startedAt = Date.now();
    resetHudCache();
    game.begin(false);
    game.best = Math.max(game.best, game.score);
    el.restartBtn.hidden = false;
    el.pauseDesc.textContent = touch.enabled ? '点击继续，返回战场。' : '按 Esc 或点击继续，返回战场。';
    showOverlay(null);
    setPlayingChrome(true);
    blurActive();
    updateHud(true);
  }

  function startNetGame(s: NetSession, role: NetRole) {
    sfx.unlock();
    sfx.click();
    session?.leave();
    session = s;
    mode = role;
    guest = null;
    view = game;
    startedAt = Date.now();
    snapAcc = 0;
    inputAcc = 0;
    snapTick = 0;
    sentTilesRev = -1;
    resetHudCache();

    if (role === 'host') {
      game.localOwner = 'p1';
      game.begin(true);
      game.best = Math.max(game.best, game.score);
      s.onData = (data) => handleHostMessage(data);
      s.onPeerLeave = () => {
        game.removePlayer('p2');
        showBanner('队友已离开，继续单人作战');
        if (game.mode === 'paused') {
          game.resume();
          showOverlay(null);
          setPlayingChrome(true);
        }
      };
    } else {
      const gv = new GuestView(game.best);
      gv.onOver = (reason, score) => reportRun(reason, score);
      gv.game.onBanner = game.onBanner;
      gv.game.mode = 'playing';
      guest = gv;
      view = gv.game;
      s.onData = (data) => handleGuestMessage(data);
      s.onPeerLeave = () => failNet('房主已离开房间');
      el.pauseDesc.textContent = touch.enabled
        ? '点击继续，返回战场。'
        : '按 Esc 或点击继续，返回战场。';
    }

    s.onClose = (reason) => failNet(reason);
    el.restartBtn.hidden = role === 'guest';
    showOverlay(null);
    setPlayingChrome(true);
    blurActive();
    updateHud(true);
  }

  function handleHostMessage(data: unknown) {
    if (!data || typeof data !== 'object') return;
    const msg = data as GameMsg;
    if (msg.t === 'input' && msg.c) {
      const c = msg.c;
      if (!Number.isFinite(c.mx) || !Number.isFinite(c.my)) return;
      game.setControls('p2', {
        mx: c.mx,
        my: c.my,
        aimX: Number.isFinite(c.aimX) ? c.aimX : WIDTH / 2,
        aimY: Number.isFinite(c.aimY) ? c.aimY : HEIGHT / 2,
        firing: !!c.firing,
      });
    } else if (msg.t === 'pause') {
      if (msg.v) pause();
      else resume();
    } else if (msg.t === 'restart') {
      if (game.mode === 'over' || game.mode === 'paused') restartRound();
    }
  }

  function handleGuestMessage(data: unknown) {
    if (!data || typeof data !== 'object') return;
    const msg = data as GameMsg;
    if (msg.t === 'snap' && msg.s) guest?.push(msg.s);
  }

  /* ---------------- 暂停 / 继续 / 重开 / 退出 ---------------- */
  function pause() {
    if (mode === 'guest') {
      if (view.mode === 'playing') session?.send({ t: 'pause', v: true });
      return;
    }
    if (game.mode !== 'playing') return;
    game.pause();
    showOverlay('pause');
    setPlayingChrome(false);
  }

  function resume() {
    if (mode === 'guest') {
      if (view.mode === 'paused') session?.send({ t: 'pause', v: false });
      return;
    }
    if (game.mode !== 'paused') return;
    game.resume();
    showOverlay(null);
    setPlayingChrome(true);
    blurActive();
  }

  function restartRound() {
    if (mode === 'guest') {
      session?.send({ t: 'restart' });
      return;
    }
    startedAt = Date.now();
    resetHudCache();
    game.begin(mode === 'host');
    showOverlay(null);
    setPlayingChrome(true);
    blurActive();
    updateHud(true);
  }

  function reportRun(reason: string, score: number) {
    const bestNow = Math.max(game.best, score);
    localStorage.setItem(BEST_KEY, String(bestNow));
    game.best = bestNow;
    addRun({
      gameId: 'tank',
      gameTitle: '坦克大战',
      score,
      wave: view.wave,
      duration: startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0,
      result: reason,
    });
    el.reason.textContent = reason;
    el.final.textContent = String(score);
    el.bestOver.textContent = String(bestNow);
    showOverlay('over');
    setPlayingChrome(false);
    updateHud(true);
  }

  function failNet(reason: string) {
    try {
      session?.leave();
    } catch {
      /* 忽略 */
    }
    session = null;
    guest = null;
    mode = null;
    view = game;
    game.pause();
    el.netReason.textContent = reason;
    showOverlay('net');
    setPlayingChrome(false);
  }

  function exitToLobby() {
    session?.leave();
    session = null;
    guest = null;
    mode = null;
    view = game;
    roomPanel.destroy();
    opts.onExit();
  }

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
        if (mode === 'guest') {
          if (view.mode === 'playing') {
            session?.send({ t: 'pause', v: true });
          } else if (view.mode === 'paused') {
            session?.send({ t: 'pause', v: false });
          }
          return;
        }
        if (game.mode === 'playing') pause();
        else if (game.mode === 'paused') resume();
      } else if (code === 'Enter' || code === 'Space') {
        if (mode === null && overlayName === 'menu') startSolo();
      } else if (code === 'KeyR' && game.mode === 'over' && mode !== 'guest') {
        restartRound();
      }
    },
  });

  frame.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'start') startSolo();
    else if (action === 'coop') openRoom();
    else if (action === 'restart') restartRound();
    else if (action === 'resume') resume();
    else if (action === 'pause') pause();
    else if (action === 'exit') exitToLobby();
  });

  /* ---------------- 游戏回调 ---------------- */
  game.onBanner = showBanner;

  game.onGameOver = (reason, score) => reportRun(reason, score);

  /* ---------------- HUD ---------------- */
  const cache = { score: -1, wave: -1, best: -1, armor: -1, armor2: -1, base: -1, count: -1 };

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
    if (force || view.score !== cache.score) {
      cache.score = view.score;
      el.score.textContent = String(view.score);
    }
    if (force || view.wave !== cache.wave) {
      cache.wave = view.wave;
      el.wave.textContent = String(view.wave);
    }
    const bestNow = Math.max(game.best, view.score);
    if (force || bestNow !== cache.best) {
      cache.best = bestNow;
      el.best.textContent = String(bestNow);
    }

    const count = view.players.length;
    if (force || count !== cache.count) {
      cache.count = count;
      el.mate.hidden = count < 2;
      el.p1Label.textContent = count > 1 ? '1P' : '护甲';
    }

    const p1 = view.players[0];
    const hp1 = p1 ? Math.max(0, Math.round(p1.hp)) : 0;
    if (force || hp1 !== cache.armor) {
      cache.armor = hp1;
      renderPips(el.armor, hp1, p1?.maxHp ?? 4, '');
    }

    const p2 = view.players[1];
    const hp2 = p2 ? Math.max(0, Math.round(p2.hp)) : 0;
    if (force || hp2 !== cache.armor2) {
      cache.armor2 = hp2;
      renderPips(el.armor2, hp2, p2?.maxHp ?? 4, 'p2');
    }

    const baseHp = Math.max(0, Math.round(view.base.hp));
    if (force || baseHp !== cache.base) {
      cache.base = baseHp;
      renderPips(el.base, baseHp, view.base.maxHp, 'base');
    }
  }
  game.onHud = () => updateHud();
  updateHud(true);

  /* ---------------- 客机状态镜像 ---------------- */
  const syncGuestOverlay = () => {
    if (!guest) return;
    if (view.mode === 'paused' && overlayName !== 'pause') {
      showOverlay('pause');
      setPlayingChrome(false);
    } else if (view.mode === 'playing' && (overlayName === 'pause' || overlayName === 'over')) {
      showOverlay(null);
      setPlayingChrome(true);
    }
  };

  /* ---------------- 主循环 ---------------- */
  const ownTank = () => {
    const owner = mode === 'guest' ? 'p2' : 'p1';
    return view.players.find((p) => p.ownerId === owner) ?? view.players[0] ?? null;
  };

  let raf = 0;
  let last = performance.now();

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;

    touch.setActive(view.mode === 'playing');

    const kx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const ky = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (kx !== 0 || ky !== 0) {
      local.mx = kx;
      local.my = ky;
    } else {
      local.mx = touch.move.x;
      local.my = touch.move.y;
    }

    const own = ownTank();
    if (touch.aim.active && touch.aim.mag > 0 && own) {
      local.aimX = own.x + touch.aim.x * 420;
      local.aimY = own.y + touch.aim.y * 420;
      local.firing = true;
    } else {
      local.aimX = input.pointer.x;
      local.aimY = input.pointer.y;
      local.firing = input.pointer.down;
    }

    if (mode === 'host' && session) {
      snapAcc += dt;
      if (snapAcc >= NET_STEP) {
        snapAcc = snapAcc % NET_STEP;
        const sendTiles = game.tilesRev !== sentTilesRev;
        session.send({ t: 'snap', s: encodeSnapshot(game, ++snapTick, sendTiles) });
        if (sendTiles) sentTilesRev = game.tilesRev;
      }
    }

    if (mode === 'guest' && guest && session) {
      guest.update(dt, now);
      syncGuestOverlay();
      inputAcc += dt;
      if (inputAcc >= NET_STEP) {
        inputAcc = inputAcc % NET_STEP;
        session.send({
          t: 'input',
          c: {
            mx: local.mx,
            my: local.my,
            aimX: local.aimX,
            aimY: local.aimY,
            firing: local.firing,
          },
        });
      }
    } else {
      game.update(dt);
    }

    const touchAiming = touch.aim.active && touch.aim.mag > 0;
    const reticle =
      touchAiming && own
        ? {
            x: Math.min(WIDTH - 16, Math.max(16, own.x + touch.aim.x * 150)),
            y: Math.min(HEIGHT - 16, Math.max(16, own.y + touch.aim.y * 150)),
            active: true,
          }
        : input.pointer;

    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    drawGame(ctx, view, reticle, now / 1000);
    updateHud();
  };
  raf = requestAnimationFrame(loop);

  if (new URLSearchParams(location.search).has('play')) startSolo();

  /* ---------------- 失焦自动暂停 ---------------- */
  const onVisibility = () => {
    if (!document.hidden) return;
    if (mode === 'guest') {
      if (view.mode === 'playing') session?.send({ t: 'pause', v: true });
    } else {
      pause();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.clearTimeout(startHintTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      roomPanel.destroy();
      session?.leave();
      session = null;
      ro.disconnect();
      input.dispose();
      touch.dispose();
      frame.remove();
    },
  };
}
