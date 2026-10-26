import { beats, comboName, parseCombo, type Card } from './cards';
import {
  DdzGame,
  PLAYER_SEAT,
  SEAT_NAMES,
  nextSeat,
  type Phase,
  type Seat,
} from './game';
import {
  comboSpeech,
  speak,
  voiceEnabled,
  setVoiceEnabled,
  cancelSpeech,
} from './speech';
import { handCardHtml, miniCardHtml, seatHtml } from './view';
import { DdzOnline, type OnlineRoom } from './online';
import { snapWon, type DdzSnap } from './net';
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

type Pos = 'left' | 'right' | 'self';
type Mode = 'solo' | 'online';
type OverlayName = 'menu' | 'room' | 'pause' | 'over';
type ActionView = { cards: Card[]; name: string } | 'pass' | null;

/** 牌桌渲染所需的统一视图，人机与联机共用同一套 DOM。 */
interface BoardView {
  self: Seat;
  names: [string, string, string];
  phase: Phase;
  hand: Card[];
  counts: [number, number, number];
  selected: Set<number>;
  bottom: Card[];
  bottomRevealed: boolean;
  bidSeat: Seat;
  bidMarks: ('call' | 'pass' | null)[];
  turn: Seat;
  landlord: Seat | null;
  actions: ActionView[];
  multiplier: number;
  canPass: boolean;
  status: string;
}

/** 显示位置对应的实际座位：自己永远在下方，下家在右，上家在左。 */
const seatAt = (self: Seat, pos: Pos): Seat =>
  pos === 'self' ? self : pos === 'right' ? nextSeat(self) : nextSeat(nextSeat(self));

const comboText = (cards: Card[]): string => {
  const combo = parseCombo(cards);
  return combo ? comboName(combo) : '';
};

const boardStatus = (
  phase: Phase,
  bidSeat: Seat,
  turn: Seat,
  self: Seat,
  names: [string, string, string],
  overText: string
): string => {
  if (phase === 'bid') {
    return bidSeat === self ? '轮到你叫地主' : `${names[bidSeat]}正在叫地主…`;
  }
  if (phase === 'play') {
    return turn === self ? '轮到你出牌' : `${names[turn]}出牌中…`;
  }
  if (phase === 'over') return overText;
  return '准备开始';
};

export function mount(host: HTMLElement, opts: MountOptions): GameHandle {
  const touchDevice = isMobileDevice();

  host.innerHTML = `
    <div class="ddz-frame">
      <div class="ddz-head">
        <div class="ddz-title">斗地主<span data-mode-label>人机对战</span></div>
        <div class="ddz-head-meta">
          <span class="ddz-chip">倍数 <b data-mult>×1</b></span>
          <span class="ddz-chip ddz-record-chip">战绩 <b data-record>0胜 0负</b></span>
          <span class="ddz-chip ddz-bottom-chip">底牌 <span class="ddz-bottom-cards" data-bottom></span></span>
        </div>
        <button class="ddz-icon-btn ddz-voice-btn" type="button" data-action="voice">读牌 开</button>
        <button class="ddz-icon-btn" type="button" data-action="pause" data-pause>暂停</button>
      </div>

      <div class="ddz-board">
        ${seatHtml('left')}
        ${seatHtml('right')}
        <div class="ddz-play left" data-play="left"></div>
        <div class="ddz-play right" data-play="right"></div>
        <div class="ddz-center">
          <div class="ddz-status" data-status>准备开始</div>
          <div class="ddz-toast" data-toast></div>
        </div>
      </div>

      <div class="ddz-foot" data-foot>
        <div class="ddz-play self" data-play="self"></div>
        <div class="ddz-actions" data-actions></div>
        <div class="ddz-hand" data-hand></div>
      </div>

      <div class="overlay" data-ov="menu">
        <div class="ov-card">
          <p class="ov-kicker">DOU DIZHU</p>
          <h2>斗地主</h2>
          <p class="ov-desc">三人斗地主，先叫地主获得三张底牌，先出完手牌的一方获胜；炸弹与王炸会让倍数翻倍。可与电脑对战，也可建房和朋友联机，空位由电脑补上。</p>
          <div class="ov-keys" data-keys>
            <div><kbd>点击</kbd><span>选牌 / 取消</span></div>
            <div><kbd>提示</kbd><span>自动选牌</span></div>
            <div><kbd>空格</kbd><span>出牌</span></div>
            <div><kbd>Esc</kbd><span>暂停</span></div>
          </div>
          <div class="btn-row">
            <button class="btn-primary" type="button" data-action="start">人机对战</button>
            <button class="btn-secondary" type="button" data-action="online">联机对战 · 局域网</button>
          </div>
        </div>
      </div>

      <div class="overlay hidden" data-ov="room">
        <div class="ov-card">
          <p class="ov-kicker">LAN DOU DIZHU</p>
          <h2>联机对战</h2>
          <div data-room-body></div>
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
          <p class="ov-desc" data-over-wait hidden>等待房主开始下一局…</p>
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
            <button class="btn-primary" type="button" data-action="restart" data-over-restart>再来一局</button>
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
    modeLabel: host.querySelector<HTMLElement>('[data-mode-label]')!,
    overTitle: host.querySelector<HTMLElement>('[data-over-title]')!,
    reason: host.querySelector<HTMLElement>('[data-reason]')!,
    finalMult: host.querySelector<HTMLElement>('[data-final-mult]')!,
    finalScore: host.querySelector<HTMLElement>('[data-final-score]')!,
    recordOver: host.querySelector<HTMLElement>('[data-record-over]')!,
    keys: host.querySelector<HTMLElement>('[data-keys]')!,
    voiceBtn: host.querySelector<HTMLElement>('[data-action="voice"]')!,
    pauseBtn: host.querySelector<HTMLElement>('[data-action="pause"]')!,
    restartBtn: host.querySelector<HTMLElement>('[data-over-restart]')!,
    overWait: host.querySelector<HTMLElement>('[data-over-wait]')!,
    roomBody: host.querySelector<HTMLElement>('[data-room-body]')!,
  };

  if (touchDevice) {
    el.keys.innerHTML = `
      <div><kbd>点击手牌</kbd><span>选中 / 取消</span></div>
      <div><kbd>提示</kbd><span>自动选牌</span></div>
      <div><kbd>出牌</kbd><span>打出选中牌</span></div>
      <div><kbd>暂停</kbd><span>右上角按钮</span></div>
    `;
  }

  const seatEls = {
    left: {
      root: host.querySelector<HTMLElement>('[data-pos="left"]')!,
      name: host.querySelector<HTMLElement>('[data-name="left"]')!,
      count: host.querySelector<HTMLElement>('[data-count="left"]')!,
      role: host.querySelector<HTMLElement>('[data-role="left"]')!,
    },
    right: {
      root: host.querySelector<HTMLElement>('[data-pos="right"]')!,
      name: host.querySelector<HTMLElement>('[data-name="right"]')!,
      count: host.querySelector<HTMLElement>('[data-count="right"]')!,
      role: host.querySelector<HTMLElement>('[data-role="right"]')!,
    },
  };
  const playEls = {
    left: host.querySelector<HTMLElement>('[data-play="left"]')!,
    right: host.querySelector<HTMLElement>('[data-play="right"]')!,
    self: host.querySelector<HTMLElement>('[data-play="self"]')!,
  };
  const overlays = Array.from(host.querySelectorAll<HTMLElement>('.overlay'));

  let record = loadRecord();
  let mode: Mode = 'solo';
  let paused = false;
  let startedAt = 0;
  let aiTimer = 0;
  let toastTimer = 0;
  let lastCount = 17;

  let room: OnlineRoom | null = null;
  let onlineStarted = false;
  let onlineSnap: DdzSnap | null = null;
  let onlineSel = new Set<number>();
  let onlineSettled = false;
  let prevPhase: Phase = 'idle';
  let lastEventSeq = 0;

  /* ---------------- 基础界面 ---------------- */

  const showOverlay = (name: OverlayName | null) => {
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

  const fitHand = (count: number) => {
    const total = Math.max(1, count);
    const available = Math.max(200, frame.clientWidth - 32);
    const overlap = 0.52;
    const width = Math.min(62, Math.max(26, available / (1 + (1 - overlap) * (total - 1))));
    frame.style.setProperty('--cw', `${width.toFixed(1)}px`);
  };

  /* ---------------- 渲染 ---------------- */

  function renderBoard(v: BoardView) {
    lastCount = v.hand.length;
    fitHand(lastCount);

    el.bottom.innerHTML = v.bottom
      .map((card) =>
        v.bottomRevealed ? miniCardHtml(card) : '<span class="ddz-card mini back"></span>'
      )
      .join('');

    el.mult.textContent = `×${v.multiplier}`;
    el.record.textContent = `${record.wins}胜 ${record.losses}负`;

    const voiceOn = voiceEnabled();
    el.voiceBtn.textContent = voiceOn ? '读牌 开' : '读牌 关';
    el.voiceBtn.classList.toggle('off', !voiceOn);

    for (const pos of ['left', 'right'] as const) {
      const seat = seatAt(v.self, pos);
      const item = seatEls[pos];
      item.name.textContent = v.names[seat];
      item.count.textContent = String(v.counts[seat]);
      item.root.classList.toggle(
        'active',
        !paused &&
          ((v.phase === 'bid' && v.bidSeat === seat) ||
            (v.phase === 'play' && v.turn === seat))
      );

      const mark = v.bidMarks[seat];
      if (v.phase === 'bid' && mark) {
        item.role.textContent = mark === 'call' ? '叫地主' : '不叫';
        item.role.classList.toggle('landlord', mark === 'call');
      } else {
        const role =
          v.landlord === null ? null : seat === v.landlord ? 'landlord' : 'farmer';
        item.role.textContent = role === 'landlord' ? '地主' : role === 'farmer' ? '农民' : '';
        item.role.classList.toggle('landlord', role === 'landlord');
      }
    }

    for (const pos of ['left', 'right', 'self'] as const) {
      const seat = seatAt(v.self, pos);
      const action = v.actions[seat];
      const node = playEls[pos];
      if (action === 'pass') {
        node.innerHTML = '<span class="ddz-pass">不出</span>';
      } else if (action) {
        node.innerHTML =
          `<span class="ddz-play-name">${action.name}</span>` +
          action.cards.map(miniCardHtml).join('');
      } else {
        node.innerHTML = '';
      }
      node.classList.toggle('show', Boolean(action));
    }

    el.hand.innerHTML = v.hand.length
      ? v.hand.map((card) => handCardHtml(card, v.selected.has(card.id))).join('')
      : '<span class="ddz-empty">手牌已出完</span>';
    el.foot.classList.toggle(
      'is-turn',
      !paused && v.phase === 'play' && v.turn === v.self
    );
    el.status.textContent = paused ? '已暂停' : v.status;
    renderActions(v);
  }

  function renderActions(v: BoardView) {
    if (v.phase === 'bid' && v.bidSeat === v.self) {
      el.actions.innerHTML = `
        <button class="ddz-act primary" type="button" data-action="call">叫地主</button>
        <button class="ddz-act" type="button" data-action="nobid">不叫</button>
      `;
      return;
    }

    if (v.phase === 'play' && v.turn === v.self) {
      const count = v.selected.size;
      el.actions.innerHTML = `
        <button class="ddz-act" type="button" data-action="hint">提示</button>
        <button class="ddz-act" type="button" data-action="reset"${
          count ? '' : ' disabled'
        }>复位</button>
        <button class="ddz-act" type="button" data-action="pass"${
          v.canPass ? '' : ' disabled'
        }>不出</button>
        <button class="ddz-act primary" type="button" data-action="play"${
          count ? '' : ' disabled'
        }>出牌${count ? ` (${count})` : ''}</button>
      `;
      return;
    }

    if (v.phase === 'bid') {
      el.actions.innerHTML = `<span class="ddz-wait">等待${v.names[v.bidSeat]}叫地主…</span>`;
    } else if (v.phase === 'play') {
      el.actions.innerHTML = `<span class="ddz-wait">等待${v.names[v.turn]}出牌…</span>`;
    } else {
      el.actions.innerHTML = '';
    }
  }

  function soloView(): BoardView {
    const self = PLAYER_SEAT;
    const names: [string, string, string] = [SEAT_NAMES[0], SEAT_NAMES[1], SEAT_NAMES[2]];
    const actions: ActionView[] = game.lastActions.map((action) => {
      if (action === 'pass') return 'pass';
      return action ? { cards: action.cards, name: comboName(action) } : null;
    });
    return {
      self,
      names,
      phase: game.phase,
      hand: game.hands[self],
      counts: [game.hands[0].length, game.hands[1].length, game.hands[2].length],
      selected: game.selected,
      bottom: game.bottom,
      bottomRevealed: game.bottomRevealed,
      bidSeat: game.bidSeat,
      bidMarks: game.bidMarks,
      turn: game.turn,
      landlord: game.landlord,
      actions,
      multiplier: game.multiplier,
      canPass: Boolean(game.lastPlay && game.lastPlay.seat !== self),
      status: paused
        ? '已暂停'
        : boardStatus(
            game.phase,
            game.bidSeat,
            game.turn,
            self,
            names,
            game.playerWon() ? '你赢了' : '惜败'
          ),
    };
  }

  function onlineView(snap: DdzSnap): BoardView {
    const self = snap.you;
    const names: [string, string, string] = ['房主', '玩家2', '玩家3'];
    for (const seat of [0, 1, 2] as Seat[]) {
      if (!snap.human[seat]) names[seat] = '电脑';
    }
    names[self] = '你';

    const actions: ActionView[] = snap.lastActions.map((action) => {
      if (action === 'pass') return 'pass';
      return action ? { cards: action.cards, name: comboText(action.cards) } : null;
    });

    return {
      self,
      names,
      phase: snap.phase,
      hand: snap.hand,
      counts: snap.counts,
      selected: onlineSel,
      bottom: snap.bottom,
      bottomRevealed: snap.bottomRevealed,
      bidSeat: snap.bidSeat,
      bidMarks: snap.bidMarks,
      turn: snap.turn,
      landlord: snap.landlord,
      actions,
      multiplier: snap.multiplier,
      canPass: Boolean(snap.lastPlay && snap.lastPlay.seat !== self),
      status: boardStatus(
        snap.phase,
        snap.bidSeat,
        snap.turn,
        self,
        names,
        snapWon(snap, self) ? '你赢了' : '惜败'
      ),
    };
  }

  function renderSolo() {
    renderBoard(soloView());
  }

  function renderCurrent() {
    if (mode === 'online' && onlineSnap) renderBoard(onlineView(onlineSnap));
    else renderSolo();
  }

  /* ---------------- 人机对局 ---------------- */

  const game = new DdzGame({
    onChange: () => {
      if (mode !== 'solo') return;
      renderSolo();
      schedule();
    },
    onToast: (message) => toast(message),
    onOver: (win) => handleOver(win, game.multiplier, game.landlord, PLAYER_SEAT),
    onPlay: (_seat, combo) => {
      if (combo.type === 'bomb' || combo.type === 'rocket') sfx.bomb();
      else sfx.card(combo.cards.length);
      speak(comboSpeech(combo));
    },
    onPass: () => speak('不出'),
  });

  function schedule() {
    window.clearTimeout(aiTimer);
    aiTimer = 0;
    if (paused || mode !== 'solo' || game.phase === 'over' || game.phase === 'idle') return;

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

  function startSolo() {
    if (mode === 'online') {
      online.leave();
      onlineStarted = false;
      onlineSnap = null;
      onlineSel.clear();
      onlineSettled = false;
      prevPhase = 'idle';
      room = null;
    }
    mode = 'solo';
    el.modeLabel.textContent = '人机对战';
    el.pauseBtn.hidden = false;

    sfx.unlock();
    sfx.click();
    paused = false;
    startedAt = Date.now();
    showOverlay(null);
    blurActive();
    game.begin();
  }

  function pause() {
    if (mode === 'online' || paused) return;
    if (game.phase === 'idle' || game.phase === 'over') return;
    paused = true;
    window.clearTimeout(aiTimer);
    aiTimer = 0;
    showOverlay('pause');
    renderSolo();
  }

  function resume() {
    if (mode === 'online' || !paused) return;
    paused = false;
    showOverlay(null);
    blurActive();
    renderSolo();
    schedule();
  }

  /* ---------------- 结算 ---------------- */

  function handleOver(win: boolean, multiplier: number, landlord: Seat | null, self: Seat) {
    record = {
      wins: record.wins + (win ? 1 : 0),
      losses: record.losses + (win ? 0 : 1),
    };
    localStorage.setItem(RECORD_KEY, JSON.stringify(record));

    const score = win ? 100 * multiplier : 0;
    addRun({
      gameId: 'doudizhu',
      gameTitle: '斗地主',
      score,
      wave: multiplier,
      duration: startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0,
      result: win ? 'win' : 'lose',
    });

    if (win) sfx.win();
    else sfx.gameOver();

    const isLandlord = landlord === self;
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

    const canRestart = mode === 'solo' || online.isHost;
    el.finalMult.textContent = `×${multiplier}`;
    el.finalScore.textContent = String(score);
    el.recordOver.textContent = `${record.wins}胜 ${record.losses}负`;
    el.restartBtn.hidden = !canRestart;
    el.overWait.hidden = canRestart;
    showOverlay('over');
  }

  /* ---------------- 联机 ---------------- */

  const online = new DdzOnline({
    onRoom: (next) => {
      room = next;
      if (!onlineStarted) {
        renderRoom();
        showOverlay('room');
      }
    },
    onStart: () => {
      mode = 'online';
      onlineStarted = true;
      onlineSnap = null;
      onlineSel.clear();
      onlineSettled = false;
      prevPhase = 'idle';
      lastEventSeq = 0;
      paused = false;
      startedAt = Date.now();
      room = null;
      el.modeLabel.textContent = '联机对战';
      el.pauseBtn.hidden = true;
      showOverlay(null);
      blurActive();
    },
    onState: (snap) => applySnap(snap),
    onToast: (message) => toast(message),
    onFatal: (message) => failOnline(message),
  });

  function applySnap(snap: DdzSnap) {
    if (!onlineStarted) return;
    onlineSnap = snap;
    if (snap.phase !== 'play' || snap.turn !== snap.you) onlineSel.clear();

    if (prevPhase === 'over' && snap.phase !== 'over') {
      startedAt = Date.now();
      onlineSettled = false;
      onlineSel.clear();
      showOverlay(null);
    }
    prevPhase = snap.phase;

    renderBoard(onlineView(snap));

    const evt = snap.event;
    if (evt && evt.seq > lastEventSeq) {
      lastEventSeq = evt.seq;
      if (evt.kind === 'play') {
        const combo = parseCombo(evt.cards);
        if (combo) {
          if (combo.type === 'bomb' || combo.type === 'rocket') sfx.bomb();
          else sfx.card(combo.cards.length);
          speak(comboSpeech(combo));
        }
      } else {
        speak('不出');
      }
    }

    if (snap.phase === 'over' && !onlineSettled) {
      onlineSettled = true;
      handleOver(
        snapWon(snap, snap.you),
        snap.multiplier,
        snap.landlord,
        snap.you
      );
    }
  }

  function failOnline(message: string) {
    online.leave();
    onlineStarted = false;
    onlineSnap = null;
    onlineSel.clear();
    onlineSettled = false;
    prevPhase = 'idle';
    paused = false;
    mode = 'online';
    el.modeLabel.textContent = '联机对战';
    el.pauseBtn.hidden = true;
    room = { step: 'error', code: '', guests: 0, note: '', error: message };
    renderRoom();
    showOverlay('room');
    toast(message);
  }

  /* ---------------- 房间面板 ---------------- */

  function renderRoom() {
    if (!room) {
      el.roomBody.innerHTML = `
        <p class="ov-desc">三人斗地主。建房后把房间码发给朋友；只要有一人加入就能开始，剩下的空位由电脑补上。</p>
        <input class="room-code-input" data-code-input maxlength="4" placeholder="房间码" autocomplete="off" spellcheck="false" />
        <div class="btn-row ddz-room-actions">
          <button class="btn-primary" type="button" data-action="host">创建房间</button>
          <button class="btn-secondary" type="button" data-action="join">加入房间</button>
        </div>
        <button class="room-back" type="button" data-action="room-back">返回</button>
      `;
      return;
    }

    if (room.step === 'error') {
      el.roomBody.innerHTML = `
        <p class="room-error">${room.error}</p>
        <div class="btn-row">
          <button class="btn-primary" type="button" data-action="room-reset">重新选择</button>
          <button class="btn-secondary" type="button" data-action="room-back">返回</button>
        </div>
      `;
      return;
    }

    if (room.step === 'hosting') {
      const guests = room.guests;
      el.roomBody.innerHTML = `
        <div class="room-code">${room.code || '····'}</div>
        <p class="room-note${guests ? ' ok' : ''}">${room.note}</p>
        <div class="ddz-room-slots">
          <span class="ddz-room-slot on">房主（你）</span>
          <span class="ddz-room-slot${guests >= 1 ? ' on' : ''}">${
            guests >= 1 ? '玩家 2 已加入' : '空位 · 由电脑补位'
          }</span>
          <span class="ddz-room-slot${guests >= 2 ? ' on' : ''}">${
            guests >= 2 ? '玩家 3 已加入' : '空位 · 由电脑补位'
          }</span>
        </div>
        <div class="btn-row">
          <button class="btn-primary" type="button" data-action="online-start"${
            guests >= 1 ? '' : ' disabled'
          }>开始对局</button>
          <button class="btn-secondary" type="button" data-action="room-leave">解散房间</button>
        </div>
      `;
      return;
    }

    el.roomBody.innerHTML = `
      <div class="room-code">${room.code}</div>
      <p class="room-note ok">${room.note}</p>
      <div class="ddz-room-slots">
        <span class="ddz-room-slot on">房主</span>
        <span class="ddz-room-slot on">你</span>
      </div>
      <div class="btn-row">
        <button class="btn-secondary" type="button" data-action="room-leave">离开房间</button>
      </div>
    `;
  }

  function openOnline() {
    online.leave();
    onlineStarted = false;
    onlineSnap = null;
    onlineSel.clear();
    onlineSettled = false;
    prevPhase = 'idle';
    room = null;
    mode = 'online';
    el.modeLabel.textContent = '联机对战';
    el.pauseBtn.hidden = true;
    sfx.unlock();
    sfx.click();
    renderRoom();
    showOverlay('room');
  }

  async function hostRoom() {
    sfx.click();
    room = { step: 'hosting', code: '', guests: 0, note: '正在创建房间…', error: '' };
    renderRoom();
    await online.hostRoom();
  }

  async function joinRoom() {
    const input = host.querySelector<HTMLInputElement>('[data-code-input]');
    const code = input?.value.trim().toUpperCase() ?? '';
    if (code.length !== 4) {
      toast('请输入 4 位房间码');
      return;
    }
    sfx.click();
    room = { step: 'waiting', code, guests: 0, note: '正在连接房间…', error: '' };
    renderRoom();
    await online.joinRoom(code);
  }

  function startOnlineGame() {
    if (!room || room.step !== 'hosting') return;
    sfx.click();
    if (room.guests < 1) {
      toast('至少需要一名玩家加入房间');
      return;
    }
    online.start();
  }

  function restartOnline() {
    if (!online.isHost) return;
    sfx.click();
    onlineSettled = false;
    onlineSel.clear();
    startedAt = Date.now();
    showOverlay(null);
    online.restart();
  }

  function leaveToMenu() {
    online.leave();
    onlineStarted = false;
    onlineSnap = null;
    onlineSel.clear();
    onlineSettled = false;
    prevPhase = 'idle';
    room = null;
    mode = 'solo';
    paused = false;
    el.modeLabel.textContent = '人机对战';
    el.pauseBtn.hidden = false;
    showOverlay('menu');
    renderSolo();
  }

  /* ---------------- 操作路由 ---------------- */

  function doBid(call: boolean) {
    sfx.unlock();
    sfx.click();
    if (mode === 'online') online.actBid(call);
    else game.bid(PLAYER_SEAT, call);
  }

  function doHint() {
    sfx.click();
    if (mode === 'online') {
      const snap = onlineSnap;
      if (!snap) return;
      const cards = online.hint();
      if (!cards.length) {
        toast(
          snap.lastPlay && snap.lastPlay.seat !== snap.you
            ? '没有能压过的牌，只能不出'
            : '没有可出的牌'
        );
        return;
      }
      onlineSel = new Set(cards.map((card) => card.id));
      renderBoard(onlineView(snap));
      return;
    }
    game.playerHint();
  }

  /** 复位：取消所有已上移选中的牌 */
  function resetSelection() {
    if (mode === 'online') {
      const snap = onlineSnap;
      if (!snap || snap.phase !== 'play' || snap.turn !== snap.you) return;
      if (!onlineSel.size) return;
      sfx.click();
      onlineSel.clear();
      renderBoard(onlineView(snap));
      return;
    }
    if (!game.selected.size) return;
    sfx.click();
    game.clearSelection();
  }

  function doPass() {
    if (mode === 'online') {
      const snap = onlineSnap;
      if (!snap || !snap.lastPlay || snap.lastPlay.seat === snap.you) return;
      onlineSel.clear();
      online.actPass();
      sfx.ping();
      renderBoard(onlineView(snap));
      return;
    }
    if (game.playerPass()) sfx.ping();
  }

  function doPlay() {
    if (mode === 'online') {
      const snap = onlineSnap;
      if (!snap || snap.phase !== 'play' || snap.turn !== snap.you) return;
      if (!onlineSel.size) {
        toast('请先选择要出的牌');
        return;
      }
      const cards = snap.hand.filter((card) => onlineSel.has(card.id));
      const combo = parseCombo(cards);
      if (!combo) {
        toast('这不是合法牌型');
        return;
      }
      if (snap.lastPlay && snap.lastPlay.seat !== snap.you) {
        const target = parseCombo(snap.lastPlay.cards);
        if (!target || !beats(combo, target)) {
          toast('打不过上家的牌');
          return;
        }
      }
      sfx.click();
      online.actPlay(cards.map((card) => card.id));
      onlineSel.clear();
      renderBoard(onlineView(snap));
      return;
    }
    game.playerPlay();
  }

  /* ---------------- 事件 ---------------- */

  frame.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    const cardBtn = target.closest<HTMLElement>('[data-card]');
    if (cardBtn) {
      const id = Number(cardBtn.dataset.card);
      if (Number.isNaN(id)) return;
      if (mode === 'online') {
        const snap = onlineSnap;
        if (!snap || snap.phase !== 'play' || snap.turn !== snap.you) return;
        sfx.unlock();
        sfx.click();
        if (onlineSel.has(id)) onlineSel.delete(id);
        else onlineSel.add(id);
        renderBoard(onlineView(snap));
      } else {
        sfx.unlock();
        sfx.click();
        game.toggleCard(id);
      }
      return;
    }

    const btn = target.closest<HTMLElement>('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    switch (action) {
      case 'start':
        startSolo();
        break;
      case 'online':
        openOnline();
        break;
      case 'host':
        void hostRoom();
        break;
      case 'join':
        void joinRoom();
        break;
      case 'online-start':
        startOnlineGame();
        break;
      case 'room-leave':
      case 'room-back':
        leaveToMenu();
        break;
      case 'room-reset':
        room = null;
        renderRoom();
        break;
      case 'restart':
        if (mode === 'online') restartOnline();
        else startSolo();
        break;
      case 'resume':
        resume();
        break;
      case 'pause':
        pause();
        break;
      case 'voice':
        setVoiceEnabled(!voiceEnabled());
        sfx.unlock();
        sfx.click();
        renderCurrent();
        break;
      case 'exit':
        online.leave();
        opts.onExit();
        break;
      case 'call':
        doBid(true);
        break;
      case 'nobid':
        doBid(false);
        break;
      case 'hint':
        doHint();
        break;
      case 'reset':
        resetSelection();
        break;
      case 'play':
        doPlay();
        break;
      case 'pass':
        doPass();
        break;
      default:
        break;
    }
  });

  const onKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      if (e.key === 'Enter' && room === null) {
        e.preventDefault();
        void joinRoom();
      }
      return;
    }

    if (e.key === 'Escape') {
      if (mode === 'online') return;
      if (paused) resume();
      else pause();
      return;
    }
    if (e.key === 'Enter' && mode === 'solo' && (game.phase === 'idle' || game.phase === 'over')) {
      startSolo();
      return;
    }

    const snap = onlineSnap;
    const myTurn =
      mode === 'online'
        ? !!snap && snap.phase === 'play' && snap.turn === snap.you
        : game.phase === 'play' && game.turn === PLAYER_SEAT;
    if (paused || !myTurn) return;

    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      doPlay();
    } else if (e.key === 'h' || e.key === 'H') {
      doHint();
    } else if (e.key === 'p' || e.key === 'P') {
      doPass();
    }
  };
  window.addEventListener('keydown', onKey);

  const onVisibility = () => {
    if (document.hidden && mode === 'solo') pause();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const ro = new ResizeObserver(() => fitHand(lastCount));
  ro.observe(frame);

  renderSolo();
  if (new URLSearchParams(location.search).has('play')) startSolo();

  return {
    destroy() {
      window.clearTimeout(aiTimer);
      window.clearTimeout(toastTimer);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      cancelSpeech();
      ro.disconnect();
      online.leave();
      frame.remove();
    },
  };
}
