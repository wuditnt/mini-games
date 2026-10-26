/** 中继服务协议：与具体游戏无关，任何游戏都能复用。 */

export type NetRole = 'host' | 'guest';
/** 房间内的具体位置：房主、第一个加入的玩家、第二个加入的玩家 */
export type PeerSlot = NetRole | 'guest2';

export const RELAY_PORT = 6174;

export interface RelayClientMsg {
  t: 'room:create' | 'room:join' | 'room:leave' | 'room:msg' | 'ping';
  code?: string;
  data?: unknown;
  ts?: number;
  /** 建房时指定房间人数上限（2~3），默认 2 */
  cap?: number;
}

export type RelayServerMsg =
  | { t: 'room:created'; code: string; slot: NetRole; cap: number }
  | { t: 'room:joined'; code: string; slot: PeerSlot; cap: number }
  | { t: 'room:peer'; event: 'join' | 'leave'; slot: PeerSlot }
  | { t: 'room:msg'; from: PeerSlot; data: unknown }
  | { t: 'room:error'; message: string }
  | { t: 'pong'; ts: number };

/** 局域网内直连中继服务（手机访问电脑的 IP 时同样有效） */
export function relayUrl(port = RELAY_PORT) {
  if (typeof location === 'undefined') return `ws://localhost:${port}`;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.hostname}:${port}`;
}
