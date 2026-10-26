/** 斗地主共享的卡牌 DOM 片段，供人机与联机两种牌桌复用。 */
import { rankLabel, suitSymbol, type Card } from './cards';

export const isRed = (card: Card) =>
  card.suit === 'heart' || card.suit === 'diamond' || card.rank === 17;

export const miniCardHtml = (card: Card): string => {
  if (card.rank >= 16) {
    return `<span class="ddz-card mini joker${isRed(card) ? ' red' : ''}"><b>${
      card.rank === 17 ? '大' : '小'
    }</b><i>王</i></span>`;
  }
  return `<span class="ddz-card mini${isRed(card) ? ' red' : ''}"><b>${rankLabel(
    card.rank
  )}</b><i>${suitSymbol(card.suit)}</i></span>`;
};

export const handCardHtml = (card: Card, selected: boolean): string => {
  if (card.rank >= 16) {
    return `<button type="button" class="ddz-card joker${isRed(card) ? ' red' : ''}${
      selected ? ' selected' : ''
    }" data-card="${card.id}">
      <span class="cc-joker-name">${rankLabel(card.rank)}</span>
      <span class="cc-joker-mark">JOKER</span>
    </button>`;
  }
  const suit = suitSymbol(card.suit);
  return `<button type="button" class="ddz-card${isRed(card) ? ' red' : ''}${
    selected ? ' selected' : ''
  }" data-card="${card.id}">
    <span class="cc-corner"><b>${rankLabel(card.rank)}</b><i>${suit}</i></span>
    <span class="cc-pip">${suit}</span>
  </button>`;
};

/** 左右两个对手座位；data-pos 表示显示位置，由各自视角决定实际座位 */
export const seatHtml = (pos: 'left' | 'right'): string => `
  <div class="ddz-seat ${pos}" data-pos="${pos}">
    <span class="ddz-avatar">${pos === 'left' ? '左' : '右'}</span>
    <span class="ddz-seat-info">
      <span class="ddz-seat-name" data-name="${pos}"></span>
      <span class="ddz-seat-count">剩 <b data-count="${pos}">17</b> 张</span>
    </span>
    <span class="ddz-role" data-role="${pos}"></span>
  </div>
`;
