import { comboName, rankLabel, suitSymbol, type Card } from './cards';
import { DdzGame, PLAYER_SEAT, SEAT_NAMES, type Seat } from './game';
import { comboSpeech, speak, voiceEnabled, setVoiceEnabled, cancelSpeech } from './speech';
import { sfx } from '../../engine/audio';
import { addRun } from '../../data/runs';
import { isMobileDevice } from '../../lib/device';
import type { GameHandle, MountOptions } from '../types';

const RECORD_KEY = 'ddz.record';

interface DdzRecord {
  wins: number;
  losses: number;
}

const loadRecord = (): DdzRecord => {
  try {
    const raw = JSON.parse(localStorage.getItem(RECORD_KEY) ?? '{}');
    return { wins: Number(raw.wins) || 0, losses: Number(raw.losses) || 0 };
  } catch {
    return { wins: 0, losses: 0 };
  }
};

const isRed = (card: Card) =>
  card.suit === 'heart' || card.suit === 'diamond' || card.rank === 17;

const miniCardHtml = (card: Card): string => {
  if (card.rank >= 16) {
    return `<span class="ddz-card mini joker${isRed(card) ? ' red' : ''}"><b>${
      card.rank === 17 ? '大' : '小'
    }</b><i>王</i></span>`;
  }
  return `<span class="ddz-card mini${isRed(card) ? ' red' : ''}"><b>${rankLabel(
    card.rank
  )}</b><i>${suitSymbol(card.suit)}</i></span>`;
};

const handCardHtml = (card: Card, selected: boolean): string => {
  if (card.rank >= 16) {
    return `<button type="button" class="ddz-card joker${isRed(card) ? ' red' : ''}${
      selected ? ' selected' : ''
    }" data-card="${card.id}">
      <span class="cc-joker-name">${rankLabel(card.rank)}</span>
      <span class="cc-joker-mark">JOKER</span>
    </button>`;
  }
  const suit = suitSymbol(card.suit);
  return `<button type="button" class="ddz-card${isRed(card) ? ' red' : ''}${
    selected ? ' selected' : ''
  }" data-card="${card.id}">
    <span class="cc-corner"><b>${rankLabel(card.rank)}</b><i>${suit}</i></span>
    <span class="cc-pip">${suit}</span>
  </button>`;
};

const seatHtml = (seat: Seat, side: 'left' | 'right'): string => `
  <div class="ddz-seat ${side}" data-seat="${seat}">
    <span class="ddz-avatar">${side === 'left' ? '左' : '右'}</span>
    <span class="ddz-seat-info">
      <span class="ddz-seat-name">${SEAT_NAMES[seat]}</span>
      <span class="ddz-seat-count">剩 <b data-count="${seat}">17</b> 张</span>
    </span>
    <span class="ddz-role" data-role="${seat}"></span>
  </div>
`;

export function mount(host: HTMLElement, opts: MountOptions): GameHandle {
  const touchDevice = isMobileDevice();

  host.innerHTML = `
    <div class="ddz-frame">
      <div class="ddz-head">
        <div class="ddz-title">斗地主<span>人机对战</span></div>
        <div class="ddz-head-meta">
          <span class="ddz-chip">倍数 <b data-mult>×1</b></span>
          <span class="ddz-chip ddz-record-chip">战绩 <b data-record>0胜 0负</b></span>
          <span class="ddz-chip ddz-bottom-chip">底牌 <span class="ddz-bottom-cards" data-bottom></span></span>
        </div>
        <button class="ddz-icon-btn ddz-voice-btn" type="button" data-action="voice">读牌 开</button>
        <button class="ddz-icon-btn" type="button" data-action="pause">暂停</button>
      </div>

      <div class="ddz-board">
        ${seatHtml(2, 'left')}
        ${seatHtml(1, 'right')}
        <div class="ddz-play left" data-play="2"></div>
        <div class="ddz-play right" data-play="1"></div>
        <div class="ddz-center">
          <div class="ddz-status" data-status>准备开始</div>
          <div class="ddz-toast" data-toast></div>
        </div>
      </div>

      <div class="ddz-foot" data-foot>
        <div class="ddz-play self" data-play="0"></div>
        <div class="ddz-actions" data-actions></div>
        <div class="ddz-hand" data-hand></div>
      </div>

      <div class="overlay" data-ov="menu">
        <div class="ov-card">
          <p class="ov-kicker">DOU DIZHU</p>
          <h2>斗地主</h2>
          <p class="ov-desc">三人斗地主，你与两名电脑对战。叫地主后获得三张底牌，先出完手牌的一方获胜；炸弹与王炸会让倍数翻倍。</p>
          <div class="ov-keys" data-keys>
            <div><kbd>点击</kbd><span>选牌 / 取消</span></div>
            <div><kbd>提示</kbd><span>自动选牌</span></div>
            <div><kbd>空格</kbd><span>出牌</span></div>
            <div><kbd>Esc</kbd><span>暂停</span></div>
          </div>
          <button class="btn-primary" type="button" data-action="start">开始对局</button>
        </div>
      </div>

      <div class="overlay hidden" data-ov="pause">
        <div class="ov-card">
          <p class="ov-kicker">PAUSED</p>
          <h2>已暂停</h2>
          <p class="ov-desc">叫地主与出牌的节奏都停下了，点击继续回到牌桌。</p>
          <div class="btn-row">
            <button class="btn-primary" type="button" data-action="resume">继续</button>
            <button class="btn-secondary" type="button" data-action="restart">重新发牌</button>
            <button class="btn-secondary" type="button" data-action="exit">返回大厅</button>
          </div>
        </div>
      </div>

      <div class="overlay hidden" data-ov="over">
        <div class="ov-card">
          <p class="ov-kicker">ROUND OVER</p>
          <h2 data-over-title>本局结束</h2>
          <p class="ov-reason" data-reason></p>
          <div class="ov-stats">
            <div class="ov-stat">
              <span class="hud-label">倍数</span>
              <strong data-final-mult>×1</strong>
            </div>
            <div class="ov-stat">
              <span class="hud-label">得分</span>
              <strong class="accent" data-final-score>0</strong>
            </div>
            <div class="ov-stat">
              <span class="hud-label">累计战绩</span>
              <strong data-record-over>0胜 0负</strong>
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

  const frame = host.querySelector<HTMLDivElement>('.ddz-frame')!;
  const el = {
    mult: host.querySelector<HTMLElement>('[data-mult]')!,
    record: host.querySelector<HTMLElement>('[data-record]')!,
    bottom: host.querySelector<HTMLElement>('[data-bottom]')!,
    hand: host.querySelector<HTMLElement>('[data-hand]')!,
    actions: host.querySelector<HTMLElement>('[data-actions]')!,
    status: host.querySelector<HTMLElement>('[data-status]')!,
    toast: host.querySelector<HTMLElement>('[data-toast]')!,
    foot: host.querySelector<HTMLElement>('[data-foot]')!,
    overTitle: host.querySelector<HTMLElement>('[data-over-title]')!,
    reason: host.querySelector<HTMLElement>('[data-reason]')!,
    finalMult: host.querySelector<HTMLElement>('[data-final-mult]')!,
    finalScore: host.querySelector<HTMLElement>('[data-final-score]')!,
    recordOver: host.querySelector<HTMLElement>('[data-record-over]')!,
    keys: host.querySelector<HTMLElement>('[data-keys]')!,
    voiceBtn: host.querySelector<HTMLElement>('[data-action="voice"]')!,
  };

  if (touchDevice) {
    el.keys.innerHTML = `
      <div><kbd>点击手牌</kbd><span>选中 / 取消</span></div>
      <div><kbd>提示</kbd><span>自动选牌</span></div>
      <div><kbd>出牌</kbd><span>打出选中牌</span></div>
      <div><kbd>暂停</kbd><span>右上角按钮</span></div>
    `;
  }

  const seatEls = [1, 2].map((seat) => ({
    seat: seat as Seat,
    root: host.querySelector<HTMLElement>(`[data-seat="${seat}"]`)!,
    count: host.querySelector<HTMLElement>(`[data-count="${seat}"]`)!,
    role: host.querySelector<HTMLElement>(`[data-role="${seat}"]`)!,
  }));
  const playEls = [0, 1, 2].map(
    (seat) => host.querySelector<HTMLElement>(`[data-play="${seat}"]`)!
  );
  const overlays = Array.from(host.querySelectorAll<HTMLElement>('.overlay'));

  let record = loadRecord();
  let paused = false;
  let startedAt = 0;
  let aiTimer = 0;
  let toastTimer = 0;
  let lastPlayKey = '';

  const game = new DdzGame({
    onChange: () => {
      render();
      schedule();
    },
    onToast: (message) => toast(message),
    onOver: (win) => handleOver(win),
    onPass: () => speak('不出'),
  });

  /* ---------------- 基础界面 ---------------- */

  const showOverlay = (name: 'menu' | 'pause' | 'over' | null) => {
    for (const o of overlays) o.classList.toggle('hidden', o.dataset.ov !== name);
  };

  const blurActive = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };

  function toast(message: string) {
    el.toast.textContent = message;
    el.toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => el.toast.classList.remove('show'), 1600);
  }

  const fitHand = () => {
    const count = Math.max(1, game.hands[PLAYER_SEAT].length);
    const available = Math.max(200, frame.clientWidth - 32);
    const overlap = 0.52;
    const width = Math.min(62, Math.max(26, available / (1 + (1 - overlap) * (count - 1))));
    frame.style.setProperty('--cw', `${width.toFixed(1)}px`);
  };

  function render() {
    fitHand();

    // 底牌
    el.bottom.innerHTML = game.bottom
      .map((card) =>
        game.bottomRevealed
          ? miniCardHtml(card)
          : '<span class="ddz-card mini back"></span>'
      )
      .join('');

    el.mult.textContent = `×${game.multiplier}`;
    el.record.textContent = `${record.wins}胜 ${record.losses}负`;

    const voiceOn = voiceEnabled();
    el.voiceBtn.textContent = voiceOn ? '读牌 开' : '读牌 关';
    el.voiceBtn.classList.toggle('off', !voiceOn);

    // 两名电脑的剩余牌数与身份
    for (const item of seatEls) {
      item.count.textContent = String(game.hands[item.seat].length);
      item.root.classList.toggle(
        'active',
        !paused &&
          ((game.phase === 'bid' && game.bidSeat === item.seat) ||
            (game.phase === 'play' && game.turn === item.seat))
      );

      const mark = game.bidMarks[item.seat];
      if (game.phase === 'bid' && mark) {
        item.role.textContent = mark === 'call' ? '叫地主' : '不叫';
        item.role.classList.toggle('landlord', mark === 'call');
      } else {
        const role = game.roleOf(item.seat);
        item.role.textContent = role === 'landlord' ? '地主' : role === 'farmer' ? '农民' : '';
        item.role.classList.toggle('landlord', role === 'landlord');
      }
    }

    // 桌面上的出牌
    for (let seat = 0; seat < 3; seat++) {
      const action = game.lastActions[seat as Seat];
      const node = playEls[seat];
      if (action === 'pass') {
        node.innerHTML = '<span class="ddz-pass">不出</span>';
      } else if (action) {
        node.innerHTML =
          `<span class="ddz-play-name">${comboName(action)}</span>` +
          action.cards.map(miniCardHtml).join('');
      } else {
        node.innerHTML = '';
      }
      node.classList.toggle('show', Boolean(action));
    }

    // 手牌
    const hand = game.hands[PLAYER_SEAT];
    el.hand.innerHTML = hand.length
      ? hand.map((card) => handCardHtml(card, game.selected.has(card.id))).join('')
      : '<span class="ddz-empty">手牌已出完</span>';
    el.foot.classList.toggle(
      'is-turn',
      !paused && game.phase === 'play' && game.turn === PLAYER_SEAT
    );

    // 状态与操作
    let status = '准备开始';
    if (paused) status = '已暂停';
    else if (game.phase === 'bid') {
      status =
        game.bidSeat === PLAYER_SEAT
          ? '轮到你叫地主'
          : `${SEAT_NAMES[game.bidSeat]}正在叫地主…`;
    } else if (game.phase === 'play') {
      status = game.turn === PLAYER_SEAT ? '轮到你出牌' : `${SEAT_NAMES[game.turn]}出牌中…`;
    } else if (game.phase === 'over') {
      status = game.playerWon() ? '你赢了' : '惜败';
    }
    el.status.textContent = status;

    renderActions();

    // 牌桌上的出牌音效（只在最新一手变化时触发）
    const key = game.lastPlay
      ? game.lastPlay.combo.cards
          .map((c) => c.id)
          .sort((a, b) => a - b)
          .join(',')
      : '';
    if (key && key !== lastPlayKey) {
      const combo = game.lastPlay?.combo;
      if (combo && (combo.type === 'bomb' || combo.type === 'rocket')) sfx.bomb();
      else sfx.card(combo?.cards.length ?? 1);
      if (combo) speak(comboSpeech(combo));
    }
    lastPlayKey = key;
  }

  function renderActions() {
    if (game.phase === 'bid' && game.bidSeat === PLAYER_SEAT) {
      el.actions.innerHTML = `
        <button class="ddz-act primary" type="button" data-action="call">叫地主</button>
        <button class="ddz-act" type="button" data-action="nobid">不叫</button>
      `;
      return;
    }

    if (game.phase === 'play' && game.turn === PLAYER_SEAT) {
      const canPass = Boolean(game.lastPlay && game.lastPlay.seat !== PLAYER_SEAT);
      const count = game.selected.size;
      el.actions.innerHTML = `
        <button class="ddz-act" type="button" data-action="hint">提示</button>
        <button class="ddz-act" type="button" data-action="pass"${
          canPass ? '' : ' disabled'
        }>不出</button>
        <button class="ddz-act primary" type="button" data-action="play"${
          count ? '' : ' disabled'
        }>出牌${count ? ` (${count})` : ''}</button>
      `;
      return;
    }

    if (game.phase === 'bid') {
      el.actions.innerHTML = '<span class="ddz-wait">等待电脑叫地主…</span>';
    } else if (game.phase === 'play') {
      el.actions.innerHTML = '<span class="ddz-wait">等待电脑出牌…</span>';
    } else {
      el.actions.innerHTML = '';
    }
  }

  /* ---------------- 开始 / 暂停 ---------------- */

  function start() {
    sfx.unlock();
    sfx.click();
    paused = false;
    startedAt = Date.now();
    lastPlayKey = '';
    showOverlay(null);
    blurActive();
    game.begin();
  }

  function pause() {
    if (paused) return;
    if (game.phase === 'idle' || game.phase === 'over') return;
    paused = true;
    window.clearTimeout(aiTimer);
    aiTimer = 0;
    showOverlay('pause');
    render();
  }

  function resume() {
    if (!paused) return;
    paused = false;
    showOverlay(null);
    blurActive();
    render();
    schedule();
  }

  function schedule() {
    window.clearTimeout(aiTimer);
    aiTimer = 0;
    if (paused || game.phase === 'over' || game.phase === 'idle') return;

    const aiTurn =
      (game.phase === 'bid' && game.bidSeat !== PLAYER_SEAT) ||
      (game.phase === 'play' && game.turn !== PLAYER_SEAT);
    if (!aiTurn) return;

    aiTimer = window.setTimeout(
      () => {
        aiTimer = 0;
        game.aiStep();
      },
      700 + Math.random() * 450
    );
  }

  /* ---------------- 结算 ---------------- */

  function handleOver(win: boolean) {
    record = {
      wins: record.wins + (win ? 1 : 0),
      losses: record.losses + (win ? 0 : 1),
    };
    localStorage.setItem(RECORD_KEY, JSON.stringify(record));

    const score = game.scoreForPlayer();
    addRun({
      gameId: 'doudizhu',
      gameTitle: '斗地主',
      score,
      wave: game.multiplier,
      duration: startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0,
      result: win ? 'win' : 'lose',
    });

    if (win) sfx.win();
    else sfx.gameOver();

    const isLandlord = game.landlord === PLAYER_SEAT;
    if (win) {
      el.overTitle.textContent = '你赢了';
      el.reason.textContent = isLandlord
        ? '地主先走完手牌，两名农民只能认输。'
        : '农民阵营先走完手牌，成功掀翻地主。';
    } else {
      el.overTitle.textContent = '惜败';
      el.reason.textContent = isLandlord
        ? '地主的手牌被农民先走完了，再试一次。'
        : '地主先走完手牌，这次没能拦住。';
    }

    el.finalMult.textContent = `×${game.multiplier}`;
    el.finalScore.textContent = String(score);
    el.recordOver.textContent = `${record.wins}胜 ${record.losses}负`;
    showOverlay('over');
    render();
  }

  /* ---------------- 事件 ---------------- */

  frame.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    const cardBtn = target.closest<HTMLElement>('[data-card]');
    if (cardBtn) {
      const id = Number(cardBtn.dataset.card);
      if (!Number.isNaN(id)) {
        sfx.unlock();
        sfx.click();
        game.toggleCard(id);
      }
      return;
    }

    const btn = target.closest<HTMLElement>('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'start' || action === 'restart') {
      start();
    } else if (action === 'resume') {
      resume();
    } else if (action === 'pause') {
      pause();
    } else if (action === 'voice') {
      setVoiceEnabled(!voiceEnabled());
      sfx.unlock();
      sfx.click();
      render();
    } else if (action === 'exit') {
      opts.onExit();
    } else if (action === 'call' || action === 'nobid') {
      sfx.unlock();
      sfx.click();
      game.bid(PLAYER_SEAT, action === 'call');
    } else if (action === 'hint') {
      sfx.click();
      game.playerHint();
    } else if (action === 'play') {
      game.playerPlay();
    } else if (action === 'pass') {
      if (game.playerPass()) sfx.ping();
    }
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (paused) resume();
      else pause();
      return;
    }
    if (e.key === 'Enter' && (game.phase === 'idle' || game.phase === 'over')) {
      start();
      return;
    }
    if (paused || game.turn !== PLAYER_SEAT || game.phase !== 'play') return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      game.playerPlay();
    } else if (e.key === 'h' || e.key === 'H') {
      game.playerHint();
    } else if (e.key === 'p' || e.key === 'P') {
      if (game.playerPass()) sfx.ping();
    }
  };
  window.addEventListener('keydown', onKey);

  const onVisibility = () => {
    if (document.hidden) pause();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const ro = new ResizeObserver(() => fitHand());
  ro.observe(frame);

  render();
  if (new URLSearchParams(location.search).has('play')) start();

  return {
    destroy() {
      window.clearTimeout(aiTimer);
      window.clearTimeout(toastTimer);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      cancelSpeech();
      ro.disconnect();
      frame.remove();
    },
  };
}
