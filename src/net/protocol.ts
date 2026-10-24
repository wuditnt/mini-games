/** 中继服务协议：与具体游戏无关，任何游戏都能复用。 */

export type NetRole = 'host' | 'guest';

export const RELAY_PORT = 6174;

export interface RelayClientMsg {
  t: 'room:create' | 'room:join' | 'room:leave' | 'room:msg' | 'ping';
  code?: string;
  data?: unknown;
  ts?: number;
}

export type RelayServerMsg =
  | { t: 'room:created'; code: string; slot: NetRole }
  | { t: 'room:joined'; code: string; slot: NetRole }
  | { t: 'room:peer'; event: 'join' | 'leave'; slot: NetRole }
  | { t: 'room:msg'; from: NetRole; data: unknown }
  | { t: 'room:error'; message: string }
  | { t: 'pong'; ts: number };

/** 局域网内直连中继服务（手机访问电脑的 IP 时同样有效） */
export function relayUrl(port = RELAY_PORT) {
  if (typeof location === 'undefined') return `ws://localhost:${port}`;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.hostname}:${port}`;
}
