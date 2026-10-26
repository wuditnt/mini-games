/**
 * 斗地主联机控制：房主端跑唯一权威对局，客机只发送操作、接收快照。
 * 只有一名玩家加入也能开始，空出的座位由电脑接管。
 */
import type { PeerSlot } from '../../net/protocol';
import { parseCombo, pickAiPlay, type Card } from './cards';
import { DdzGame, type Seat } from './game';
import {
  buildSnap,
  DdzNet,
  type DdzEvent,
  type DdzSnap,
} from './net';

export interface OnlineRoom {
  step: 'hosting' | 'waiting' | 'error';
  code: string;
  guests: number;
  note: string;
  error: string;
}

export interface OnlineHandlers {
  onRoom: (room: OnlineRoom) => void;
  onStart: (you: Seat) => void;
  onState: (snap: DdzSnap) => void;
  onToast: (message: string) => void;
  onFatal: (message: string) => void;
}

type ActMsg =
  | { t: 'act'; kind: 'bid'; call: boolean }
  | { t: 'act'; kind: 'play'; ids: number[] }
  | { t: 'act'; kind: 'pass' };

type HostMsg =
  | { t: 'state'; to: PeerSlot; snap: DdzSnap }
  | { t: 'toast'; to: PeerSlot; message: string }
  | { t: 'deny'; to: PeerSlot; message: string };

export class DdzOnline {
  private net: DdzNet | null = null;
  private game: DdzGame | null = null;
  private aiTimer = 0;
  private seq = 0;
  private eventSeq = 0;
  private lastEvent: DdzEvent | null = null;
  private lastSnap: DdzSnap | null = null;
  private slotSeat = new Map<PeerSlot, Seat>();
  private humanSeats = new Set<Seat>();
  private started = false;

  constructor(private readonly handlers: OnlineHandlers) {}

  get playing() {
    return this.started;
  }

  get isHost() {
    return this.net?.role === 'host';
  }

  get mySeat(): Seat | null {
    return this.lastSnap?.you ?? null;
  }

  get snap() {
    return this.lastSnap;
  }

  /* ---------------- 房间 ---------------- */

  async hostRoom() {
    this.leave();
    const net = new DdzNet({
      onJoin: (slot) => this.onPeerJoin(slot),
      onLeave: (slot) => this.onPeerLeave(slot),
      onData: (data, from) => this.onHostData(data, from),
      onClose: (reason) => this.handlers.onFatal(reason),
    });
    try {
      await net.connectAsHost();
    } catch (err) {
      net.leave();
      this.emitRoom('error', err instanceof Error ? err.message : '创建房间失败');
      return;
    }
    this.net = net;
    this.emitRoom('hosting', '等待玩家加入；只来一人也能开始，另一个座位由电脑补上。');
  }

  async joinRoom(code: string) {
    this.leave();
    const net = new DdzNet({
      onLeave: (slot) => {
        if (slot === 'host') this.handlers.onFatal('房主已离开房间');
      },
      onData: (data) => this.onGuestData(data),
      onClose: (reason) => this.handlers.onFatal(reason),
    });
    try {
      await net.connectAsGuest(code);
    } catch (err) {
      net.leave();
      this.emitRoom('error', err instanceof Error ? err.message : '加入房间失败');
      return;
    }
    this.net = net;
    this.emitRoom('waiting', '已进入房间，等待房主开始对局…');
  }

  private emitRoom(step: OnlineRoom['step'], note: string, error = '') {
    this.handlers.onRoom({
      step,
      code: this.net?.code ?? '',
      guests: this.net?.guests.length ?? 0,
      note,
      error,
    });
  }

  /* ---------------- 房主开始 / 结束 ---------------- */

  start() {
    if (!this.net || this.net.role !== 'host' || this.started) return;
    if (!this.net.guests.length) {
      this.handlers.onToast('至少需要一名玩家加入房间');
      return;
    }

    this.slotSeat.clear();
    this.humanSeats.clear();
    this.slotSeat.set('host', 0);
    this.humanSeats.add(0);
    this.net.guests.slice(0, 2).forEach((slot, index) => {
      const seat = (index + 1) as Seat;
      this.slotSeat.set(slot, seat);
      this.humanSeats.add(seat);
    });

    this.game = new DdzGame({
      onChange: () => {
        this.broadcast();
        this.scheduleAi();
      },
      onPlay: (seat, combo) => {
        this.lastEvent = { seq: ++this.eventSeq, kind: 'play', seat, cards: combo.cards };
      },
      onPass: (seat) => {
        this.lastEvent = { seq: ++this.eventSeq, kind: 'pass', seat };
      },
    });
    this.started = true;
    this.lastEvent = null;
    this.lastSnap = null;

    this.handlers.onStart(0);
    this.game.begin();
  }

  restart() {
    if (!this.game || !this.isHost) return;
    this.lastEvent = null;
    this.game.begin();
  }

  /* ---------------- 操作 ---------------- */

  actBid(call: boolean) {
    if (this.net?.role === 'host') this.game?.bid(0, call);
    else this.net?.send({ t: 'act', kind: 'bid', call } satisfies ActMsg);
  }

  actPlay(cardIds: number[]) {
    if (this.net?.role === 'host') {
      if (this.game && !this.game.playAs(0, cardIds)) {
        this.handlers.onToast('这手牌不能出');
      }
      return;
    }
    if (cardIds.length) this.net?.send({ t: 'act', kind: 'play', ids: cardIds } satisfies ActMsg);
  }

  actPass() {
    if (this.net?.role === 'host') this.game?.passAs(0);
    else this.net?.send({ t: 'act', kind: 'pass' } satisfies ActMsg);
  }

  /** 给本机玩家推荐一手牌 */
  hint(): Card[] {
    if (this.net?.role === 'host') return this.game?.hintFor(0) ?? [];
    const snap = this.lastSnap;
    if (!snap) return [];
    const target =
      snap.lastPlay && snap.lastPlay.seat !== snap.you
        ? parseCombo(snap.lastPlay.cards)
        : null;
    const farmer = snap.landlord !== null && snap.landlord !== snap.you;
    const teammate = farmer
      ? ([0, 1, 2] as Seat[]).find((s) => s !== snap.landlord && s !== snap.you) ?? null
      : null;
    const teammatePlayed =
      target !== null && teammate !== null && snap.lastPlay?.seat === teammate;
    const opponentLow = Math.min(
      ...([0, 1, 2] as Seat[])
        .filter((s) => s !== snap.you && s !== teammate)
        .map((s) => snap.counts[s])
    );
    const move = pickAiPlay(snap.hand, target, { teammatePlayed, opponentLow });
    return move ? move.cards : [];
  }

  leave() {
    window.clearTimeout(this.aiTimer);
    this.aiTimer = 0;
    this.net?.leave();
    this.net = null;
    this.game = null;
    this.started = false;
    this.lastEvent = null;
    this.lastSnap = null;
    this.slotSeat.clear();
    this.humanSeats.clear();
  }

  /* ---------------- 房主端 ---------------- */

  private onPeerJoin(slot: PeerSlot) {
    if (this.started) {
      this.net?.send({ t: 'deny', to: slot, message: '本局已经开始，请等下一局' } satisfies HostMsg);
      return;
    }
    this.emitRoom('hosting', '已有玩家加入；再等一位，或直接开始由电脑补位。');
  }

  private onPeerLeave(slot: PeerSlot) {
    const seat = this.slotSeat.get(slot);
    this.slotSeat.delete(slot);
    if (this.started && seat !== undefined) {
      this.humanSeats.delete(seat);
      this.handlers.onToast('队友已离开，由电脑接管');
      this.broadcast();
      this.scheduleAi();
      return;
    }
    if (!this.started) {
      this.emitRoom(
        'hosting',
        this.net?.guests.length ? '已有玩家加入，可以开始。' : '等待玩家加入…'
      );
    }
  }

  private onHostData(data: unknown, from: PeerSlot) {
    if (!this.started || !this.game) return;
    const seat = this.slotSeat.get(from);
    if (seat === undefined) return;
    const msg = data as ActMsg;
    if (!msg || msg.t !== 'act') return;

    if (msg.kind === 'bid') {
      this.game.bid(seat, !!msg.call);
    } else if (msg.kind === 'play') {
      if (!this.game.playAs(seat, Array.isArray(msg.ids) ? msg.ids : [])) {
        this.net?.send({ t: 'toast', to: from, message: '这手牌不能出' } satisfies HostMsg);
      }
    } else if (msg.kind === 'pass') {
      if (!this.game.passAs(seat)) {
        this.net?.send({ t: 'toast', to: from, message: '本轮由你先出，不能不出' } satisfies HostMsg);
      }
    }
  }

  private broadcast() {
    if (!this.game || !this.net) return;
    this.seq++;
    const human: [boolean, boolean, boolean] = [
      this.humanSeats.has(0),
      this.humanSeats.has(1),
      this.humanSeats.has(2),
    ];
    const hostSnap = buildSnap(this.game, 0, this.seq, human, this.lastEvent);
    this.lastSnap = hostSnap;
    this.handlers.onState(hostSnap);

    for (const [slot, seat] of this.slotSeat) {
      if (slot === 'host') continue;
      this.net.send({
        t: 'state',
        to: slot,
        snap: buildSnap(this.game, seat, this.seq, human, this.lastEvent),
      } satisfies HostMsg);
    }
  }

  private scheduleAi() {
    window.clearTimeout(this.aiTimer);
    this.aiTimer = 0;
    const game = this.game;
    if (!game || game.phase === 'idle' || game.phase === 'over') return;
    const seat = game.phase === 'bid' ? game.bidSeat : game.turn;
    if (this.humanSeats.has(seat)) return;
    this.aiTimer = window.setTimeout(() => {
      this.aiTimer = 0;
      this.game?.aiStep();
    }, 700 + Math.random() * 450);
  }

  /* ---------------- 客机端 ---------------- */

  private onGuestData(data: unknown) {
    const msg = data as HostMsg;
    if (!msg || typeof msg !== 'object') return;
    if (msg.to !== this.net?.mySlot) return;

    if (msg.t === 'deny') {
      this.handlers.onFatal(msg.message);
      return;
    }
    if (msg.t === 'toast') {
      this.handlers.onToast(msg.message);
      return;
    }
    if (msg.t !== 'state') return;

    const snap = msg.snap;
    if (!snap || snap.t !== 'state') return;
    this.lastSnap = snap;
    if (!this.started) {
      this.started = true;
      this.handlers.onStart(snap.you);
    }
    this.handlers.onState(snap);
  }
}
