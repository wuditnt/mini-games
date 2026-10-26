/**
 * 斗地主：牌堆、牌型判定、大小比较与 AI 选牌。
 * 点数约定：3..14 表示 3..A，15 表示 2，16 小王，17 大王。
 */

export type Suit = 'spade' | 'heart' | 'club' | 'diamond' | 'joker';

export interface Card {
  id: number;
  rank: number;
  suit: Suit;
}

export type ComboType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'triple1'
  | 'triple2'
  | 'straight'
  | 'pairStraight'
  | 'plane'
  | 'plane1'
  | 'plane2'
  | 'bomb'
  | 'rocket';

export interface Combo {
  type: ComboType;
  /** 比较用的主点数，顺子/飞机取链尾最大点数 */
  main: number;
  /** 连牌组数，非连牌型为 1 */
  len: number;
  cards: Card[];
}

/** 顺子、连对、飞机的最大点数（A 为 14，2 和王不能进链） */
const MAX_CHAIN_RANK = 14;

export function createDeck(): Card[] {
  const suits: Suit[] = ['spade', 'heart', 'club', 'diamond'];
  const deck: Card[] = [];
  let id = 0;
  for (let rank = 3; rank <= 15; rank++) {
    for (const suit of suits) deck.push({ id: id++, rank, suit });
  }
  deck.push({ id: id++, rank: 16, suit: 'joker' });
  deck.push({ id: id++, rank: 17, suit: 'joker' });
  return deck;
}

export function shuffle<T>(list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => a.rank - b.rank || a.id - b.id);
}

function countRanks(cards: Card[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const c of cards) m.set(c.rank, (m.get(c.rank) ?? 0) + 1);
  return m;
}

function isConsecutive(ranks: number[]): boolean {
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] !== ranks[i - 1] + 1) return false;
  }
  return true;
}

/** 取当前手牌中某个点数的全部牌 */
function cardsOfRank(hand: Card[], rank: number): Card[] {
  return hand.filter((c) => c.rank === rank);
}

/** 判断这组牌是否为「连续 n 个三张」并转成对应牌型 */
function parsePlane(
  cards: Card[],
  counts: Map<number, number>,
  len: number,
  attach: 0 | 1 | 2
): Combo | null {
  if (cards.length !== len * (3 + attach)) return null;
  const tripleRanks = [...counts.keys()]
    .filter((r) => r <= MAX_CHAIN_RANK && (counts.get(r) ?? 0) >= 3)
    .sort((a, b) => a - b);

  for (let i = 0; i + len <= tripleRanks.length; i++) {
    const chain = tripleRanks.slice(i, i + len);
    if (!isConsecutive(chain)) continue;

    const used = new Set<number>();
    const chainCards: Card[] = [];
    for (const rank of chain) {
      for (const card of cardsOfRank(cards, rank).slice(0, 3)) {
        chainCards.push(card);
        used.add(card.id);
      }
    }
    const rest = sortCards(cards.filter((c) => !used.has(c.id)));
    const main = chain[len - 1];

    if (attach === 0) {
      if (rest.length === 0) return { type: 'plane', main, len, cards };
      continue;
    }
    if (attach === 1) {
      if (rest.length !== len) continue;
      return { type: 'plane1', main, len, cards: [...chainCards, ...rest] };
    }
    if (rest.length !== len * 2) continue;
    const restCounts = countRanks(rest);
    if ([...restCounts.values()].every((v) => v === 2)) {
      return { type: 'plane2', main, len, cards: [...chainCards, ...rest] };
    }
  }
  return null;
}

/** 解析牌型，非法组合返回 null */
export function parseCombo(input: Card[]): Combo | null {
  const cards = sortCards(input);
  const n = cards.length;
  if (!n) return null;

  const counts = countRanks(cards);
  const ranks = [...counts.keys()].sort((a, b) => a - b);
  const min = ranks[0];
  const max = ranks[ranks.length - 1];

  if (n === 2 && counts.get(16) === 1 && counts.get(17) === 1) {
    return { type: 'rocket', main: 17, len: 1, cards };
  }

  if (ranks.length === 1) {
    if (n === 1) return { type: 'single', main: min, len: 1, cards };
    if (n === 2) return { type: 'pair', main: min, len: 1, cards };
    if (n === 3) return { type: 'triple', main: min, len: 1, cards };
    if (n === 4) return { type: 'bomb', main: min, len: 1, cards };
    return null;
  }

  // 顺子：至少 5 张连续单牌，不含 2 和王
  if (n >= 5 && ranks.length === n && max <= MAX_CHAIN_RANK && isConsecutive(ranks)) {
    return { type: 'straight', main: max, len: n, cards };
  }

  // 连对：至少 3 组连续对子
  if (
    n >= 6 &&
    n % 2 === 0 &&
    ranks.length === n / 2 &&
    max <= MAX_CHAIN_RANK &&
    [...counts.values()].every((v) => v === 2) &&
    isConsecutive(ranks)
  ) {
    return { type: 'pairStraight', main: max, len: ranks.length, cards };
  }

  // 飞机（不带）
  if (n >= 6 && n % 3 === 0) {
    const plane = parsePlane(cards, counts, n / 3, 0);
    if (plane) return plane;
  }

  // 三带一 / 三带二
  const tripleRank = ranks.find((r) => counts.get(r) === 3);
  if (n === 4 && ranks.length === 2 && tripleRank !== undefined) {
    return { type: 'triple1', main: tripleRank, len: 1, cards };
  }
  if (n === 5 && ranks.length === 2 && tripleRank !== undefined) {
    const pairRank = ranks.find((r) => r !== tripleRank);
    if (pairRank !== undefined && counts.get(pairRank) === 2) {
      return { type: 'triple2', main: tripleRank, len: 1, cards };
    }
  }

  // 飞机带单 / 带对
  if (n >= 8 && n % 4 === 0) {
    const plane = parsePlane(cards, counts, n / 4, 1);
    if (plane) return plane;
  }
  if (n >= 10 && n % 5 === 0) {
    const plane = parsePlane(cards, counts, n / 5, 2);
    if (plane) return plane;
  }

  return null;
}

/** a 能否压过 b（b 为 null 表示自由出牌） */
export function beats(a: Combo, b: Combo | null): boolean {
  if (!b) return true;
  if (a.type === 'rocket') return b.type !== 'rocket';
  if (b.type === 'rocket') return false;
  if (a.type === 'bomb' && b.type !== 'bomb') return true;
  if (b.type === 'bomb' && a.type !== 'bomb') return false;
  if (a.type !== b.type || a.len !== b.len) return false;
  return a.main > b.main;
}

export function comboName(combo: Combo): string {
  switch (combo.type) {
    case 'single':
      return '单牌';
    case 'pair':
      return '对子';
    case 'triple':
      return '三张';
    case 'triple1':
      return '三带一';
    case 'triple2':
      return '三带二';
    case 'straight':
      return `${combo.len} 连顺子`;
    case 'pairStraight':
      return `${combo.len} 连对`;
    case 'plane':
      return `${combo.len} 连飞机`;
    case 'plane1':
      return '飞机带单';
    case 'plane2':
      return '飞机带对';
    case 'bomb':
      return '炸弹';
    case 'rocket':
      return '王炸';
  }
}

export function rankLabel(rank: number): string {
  if (rank >= 16) return rank === 17 ? '大王' : '小王';
  if (rank === 15) return '2';
  if (rank === 14) return 'A';
  if (rank === 13) return 'K';
  if (rank === 12) return 'Q';
  if (rank === 11) return 'J';
  return String(rank);
}

export function suitSymbol(suit: Suit): string {
  switch (suit) {
    case 'spade':
      return '♠';
    case 'heart':
      return '♥';
    case 'club':
      return '♣';
    case 'diamond':
      return '♦';
    default:
      return '★';
  }
}

/** 枚举手牌里所有可用牌型（用于提示与 AI 领出） */
export function enumerate(hand: Card[]): Combo[] {
  const found = new Map<string, Combo>();
  const add = (combo: Combo | null) => {
    if (!combo) return;
    const key = combo.cards
      .map((c) => c.id)
      .sort((a, b) => a - b)
      .join(',');
    if (!found.has(key)) found.set(key, combo);
  };

  const counts = countRanks(hand);
  const ranks = [...counts.keys()].sort((a, b) => a - b);

  for (const rank of ranks) {
    const group = cardsOfRank(hand, rank);
    add(parseCombo([group[0]]));
    if (group.length >= 2) add(parseCombo(group.slice(0, 2)));
    if (group.length >= 3) add(parseCombo(group.slice(0, 3)));
    if (group.length >= 4) add(parseCombo(group.slice(0, 4)));
  }

  // 三带一 / 三带二
  for (const rank of ranks) {
    const triple = cardsOfRank(hand, rank);
    if (triple.length < 3) continue;
    const rest = sortCards(hand.filter((c) => c.rank !== rank));
    if (rest.length >= 1) add(parseCombo([...triple.slice(0, 3), rest[0]]));
    const pair = findLowestPair(rest);
    if (pair) add(parseCombo([...triple.slice(0, 3), ...pair]));
  }

  // 顺子
  for (let len = 5; len <= 12; len++) {
    for (let start = 3; start + len - 1 <= MAX_CHAIN_RANK; start++) {
      const cards = takeChain(hand, start, len, 1);
      if (cards) add(parseCombo(cards));
    }
  }

  // 连对
  for (let len = 3; len <= 10; len++) {
    for (let start = 3; start + len - 1 <= MAX_CHAIN_RANK; start++) {
      const cards = takeChain(hand, start, len, 2);
      if (cards) add(parseCombo(cards));
    }
  }

  // 飞机（不带 / 带单 / 带对）
  for (let len = 2; len <= 6; len++) {
    for (let start = 3; start + len - 1 <= MAX_CHAIN_RANK; start++) {
      const chain = takeChain(hand, start, len, 3);
      if (!chain) continue;
      add(parseCombo(chain));

      const used = new Set(chain.map((c) => c.id));
      const rest = sortCards(hand.filter((c) => !used.has(c.id)));
      if (rest.length >= len) {
        add(parseCombo([...chain, ...rest.slice(0, len)]));
      }
      const pairs: Card[] = [];
      const restCounts = countRanks(rest);
      for (const rank of [...restCounts.keys()].sort((a, b) => a - b)) {
        if ((restCounts.get(rank) ?? 0) >= 2) {
          pairs.push(...cardsOfRank(rest, rank).slice(0, 2));
          if (pairs.length >= len * 2) break;
        }
      }
      if (pairs.length >= len * 2) {
        add(parseCombo([...chain, ...pairs.slice(0, len * 2)]));
      }
    }
  }

  // 王炸
  const smallJoker = hand.find((c) => c.rank === 16);
  const bigJoker = hand.find((c) => c.rank === 17);
  if (smallJoker && bigJoker) add(parseCombo([smallJoker, bigJoker]));

  return [...found.values()];
}

function takeChain(hand: Card[], start: number, len: number, need: number): Card[] | null {
  const cards: Card[] = [];
  for (let rank = start; rank < start + len; rank++) {
    const group = cardsOfRank(hand, rank);
    if (group.length < need) return null;
    cards.push(...group.slice(0, need));
  }
  return cards;
}

function findLowestPair(hand: Card[]): Card[] | null {
  const counts = countRanks(hand);
  for (const rank of [...counts.keys()].sort((a, b) => a - b)) {
    if ((counts.get(rank) ?? 0) >= 2) return cardsOfRank(hand, rank).slice(0, 2);
  }
  return null;
}

/** 找出所有能压过 target 的牌型（含炸弹与王炸） */
export function findBeats(hand: Card[], target: Combo): Combo[] {
  const found = new Map<string, Combo>();
  const add = (combo: Combo | null) => {
    if (!combo) return;
    const key = combo.cards
      .map((c) => c.id)
      .sort((a, b) => a - b)
      .join(',');
    if (!found.has(key)) found.set(key, combo);
  };

  const counts = countRanks(hand);
  const ranks = [...counts.keys()].sort((a, b) => a - b);

  // 炸弹与王炸
  if (target.type !== 'rocket') {
    for (const rank of ranks) {
      if ((counts.get(rank) ?? 0) === 4) {
        if (target.type !== 'bomb' || rank > target.main) add(parseCombo(cardsOfRank(hand, rank)));
      }
    }
    if (counts.get(16) && counts.get(17)) {
      add(parseCombo([...cardsOfRank(hand, 16), ...cardsOfRank(hand, 17)]));
    }
  }
  if (target.type === 'bomb' || target.type === 'rocket') return [...found.values()];

  switch (target.type) {
    case 'single': {
      for (const rank of ranks) {
        if (rank > target.main) add(parseCombo([cardsOfRank(hand, rank)[0]]));
      }
      break;
    }
    case 'pair': {
      for (const rank of ranks) {
        if (rank > target.main && (counts.get(rank) ?? 0) === 2) {
          add(parseCombo(cardsOfRank(hand, rank).slice(0, 2)));
        }
      }
      break;
    }
    case 'triple': {
      for (const rank of ranks) {
        if (rank > target.main && (counts.get(rank) ?? 0) >= 3) {
          add(parseCombo(cardsOfRank(hand, rank).slice(0, 3)));
        }
      }
      break;
    }
    case 'triple1':
    case 'triple2': {
      for (const rank of ranks) {
        if (rank <= target.main || (counts.get(rank) ?? 0) < 3) continue;
        const triple = cardsOfRank(hand, rank).slice(0, 3);
        const used = new Set(triple.map((c) => c.id));
        const rest = sortCards(hand.filter((c) => !used.has(c.id)));
        if (target.type === 'triple1') {
          if (rest.length >= 1) add(parseCombo([...triple, rest[0]]));
        } else {
          const pair = findLowestPair(rest);
          if (pair) add(parseCombo([...triple, ...pair]));
        }
      }
      break;
    }
    case 'straight': {
      for (let start = 3; start + target.len - 1 <= MAX_CHAIN_RANK; start++) {
        if (start + target.len - 1 <= target.main) continue;
        const cards = takeChain(hand, start, target.len, 1);
        if (cards) add(parseCombo(cards));
      }
      break;
    }
    case 'pairStraight': {
      for (let start = 3; start + target.len - 1 <= MAX_CHAIN_RANK; start++) {
        if (start + target.len - 1 <= target.main) continue;
        const cards = takeChain(hand, start, target.len, 2);
        if (cards) add(parseCombo(cards));
      }
      break;
    }
    case 'plane':
    case 'plane1':
    case 'plane2': {
      for (let start = 3; start + target.len - 1 <= MAX_CHAIN_RANK; start++) {
        if (start + target.len - 1 <= target.main) continue;
        const chain = takeChain(hand, start, target.len, 3);
        if (!chain) continue;
        if (target.type === 'plane') {
          add(parseCombo(chain));
          continue;
        }
        const used = new Set(chain.map((c) => c.id));
        const rest = sortCards(hand.filter((c) => !used.has(c.id)));
        if (target.type === 'plane1') {
          if (rest.length >= target.len) add(parseCombo([...chain, ...rest.slice(0, target.len)]));
        } else {
          const pairCards: Card[] = [];
          const restCounts = countRanks(rest);
          for (const rank of [...restCounts.keys()].sort((a, b) => a - b)) {
            if ((restCounts.get(rank) ?? 0) >= 2) {
              pairCards.push(...cardsOfRank(rest, rank).slice(0, 2));
              if (pairCards.length >= target.len * 2) break;
            }
          }
          if (pairCards.length >= target.len * 2) {
            add(parseCombo([...chain, ...pairCards.slice(0, target.len * 2)]));
          }
        }
      }
      break;
    }
    default:
      break;
  }
  return [...found.values()];
}

export interface AiOptions {
  /** 当前要压的牌是自己的队友打出的 */
  teammatePlayed: boolean;
  /** 对手中最少的剩余手牌数 */
  opponentLow: number;
}

/**
 * 电脑选牌：
 * - 领出时优先甩长牌型（顺子/连对/飞机），并尽量保留炸弹和王炸；
 * - 跟牌时用最小可压牌型，队友的牌一般不压，对手快走完时改用大牌拦截。
 */
export function pickAiPlay(hand: Card[], target: Combo | null, opts: AiOptions): Combo | null {
  if (!hand.length) return null;
  const all = enumerate(hand);

  if (!target) {
    const whole = all.find((c) => c.cards.length === hand.length);
    if (whole) return whole;

    const safe = all.filter((c) => c.type !== 'bomb' && c.type !== 'rocket' && c.main < 16);
    const pool = safe.length ? safe : all.filter((c) => c.type !== 'bomb' && c.type !== 'rocket');
    if (!pool.length) return all[0] ?? null;

    const sorted = [...pool].sort(
      (a, b) => b.cards.length - a.cards.length || a.main - b.main
    );
    return sorted[0];
  }

  const candidates = findBeats(hand, target);
  if (!candidates.length) return null;

  const plain = candidates.filter((c) => c.type !== 'bomb' && c.type !== 'rocket');
  const pool = plain.length ? plain : candidates;

  const canFinish = pool.some((c) => c.cards.length === hand.length);
  if (canFinish) return pool.find((c) => c.cards.length === hand.length) ?? null;

  if (opts.teammatePlayed && opts.opponentLow > 1) return null;

  const sorted = [...pool].sort((a, b) => a.main - b.main || a.cards.length - b.cards.length);
  if (opts.opponentLow <= 2 && plain.length) {
    return sorted[sorted.length - 1];
  }
  return sorted[0];
}
