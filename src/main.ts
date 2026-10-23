import './style.css';
import { games, type GameMeta } from './games/registry';
import type { GameHandle } from './games/types';
import { sfx } from './engine/audio';

const app = document.querySelector<HTMLDivElement>('#app')!;
const SOUND_KEY = 'arcade.sound';

let handle: GameHandle | null = null;
let opening = false;
let viewToken = 0;

const soundOn = () => localStorage.getItem(SOUND_KEY) !== 'off';
const soundLabel = () => (soundOn() ? '音效 开' : '音效 关');
const isTouch = () =>
  window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
sfx.enabled = soundOn();

function toggleSound() {
  localStorage.setItem(SOUND_KEY, soundOn() ? 'off' : 'on');
  sfx.enabled = soundOn();
  if (sfx.enabled) sfx.click();
}

function soonCard(meta: GameMeta) {
  return `
    <article class="card soon">
      <div class="card-top">
        <span class="badge">即将上线</span>
        <span class="card-index">${meta.index}</span>
      </div>
      <h3>${meta.title}</h3>
      <p>${meta.description}</p>
      <div class="soon-foot">IN DEVELOPMENT</div>
    </article>`;
}

function renderLobby() {
  const featured = games.find((g) => g.status === 'ready') as GameMeta;
  const soon = games.filter((g) => g.status === 'soon');

  const view = document.createElement('div');
  view.className = 'lobby-view';
  view.innerHTML = `
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">A</div>
        <div>
          <div class="brand-name">ARCADE</div>
          <div class="brand-sub">游戏大厅</div>
        </div>
      </div>
      <button class="ghost-btn" type="button" data-sound>${soundLabel()}</button>
    </header>

    <main class="lobby">
      <section class="hero">
        <p class="eyebrow">SINGLE PLAYER · WEB ARCADE</p>
        <h1>选一个战场，<br />随时开打。</h1>
        <p class="hero-sub">轻量网页小游戏集合，打开即玩。更多游戏会陆续上线。</p>
      </section>

      <section class="game-grid">
        <article class="card featured" role="button" tabindex="0" data-open="${featured.id}">
          <div class="card-art">${featured.art ?? ''}</div>
          <div class="card-body">
            <div class="card-top">
              <span class="badge live">已上线</span>
              <span class="card-index">${featured.index}</span>
            </div>
            <h2>${featured.title}</h2>
            <p>${featured.description}</p>
            <ul class="tags">${featured.tags.map((t) => `<li>${t}</li>`).join('')}</ul>
            <button class="play-btn" type="button">
              开始游戏 <span class="arrow">→</span>
            </button>
          </div>
        </article>
        ${soon.map(soonCard).join('')}
      </section>

      <div class="lobby-foot">
        <span>共 ${games.filter((g) => g.status === 'ready').length} 款可用 · ${
          soon.length
        } 款筹备中</span>
        <span>单人模式 · ${isTouch() ? '支持触屏与键盘鼠标' : '建议使用键盘与鼠标'}</span>
      </div>
    </main>
  `;

  app.replaceChildren(view);

  view.querySelector('[data-sound]')?.addEventListener('click', (e) => {
    toggleSound();
    (e.currentTarget as HTMLElement).textContent = soundLabel();
  });

  const card = view.querySelector<HTMLElement>('[data-open]');
  card?.addEventListener('click', () => openGame(featured.id));
  card?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openGame(featured.id);
    }
  });
}

function exitGame() {
  viewToken++;
  handle?.destroy();
  handle = null;
  opening = false;
  document.title = 'ARCADE · 游戏大厅';
  renderLobby();
}

async function openGame(id: string) {
  const meta = games.find((g) => g.id === id);
  if (!meta || meta.status !== 'ready' || !meta.loader || opening) return;
  opening = true;

  sfx.unlock();
  sfx.click();

  const shell = document.createElement('section');
  shell.className = 'game-shell';
  shell.innerHTML = `
    <header class="game-bar">
      <button class="back-btn" type="button" data-back>← 返回大厅</button>
      <div class="game-bar-title">${meta.title}<span>${meta.mode}</span></div>
      <div class="spacer"></div>
      <button class="ghost-btn" type="button" data-sound>${soundLabel()}</button>
    </header>
    <div class="stage"></div>
    <div class="rotate-gate" data-rotate-gate>
      <div class="rotate-card">
        <svg class="rotate-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <rect x="21" y="10" width="22" height="44" rx="6" stroke="currentColor" stroke-width="2.5"/>
          <path d="M29 47.5h6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M50 22a20 20 0 0 1 0 20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M46.5 21.5 51 22l-.5-4.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <h2>横屏体验更好</h2>
        <p>坦克大战需要更宽的视野，旋转手机即可获得完整战场。</p>
        <button class="btn-secondary" type="button" data-rotate-skip>继续竖屏</button>
      </div>
    </div>
  `;

  document.title = `${meta.title} · ARCADE`;
  app.replaceChildren(shell);

  const stage = shell.querySelector<HTMLDivElement>('.stage')!;
  shell.querySelector('[data-back]')?.addEventListener('click', exitGame);
  shell.querySelector('[data-rotate-skip]')?.addEventListener('click', () => {
    shell.classList.add('gate-dismissed');
  });
  shell.querySelector('[data-sound]')?.addEventListener('click', (e) => {
    toggleSound();
    (e.currentTarget as HTMLElement).textContent = soundLabel();
  });

  const token = ++viewToken;
  try {
    const mod = await meta.loader();
    if (token !== viewToken) return;
    handle = mod.mount(stage, { onExit: exitGame });
    opening = false;
  } catch (err) {
    console.error('[arcade] 游戏加载失败', err);
    exitGame();
  }
}

renderLobby();

// 便于直接进入某个游戏（分享/调试用）
const direct = new URLSearchParams(location.search).get('game');
if (direct) void openGame(direct);
