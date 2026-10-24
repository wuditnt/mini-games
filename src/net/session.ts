import type { NetRole, RelayServerMsg } from './protocol';
import { relayUrl } from './protocol';
import { RelaySocket } from './transport';

export interface NetSessionHandlers {
  onPeerJoin?: () => void;
  onPeerLeave?: () => void;
  onData?: (data: unknown, from: NetRole) => void;
  onClose?: (reason: string) => void;
}

interface Waiter {
  type: RelayServerMsg['t'];
  resolve: (msg: RelayServerMsg) => void;
  reject: (err: Error) => void;
}

/**
 * 房间会话：封装“建房 / 加入 / 收发游戏消息”，
 * 上层游戏只关心 NetRole 与 data，不接触底层协议。
 */
export class NetSession {
  role: NetRole | null = null;
  code = '';
  peerPresent = false;

  onPeerJoin: () => void = () => {};
  onPeerLeave: () => void = () => {};
  onData: (data: unknown, from: NetRole) => void = () => {};
  onClose: (reason: string) => void = () => {};

  private sock = new RelaySocket();
  private waiters: Waiter[] = [];
  private closed = false;

  constructor(handlers: NetSessionHandlers = {}) {
    this.onPeerJoin = handlers.onPeerJoin ?? (() => {});
    this.onPeerLeave = handlers.onPeerLeave ?? (() => {});
    this.onData = handlers.onData ?? (() => {});
    this.onClose = handlers.onClose ?? (() => {});

    this.sock.onMessage = (msg) => this.handle(msg);
    this.sock.onClose = (reason) => {
      this.closed = true;
      this.failWaiters(new Error(reason));
      this.onClose(reason);
    };
  }

  /** 创建房间，返回 4 位房间码 */
  static async host(handlers?: NetSessionHandlers) {
    const session = new NetSession(handlers);
    await session.sock.connect(relayUrl());
    const msg = await session.request({ t: 'room:create' }, 'room:created');
    if (msg.t !== 'room:created') throw new Error('房间创建失败');
    session.role = 'host';
    session.code = msg.code;
    return session;
  }

  /** 加入已有房间 */
  static async join(code: string, handlers?: NetSessionHandlers) {
    const session = new NetSession(handlers);
    await session.sock.connect(relayUrl());
    const msg = await session.request(
      { t: 'room:join', code: code.trim().toUpperCase() },
      'room:joined'
    );
    if (msg.t !== 'room:joined') throw new Error('加入房间失败');
    session.role = 'guest';
    session.code = msg.code;
    session.peerPresent = true;
    return session;
  }

  /** 向队友发送游戏消息 */
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
        this.peerPresent = true;
        this.onPeerJoin();
      } else {
        this.peerPresent = false;
        this.onPeerLeave();
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
