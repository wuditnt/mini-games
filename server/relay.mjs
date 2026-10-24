import { WebSocketServer } from 'ws';
import { networkInterfaces } from 'node:os';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_PLAYERS = 2;

function makeCode(rooms) {
  for (let i = 0; i < 200; i++) {
    let code = '';
    for (let j = 0; j < 4; j++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return null;
}

function lanAddresses(port) {
  const list = [];
  const nets = networkInterfaces();
  for (const group of Object.values(nets)) {
    for (const item of group ?? []) {
      if (item && item.family === 'IPv4' && !item.internal) {
        list.push(item.address);
      }
    }
  }
  return list.map((ip) => ({ ws: `ws://${ip}:${port}`, http: `http://${ip}:6173` }));
}

/**
 * 极简局域网房间中继：只负责建房、配对与消息转发，不关心游戏内容。
 * 因此任何游戏都可以复用同一套服务端。
 */
export function createRelay({ port = 6174, host = '0.0.0.0', log = console.log } = {}) {
  const rooms = new Map();
  const wss = new WebSocketServer({ port, host });
  let closed = false;

  const send = (ws, msg) => {
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };

  const peerOf = (ws) => {
    const meta = ws.meta;
    if (!meta) return null;
    const room = rooms.get(meta.code);
    if (!room) return null;
    return meta.slot === 'host' ? room.guest : room.host;
  };

  const leaveRoom = (ws) => {
    const meta = ws.meta;
    if (!meta) return;
    ws.meta = null;
    const room = rooms.get(meta.code);
    if (!room) return;
    if (meta.slot === 'host') {
      const guest = room.guest;
      rooms.delete(meta.code);
      if (guest) {
        guest.meta = null;
        send(guest, { t: 'room:peer', event: 'leave', slot: 'host' });
        log(`[relay] 房间 ${meta.code} 房主离开，房间解散`);
      }
    } else {
      room.guest = null;
      send(room.host, { t: 'room:peer', event: 'leave', slot: 'guest' });
      log(`[relay] 房间 ${meta.code} 队友离开`);
    }
  };

  wss.on('connection', (ws) => {
    ws.meta = null;
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (!msg || typeof msg.t !== 'string') return;

      if (msg.t === 'ping') {
        send(ws, { t: 'pong', ts: msg.ts ?? 0 });
        return;
      }

      if (msg.t === 'room:create') {
        if (ws.meta) {
          send(ws, { t: 'room:error', message: '你已经在一个房间中' });
          return;
        }
        const code = makeCode(rooms);
        if (!code) {
          send(ws, { t: 'room:error', message: '房间数量已满，请稍后再试' });
          return;
        }
        rooms.set(code, { code, host: ws, guest: null });
        ws.meta = { code, slot: 'host' };
        send(ws, { t: 'room:created', code, slot: 'host' });
        log(`[relay] 创建房间 ${code}`);
        return;
      }

      if (msg.t === 'room:join') {
        if (ws.meta) {
          send(ws, { t: 'room:error', message: '你已经在一个房间中' });
          return;
        }
        const code = String(msg.code ?? '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) {
          send(ws, { t: 'room:error', message: '房间不存在或已解散' });
          return;
        }
        if (room.guest) {
          send(ws, { t: 'room:error', message: '房间已满（最多 2 人）' });
          return;
        }
        room.guest = ws;
        ws.meta = { code, slot: 'guest' };
        send(ws, { t: 'room:joined', code, slot: 'guest' });
        send(room.host, { t: 'room:peer', event: 'join', slot: 'guest' });
        log(`[relay] 房间 ${code} 队友加入`);
        return;
      }

      if (msg.t === 'room:leave') {
        leaveRoom(ws);
        return;
      }

      if (msg.t === 'room:msg') {
        const peer = peerOf(ws);
        if (peer) {
          send(peer, { t: 'room:msg', from: ws.meta.slot, data: msg.data });
        }
        return;
      }
    });

    ws.on('close', () => leaveRoom(ws));
    ws.on('error', () => leaveRoom(ws));
  });

  wss.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`[relay] 端口 ${port} 已被占用，联机功能不可用（单人模式不受影响）`);
    } else {
      console.error('[relay] 服务异常', err);
    }
  });

  wss.on('listening', () => {
    log(`[relay] 联机中继已启动 ws://${host}:${port}`);
    for (const addr of lanAddresses(port)) {
      log(`[relay] 局域网：${addr.http}  (房间码在同一网络内通用)`);
    }
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {
        /* 忽略 */
      }
    }
  }, 30000);
  heartbeat.unref?.();

  return {
    wss,
    port,
    maxPlayers: MAX_PLAYERS,
    close() {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.terminate();
      wss.close();
    },
  };
}
