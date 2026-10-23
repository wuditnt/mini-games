import { AI_DELAY, SIZE } from './constants';

export type Mode = 'menu' | 'playing' | 'paused' | 'over';
export type Player = 1 | 2;
export type Result = 'win' | 'lose' | 'draw';

export interface Move {
  x: number;
  y: number;
  p: Player;
}

export interface Cell {
  x: number;
  y: number;
}

export interface Burst {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

export class GomokuGame {
  mode: Mode = 'menu';
  board = new Uint8Array(SIZE * SIZE);
  turn: Player = 1;
  moves: Move[] = [];
  winner: Player | 0 = 0;
  winLine: Cell[] = [];
  lastMove: Move | null = null;
  thinking = false;
  time = 0;
  hover: Cell | null = null;
  bursts: Burst[] = [];
  shake = 0;
  flash = 0;
  stonesAt = new Map<number, number>();

  private aiTimer = 0;
  private pending: { reason: string; result: Result } | null = null;
  private endDelay = 0;

  onHud?: () => void;
  onPlace?: (p: Player) => void;
  onBanner?: (text: string) => void;
  onGameOver?: (reason: string, result: Result, moves: number) => void;

  begin() {
    this.mode = 'playing';
    this.board.fill(0);
    this.turn = 1;
    this.moves = [];
    this.winner = 0;
    this.winLine = [];
    this.lastMove = null;
    this.thinking = false;
    this.aiTimer = 0;
    this.time = 0;
    this.hover = null;
    this.bursts = [];
    this.shake = 0;
    this.flash = 0;
    this.stonesAt.clear();
    this.pending = null;
    this.endDelay = 0;
    this.onHud?.();
  }

  pause() {
    if (this.mode === 'playing') this.mode = 'paused';
  }

  resume() {
    if (this.mode === 'paused') this.mode = 'playing';
  }

  get canPlace() {
    return this.mode === 'playing' && !this.winner && !this.thinking && this.turn === 1;
  }

  place(x: number, y: number): boolean {
    if (!this.canPlace) return false;
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return false;
    if (this.board[y * SIZE + x] !== 0) return false;

    this.put(x, y, 1);
    this.onPlace?.(1);

    const line = this.lineAt(x, y, 1);
    if (line) {
      this.win(1, line);
      return true;
    }
    if (this.moves.length === SIZE * SIZE) {
      this.declareDraw();
      return true;
    }
    this.turn = 2;
    this.thinking = true;
    this.aiTimer = AI_DELAY + Math.random() * 0.25;
    this.onHud?.();
    return true;
  }

  undo() {
    if (this.mode !== 'playing' || this.winner || !this.moves.length) return;
    const last = this.moves[this.moves.length - 1];
    const count = last.p === 2 && this.moves.length >= 2 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const m = this.moves.pop();
      if (!m) break;
      const idx = m.y * SIZE + m.x;
      this.board[idx] = 0;
      this.stonesAt.delete(idx);
    }
    this.turn = 1;
    this.thinking = false;
    this.aiTimer = 0;
    this.lastMove = this.moves[this.moves.length - 1] ?? null;
    this.onBanner?.('已悔棋');
    this.onHud?.();
  }

  update(dt: number) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 40);
    this.flash = Math.max(0, this.flash - dt * 2.2);

    for (const b of this.bursts) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= 1 - dt * 2.4;
      b.vy *= 1 - dt * 2.4;
    }
    this.bursts = this.bursts.filter((b) => b.life > 0);

    if (this.pending) {
      this.endDelay -= dt;
      if (this.endDelay <= 0) this.finish();
      return;
    }

    if (this.mode !== 'playing' || this.winner) return;

    if (this.thinking) {
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) this.aiTurn();
    }
  }

  /* ---------------- 电脑回合 ---------------- */

  private aiTurn() {
    this.thinking = false;
    const pick = this.chooseAiMove();
    if (!pick) {
      this.declareDraw();
      return;
    }
    this.put(pick.x, pick.y, 2);
    this.onPlace?.(2);

    const line = this.lineAt(pick.x, pick.y, 2);
    if (line) {
      this.win(2, line);
      return;
    }
    if (this.moves.length === SIZE * SIZE) {
      this.declareDraw();
      return;
    }
    this.turn = 1;
    this.onHud?.();
  }

  private chooseAiMove(): Cell | null {
    if (!this.moves.length) {
      const c = Math.floor(SIZE / 2);
      return { x: c, y: c };
    }

    const cells = this.candidates();
    if (!cells.length) return null;

    // 自己能直接五连
    for (const c of cells) {
      if (this.wouldWin(c.x, c.y, 2)) return c;
    }
    // 对手下一手能五连，必须封堵
    for (const c of cells) {
      if (this.wouldWin(c.x, c.y, 1)) return c;
    }

    let best: Cell = cells[0];
    let bestScore = -Infinity;
    const mid = (SIZE - 1) / 2;

    for (const c of cells) {
      const attack = this.pointScore(c.x, c.y, 2);
      const defense = this.pointScore(c.x, c.y, 1);
      const center = 14 - (Math.abs(c.x - mid) + Math.abs(c.y - mid));
      const score = attack + defense * 1.08 + center * 2 + Math.random() * 6;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  }

  /** 已有棋子周围 2 格内的空点 */
  private candidates(): Cell[] {
    const out: Cell[] = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (this.board[y * SIZE + x] !== 0) continue;
        let near = false;
        for (let dy = -2; dy <= 2 && !near; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE) continue;
            if (this.board[ny * SIZE + nx] !== 0) {
              near = true;
              break;
            }
          }
        }
        if (near) out.push({ x, y });
      }
    }
    return out;
  }

  private wouldWin(x: number, y: number, p: Player): boolean {
    const idx = y * SIZE + x;
    this.board[idx] = p;
    const line = this.lineAt(x, y, p);
    this.board[idx] = 0;
    return !!line;
  }

  /** 假设在 (x, y) 落子后，该点的形位分 */
  private pointScore(x: number, y: number, p: Player): number {
    const idx = y * SIZE + x;
    this.board[idx] = p;

    let total = 0;
    for (const [dx, dy] of DIRS) {
      let count = 1;
      let openA = false;
      let openB = false;

      let nx = x + dx;
      let ny = y + dy;
      while (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && this.board[ny * SIZE + nx] === p) {
        count++;
        nx += dx;
        ny += dy;
      }
      if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && this.board[ny * SIZE + nx] === 0) openA = true;

      nx = x - dx;
      ny = y - dy;
      while (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && this.board[ny * SIZE + nx] === p) {
        count++;
        nx -= dx;
        ny -= dy;
      }
      if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && this.board[ny * SIZE + nx] === 0) openB = true;

      total += patternScore(count, Number(openA) + Number(openB));
    }

    this.board[idx] = 0;
    return total;
  }

  /** 若 (x, y) 落子后形成五连，返回连线上的棋子 */
  private lineAt(x: number, y: number, p: Player): Cell[] | null {
    for (const [dx, dy] of DIRS) {
      const cells: Cell[] = [{ x, y }];
      let nx = x + dx;
      let ny = y + dy;
      while (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && this.board[ny * SIZE + nx] === p) {
        cells.push({ x: nx, y: ny });
        nx += dx;
        ny += dy;
      }
      nx = x - dx;
      ny = y - dy;
      while (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && this.board[ny * SIZE + nx] === p) {
        cells.unshift({ x: nx, y: ny });
        nx -= dx;
        ny -= dy;
      }
      if (cells.length >= 5) return cells;
    }
    return null;
  }

  /* ---------------- 落子与结算 ---------------- */

  private put(x: number, y: number, p: Player) {
    const idx = y * SIZE + x;
    this.board[idx] = p;
    const move: Move = { x, y, p };
    this.moves.push(move);
    this.lastMove = move;
    this.stonesAt.set(idx, this.time);
    this.emitBurst(x, y, p === 1 ? '#f2a63b' : '#dfe8f4', 6, 90);
  }

  private win(p: Player, line: Cell[]) {
    this.winner = p;
    this.winLine = line;
    this.shake = 10;
    this.flash = 0.7;
    for (const c of line) {
      this.emitBurst(c.x, c.y, p === 1 ? '#ffcf7a' : '#dbe9ff', 12, 170);
    }
    this.pending = {
      reason: p === 1 ? '五子连珠，你赢了' : 'AI 连成五子，再来一局？',
      result: p === 1 ? 'win' : 'lose',
    };
    this.endDelay = 1.5;
    this.onHud?.();
  }

  private declareDraw() {
    this.pending = { reason: '棋盘已满，势均力敌', result: 'draw' };
    this.endDelay = 0.6;
    this.onHud?.();
  }

  private finish() {
    const p = this.pending;
    this.pending = null;
    if (!p) return;
    this.mode = 'over';
    this.onGameOver?.(p.reason, p.result, this.moves.length);
    this.onHud?.();
  }

  private emitBurst(x: number, y: number, color: string, count: number, power: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (0.3 + Math.random() * 0.7) * power;
      this.bursts.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.25 + Math.random() * 0.4,
        max: 0.65,
        size: 1.4 + Math.random() * 2.4,
        color,
      });
    }
    if (this.bursts.length > 180) this.bursts.splice(0, this.bursts.length - 180);
  }
}

function patternScore(count: number, opens: number): number {
  if (count >= 5) return 1_000_000;
  if (count === 4) return opens === 2 ? 60_000 : opens === 1 ? 5_000 : 0;
  if (count === 3) return opens === 2 ? 3_200 : opens === 1 ? 320 : 0;
  if (count === 2) return opens === 2 ? 220 : opens === 1 ? 32 : 0;
  if (count === 1) return opens === 2 ? 12 : 2;
  return 0;
}
