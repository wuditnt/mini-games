/**
 * 斗地主对局状态机：发牌、叫地主、轮流出牌与胜负判定。
 * 座位 0 = 玩家（下方），1 = 右家电脑，2 = 左家电脑，出牌顺序 0 → 1 → 2。
 */
import {
  beats,
  createDeck,
  parseCombo,
  pickAiPlay,
  shuffle,
  sortCards,
  type Card,
  type Combo,
} from './cards';

export type Seat = 0 | 1 | 2;
export type Phase = 'idle' | 'bid' | 'play' | 'over';
export type SeatAction = Combo | 'pass' | null;

export interface DdzEvents {
  onChange?: () => void;
  onToast?: (message: string) => void;
  onOver?: (playerWin: boolean) => void;
  /** 某一家出牌（用于音效与读牌） */
  onPlay?: (seat: Seat, combo: Combo) => void;
  /** 某一家选择不出（用于语音读牌） */
  onPass?: (seat: Seat) => void;
}

export const SEAT_NAMES = ['你', '右家', '左家'];
export const PLAYER_SEAT: Seat = 0;

export function nextSeat(seat: Seat): Seat {
  return ((seat + 1) % 3) as Seat;
}

/** 电脑叫地主的意愿：王、2、炸弹和 A 越多越愿意叫 */
function handStrength(hand: Card[]): number {
  const counts = new Map<number, number>();
  for (const card of hand) counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);

  let score = 0;
  score += (counts.get(17) ?? 0) * 4;
  score += (counts.get(16) ?? 0) * 3;
  score += (counts.get(15) ?? 0) * 1.6;
  score += (counts.get(14) ?? 0) * 0.8;
  for (const value of counts.values()) if (value === 4) score += 4;
  return score;
}

export class DdzGame {
  hands: Card[][] = [[], [], []];
  bottom: Card[] = [];
  bottomRevealed = false;

  landlord: Seat | null = null;
  phase: Phase = 'idle';
  turn: Seat = 0;
  bidSeat: Seat = 0;
  bidPasses = 0;
  bidMarks: ('call' | 'pass' | null)[] = [null, null, null];

  lastPlay: { seat: Seat; combo: Combo } | null = null;
  lastActions: SeatAction[] = [null, null, null];
  passCount = 0;
  selected = new Set<number>();

  winner: Seat | null = null;
  farmerWin = false;
  multiplier = 1;
  bombs = 0;

  constructor(private readonly events: DdzEvents = {}) {}

  begin() {
    const deck = shuffle(createDeck());
    this.hands = [
      sortCards(deck.slice(0, 17)),
      sortCards(deck.slice(17, 34)),
      sortCards(deck.slice(34, 51)),
    ];
    this.bottom = sortCards(deck.slice(51));
    this.bottomRevealed = false;

    this.landlord = null;
    this.phase = 'bid';
    this.bidSeat = Math.floor(Math.random() * 3) as Seat;
    this.turn = this.bidSeat;
    this.bidPasses = 0;
    this.bidMarks = [null, null, null];

    this.lastPlay = null;
    this.lastActions = [null, null, null];
    this.passCount = 0;
    this.selected.clear();

    this.winner = null;
    this.farmerWin = false;
    this.multiplier = 1;
    this.bombs = 0;

    this.emit();
  }

  /* ---------------- 叫地主 ---------------- */

  bid(seat: Seat, call: boolean) {
    if (this.phase !== 'bid' || this.bidSeat !== seat) return;

    if (call) {
      this.landlord = seat;
      this.bottomRevealed = true;
      this.hands[seat] = sortCards([...this.hands[seat], ...this.bottom]);
      this.bidMarks[seat] = 'call';
      this.phase = 'play';
      this.turn = seat;
      this.lastPlay = null;
      this.lastActions = [null, null, null];
      this.passCount = 0;
      this.selected.clear();
      this.events.onToast?.(seat === PLAYER_SEAT ? '你成为了地主' : `${SEAT_NAMES[seat]}成为地主`);
      this.emit();
      return;
    }

    this.bidMarks[seat] = 'pass';
    this.bidPasses++;
    if (this.bidPasses >= 3) {
      this.events.onToast?.('三家都不叫，重新发牌');
      this.begin();
      return;
    }
    this.bidSeat = nextSeat(seat);
    this.turn = this.bidSeat;
    this.emit();
  }

  aiStep() {
    if (this.phase === 'bid') {
      if (this.bidSeat === PLAYER_SEAT) return;
      this.aiBid(this.bidSeat);
    } else if (this.phase === 'play') {
      if (this.turn === PLAYER_SEAT) return;
      this.aiAct(this.turn);
    }
  }

  private aiBid(seat: Seat) {
    const strength = handStrength(this.hands[seat]);
    const call = strength >= 4.2 + Math.random() * 1.6;
    this.bid(seat, call);
  }

  private aiAct(seat: Seat) {
    const hand = this.hands[seat];
    const target = this.lastPlay && this.lastPlay.seat !== seat ? this.lastPlay.combo : null;
    const teammatePlayed =
      target !== null && this.lastPlay !== null && this.isTeammate(seat, this.lastPlay.seat);

    const move = pickAiPlay(hand, target, {
      teammatePlayed,
      opponentLow: this.opponentLowFor(seat),
    });

    if (move) this.applyPlay(seat, move.cards);
    else this.applyPass(seat);
  }

  /* ---------------- 玩家操作 ---------------- */

  toggleCard(id: number) {
    if (this.phase !== 'play' || this.turn !== PLAYER_SEAT) return;
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
    this.emit();
  }

  /** 取消所有已选中的牌，恢复到未出牌的状态 */
  clearSelection() {
    if (!this.selected.size) return;
    this.selected.clear();
    this.emit();
  }

  selectedCards(): Card[] {
    return sortCards(this.hands[PLAYER_SEAT].filter((c) => this.selected.has(c.id)));
  }

  playerPlay(): boolean {
    if (this.phase !== 'play' || this.turn !== PLAYER_SEAT) return false;
    const cards = this.selectedCards();
    if (!cards.length) {
      this.events.onToast?.('请先选择要出的牌');
      return false;
    }
    const combo = parseCombo(cards);
    if (!combo) {
      this.events.onToast?.('这不是合法牌型');
      return false;
    }
    if (!this.canBeat(combo, PLAYER_SEAT)) {
      this.events.onToast?.('打不过上家的牌');
      return false;
    }
    this.selected.clear();
    this.applyPlay(PLAYER_SEAT, cards);
    return true;
  }

  playerPass(): boolean {
    if (this.phase !== 'play' || this.turn !== PLAYER_SEAT) return false;
    if (!this.lastPlay || this.lastPlay.seat === PLAYER_SEAT) {
      this.events.onToast?.('本轮由你先出牌，不能不出');
      return false;
    }
    this.selected.clear();
    this.applyPass(PLAYER_SEAT);
    return true;
  }

  /** 提示：自动选中一手能压过上家的牌，没有则返回 false */
  playerHint(): boolean {
    if (this.phase !== 'play' || this.turn !== PLAYER_SEAT) return false;
    const target = this.lastPlay && this.lastPlay.seat !== PLAYER_SEAT ? this.lastPlay.combo : null;
    const move = pickAiPlay(this.hands[PLAYER_SEAT], target, {
      teammatePlayed: false,
      opponentLow: this.opponentLowFor(PLAYER_SEAT),
    });
    if (!move) {
      this.events.onToast?.(target ? '没有能压过的牌，只能不出' : '没有可出的牌');
      return false;
    }
    this.selected = new Set(move.cards.map((c) => c.id));
    this.emit();
    return true;
  }

  /* ---------------- 联机操作（房主端校验任意座位） ---------------- */

  /** 指定座位用所选牌出牌，返回是否成功 */
  playAs(seat: Seat, cardIds: number[]): boolean {
    if (this.phase !== 'play' || this.turn !== seat) return false;
    const ids = new Set(cardIds);
    if (!ids.size) return false;
    const cards = this.hands[seat].filter((card) => ids.has(card.id));
    if (cards.length !== ids.size) return false;
    const combo = parseCombo(cards);
    if (!combo) return false;
    if (!this.canBeat(combo, seat)) return false;
    this.applyPlay(seat, cards);
    return true;
  }

  /** 指定座位不出，返回是否成功 */
  passAs(seat: Seat): boolean {
    if (this.phase !== 'play' || this.turn !== seat) return false;
    if (!this.lastPlay || this.lastPlay.seat === seat) return false;
    this.applyPass(seat);
    return true;
  }

  /** 提示：为指定座位找一手能压过桌面的牌 */
  hintFor(seat: Seat): Card[] {
    if (this.phase !== 'play' || this.turn !== seat) return [];
    const target = this.lastPlay && this.lastPlay.seat !== seat ? this.lastPlay.combo : null;
    const move = pickAiPlay(this.hands[seat], target, {
      teammatePlayed: false,
      opponentLow: this.opponentLowFor(seat),
    });
    return move ? move.cards : [];
  }

  /* ---------------- 内部流程 ---------------- */

  private canBeat(combo: Combo, seat: Seat): boolean {
    if (!this.lastPlay || this.lastPlay.seat === seat) return true;
    return beats(combo, this.lastPlay.combo);
  }

  private applyPlay(seat: Seat, cards: Card[]) {
    const combo = parseCombo(cards);
    if (!combo) return;
    if (!this.canBeat(combo, seat)) return;

    const ids = new Set(cards.map((c) => c.id));
    this.hands[seat] = this.hands[seat].filter((c) => !ids.has(c.id));

    this.lastPlay = { seat, combo };
    this.lastActions = [null, null, null];
    this.lastActions[seat] = combo;
    this.passCount = 0;

    if (combo.type === 'bomb' || combo.type === 'rocket') {
      this.bombs++;
      this.multiplier *= 2;
    }

    this.events.onPlay?.(seat, combo);

    if (this.hands[seat].length === 0) {
      this.finish(seat);
      return;
    }
    this.turn = nextSeat(seat);
    this.emit();
  }

  private applyPass(seat: Seat) {
    if (!this.lastPlay || this.lastPlay.seat === seat) return;

    const leader = this.lastPlay.seat;
    this.lastActions[seat] = 'pass';
    this.passCount++;

    if (this.passCount >= 2) {
      // 两家都不要，上一手出牌的人重新领出
      this.lastPlay = null;
      this.lastActions = [null, null, null];
      this.passCount = 0;
      this.turn = leader;
    } else {
      this.turn = nextSeat(seat);
    }
    this.events.onPass?.(seat);
    this.emit();
  }

  private finish(seat: Seat) {
    this.phase = 'over';
    this.winner = seat;
    this.farmerWin = this.landlord !== null && seat !== this.landlord;
    this.turn = seat;
    this.selected.clear();
    this.emit();
    this.events.onOver?.(this.playerWon());
  }

  private emit() {
    this.events.onChange?.();
  }

  /* ---------------- 查询 ---------------- */

  playerWon(): boolean {
    return this.seatWon(PLAYER_SEAT);
  }

  /** 指定座位是否获胜（按地主/农民阵营判定） */
  seatWon(seat: Seat): boolean {
    if (this.winner === null || this.landlord === null) return false;
    return this.landlord === seat ? this.winner === seat : this.winner !== this.landlord;
  }

  isTeammate(a: Seat, b: Seat): boolean {
    if (this.landlord === null) return false;
    return a !== this.landlord && b !== this.landlord;
  }

  teammateOf(seat: Seat): Seat | null {
    if (this.landlord === null || seat === this.landlord) return null;
    const farmers = ([0, 1, 2] as Seat[]).filter((s) => s !== this.landlord);
    return farmers.find((s) => s !== seat) ?? null;
  }

  opponentLowFor(seat: Seat): number {
    const teammate = this.teammateOf(seat);
    const opponents = ([0, 1, 2] as Seat[]).filter((s) => s !== seat && s !== teammate);
    return Math.min(...opponents.map((s) => this.hands[s].length));
  }

  roleOf(seat: Seat): 'landlord' | 'farmer' | null {
    if (this.landlord === null) return null;
    return seat === this.landlord ? 'landlord' : 'farmer';
  }

  scoreForPlayer(): number {
    return this.playerWon() ? 100 * this.multiplier : 0;
  }
}
