/** 斗地主联机：3 人房间会话 + 房主端快照打包。 */
import type { PeerSlot, RelayServerMsg } from '../../net/protocol';
import { relayUrl } from '../../net/protocol';
import { RelaySocket } from '../../net/transport';
import type { Card } from './cards';
import type { DdzGame, Phase, Seat } from './game';

export interface DdzNetHandlers {
  onJoin?: (slot: PeerSlot) => void;
  onLeave?: (slot: PeerSlot) => void;
  onData?: (data: unknown, from: PeerSlot) => void;
  onClose?: (reason: string) => void;
}

interface Waiter {
  type: RelayServerMsg['t'];
  resolve: (msg: RelayServerMsg) => void;
  reject: (err: Error) => void;
}

/** 最多 3 人的房间会话，房主与两名玩家共用一个中继房间。 */
export class DdzNet {
  role: 'host' | 'guest' | null = null;
  mySlot: PeerSlot | null = null;
  code = '';
  /** 房主端记录已加入的玩家位置 */
  guests: PeerSlot[] = [];

  onJoin: (slot: PeerSlot) => void = () => {};
  onLeave: (slot: PeerSlot) => void = () => {};
  onData: (data: unknown, from: PeerSlot) => void = () => {};
  onClose: (reason: string) => void = () => {};

  private sock = new RelaySocket();
  private waiters: Waiter[] = [];
  private closed = false;

  constructor(handlers: DdzNetHandlers = {}) {
    this.onJoin = handlers.onJoin ?? (() => {});
    this.onLeave = handlers.onLeave ?? (() => {});
    this.onData = handlers.onData ?? (() => {});
    this.onClose = handlers.onClose ?? (() => {});

    this.sock.onMessage = (msg) => this.handle(msg);
    this.sock.onClose = (reason) => {
      this.closed = true;
      this.failWaiters(new Error(reason));
      this.onClose(reason);
    };
  }

  /** 建房：最多 3 人，房间人数上限由房主指定 */
  async connectAsHost() {
    await this.sock.connect(relayUrl());
    const msg = await this.request({ t: 'room:create', cap: 3 }, 'room:created');
    if (msg.t !== 'room:created') throw new Error('房间创建失败');
    this.role = 'host';
    this.mySlot = 'host';
    this.code = msg.code;
  }

  async connectAsGuest(code: string) {
    await this.sock.connect(relayUrl());
    const msg = await this.request(
      { t: 'room:join', code: code.trim().toUpperCase() },
      'room:joined'
    );
    if (msg.t !== 'room:joined') throw new Error('加入房间失败');
    this.role = 'guest';
    this.mySlot = msg.slot;
    this.code = msg.code;
  }

  send(data: unknown) {
    if (this.closed) return;
    this.sock.send({ t: 'room:msg', data });
  }

  get connected() {
    return !this.closed && this.sock.connected;
  }

  leave() {
    if (this.closed) return;
    this.sock.send({ t: 'room:leave' });
    this.closed = true;
    this.failWaiters(new Error('已离开房间'));
    this.sock.close();
  }

  private request(msg: Parameters<RelaySocket['send']>[0], expect: RelayServerMsg['t']) {
    return new Promise<RelayServerMsg>((resolve, reject) => {
      const waiter: Waiter = {
        type: expect,
        resolve,
        reject: (err) => {
          window.clearTimeout(timer);
          reject(err);
        },
      };
      const timer = window.setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        reject(new Error('联机请求超时，请重试'));
      }, 8000);
      this.waiters.push(waiter);
      this.sock.send(msg);
    });
  }

  private handle(msg: RelayServerMsg) {
    if (msg.t === 'room:error') {
      const waiter = this.waiters.shift();
      if (waiter) waiter.reject(new Error(msg.message));
      return;
    }

    if (msg.t === 'room:peer') {
      if (msg.event === 'join') {
        if (this.role === 'host' && !this.guests.includes(msg.slot)) this.guests.push(msg.slot);
        this.onJoin(msg.slot);
      } else {
        this.guests = this.guests.filter((slot) => slot !== msg.slot);
        if (msg.slot === 'host') {
          this.closed = true;
          this.sock.close();
        }
        this.onLeave(msg.slot);
      }
      return;
    }

    if (msg.t === 'room:msg') {
      this.onData(msg.data, msg.from);
      return;
    }

    const index = this.waiters.findIndex((w) => w.type === msg.t);
    if (index >= 0) {
      const waiter = this.waiters.splice(index, 1)[0];
      waiter.resolve(msg);
    }
  }

  private failWaiters(err: Error) {
    const list = this.waiters;
    this.waiters = [];
    for (const w of list) w.reject(err);
  }
}

/* ---------------- 快照 ---------------- */

export type SnapAction = { cards: Card[] } | 'pass' | null;

export type DdzEvent =
  | { seq: number; kind: 'play'; seat: Seat; cards: Card[] }
  | { seq: number; kind: 'pass'; seat: Seat };

export interface DdzSnap {
  t: 'state';
  seq: number;
  you: Seat;
  phase: Phase;
  hand: Card[];
  counts: [number, number, number];
  /** 该座位是否由真人控制（false 表示电脑） */
  human: [boolean, boolean, boolean];
  bottom: Card[];
  bottomRevealed: boolean;
  bidSeat: Seat;
  bidMarks: ('call' | 'pass' | null)[];
  turn: Seat;
  landlord: Seat | null;
  lastPlay: { seat: Seat; cards: Card[] } | null;
  lastActions: SnapAction[];
  multiplier: number;
  winner: Seat | null;
  event: DdzEvent | null;
}

export function buildSnap(
  game: DdzGame,
  you: Seat,
  seq: number,
  human: [boolean, boolean, boolean],
  event: DdzEvent | null
): DdzSnap {
  return {
    t: 'state',
    seq,
    you,
    phase: game.phase,
    hand: game.hands[you].map((card) => ({ ...card })),
    counts: [game.hands[0].length, game.hands[1].length, game.hands[2].length],
    human,
    bottom: game.bottom.map((card) => ({ ...card })),
    bottomRevealed: game.bottomRevealed,
    bidSeat: game.bidSeat,
    bidMarks: [...game.bidMarks],
    turn: game.turn,
    landlord: game.landlord,
    lastPlay: game.lastPlay
      ? { seat: game.lastPlay.seat, cards: game.lastPlay.combo.cards.map((c) => ({ ...c })) }
      : null,
    lastActions: game.lastActions.map((action) =>
      action && action !== 'pass' ? { cards: action.cards.map((c) => ({ ...c })) } : action
    ),
    multiplier: game.multiplier,
    winner: game.winner,
    event,
  };
}

/** 指定座位是否获胜（按地主 / 农民阵营判定） */
export function snapWon(snap: DdzSnap, seat: Seat): boolean {
  if (snap.winner === null || snap.landlord === null) return false;
  return snap.landlord === seat ? snap.winner === seat : snap.winner !== snap.landlord;
}
