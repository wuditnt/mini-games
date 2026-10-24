import type { RelayClientMsg, RelayServerMsg } from './protocol';

const OPEN_TIMEOUT = 5000;
const MAX_ATTEMPTS = 3;
const PING_EVERY = 5000;
const PONG_TIMEOUT = 16000;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * 中继连接：负责建连、心跳与断线通知。
 * 房间语义在上层 NetSession，方便不同游戏复用同一套连接能力。
 */
export class RelaySocket {
  onMessage: (msg: RelayServerMsg) => void = () => {};
  onClose: (reason: string) => void = () => {};

  private ws: WebSocket | null = null;
  private closed = false;
  private lastPong = 0;
  private pingTimer = 0;

  async connect(url: string) {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        await this.open(url);
        this.startHeartbeat();
        return;
      } catch (err) {
        lastError = err;
        if (this.closed) break;
        await delay(500 + attempt * 500);
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('无法连接联机服务，请确认已通过 npm run dev 启动');
  }

  private open(url: string) {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const ws = new WebSocket(url);
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        ws.close();
        reject(new Error('连接联机服务超时，请检查局域网与端口 6174'));
      }, OPEN_TIMEOUT);

      ws.onopen = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        this.ws = ws;
        this.lastPong = Date.now();
        ws.onmessage = (ev) => {
          let msg: RelayServerMsg;
          try {
            msg = JSON.parse(String(ev.data));
          } catch {
            return;
          }
          if (msg.t === 'pong') {
            this.lastPong = Date.now();
            return;
          }
          this.onMessage(msg);
        };
        ws.onclose = () => {
          if (this.closed) return;
          this.stopHeartbeat();
          this.onClose('与联机服务的连接已断开');
        };
        ws.onerror = () => {
          if (this.closed) return;
          this.stopHeartbeat();
          this.onClose('联机连接异常');
        };
        resolve();
      };

      ws.onerror = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        reject(new Error('无法连接联机服务'));
      };

      ws.onclose = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        reject(new Error('联机服务未启动'));
      };
    });
  }

  send(msg: RelayClientMsg) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(msg));
  }

  get connected() {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingTimer = window.setInterval(() => {
      if (this.closed) return;
      if (Date.now() - this.lastPong > PONG_TIMEOUT) {
        this.fail('联机连接超时');
        return;
      }
      this.send({ t: 'ping', ts: Date.now() });
    }, PING_EVERY);
  }

  private stopHeartbeat() {
    if (this.pingTimer) window.clearInterval(this.pingTimer);
    this.pingTimer = 0;
  }

  private fail(reason: string) {
    this.stopHeartbeat();
    this.closed = true;
    try {
      this.ws?.close();
    } catch {
      /* 忽略 */
    }
    this.ws = null;
    this.onClose(reason);
  }

  /** 主动关闭，不触发断线回调 */
  close() {
    this.closed = true;
    this.stopHeartbeat();
    try {
      this.ws?.close();
    } catch {
      /* 忽略 */
    }
    this.ws = null;
  }
}
