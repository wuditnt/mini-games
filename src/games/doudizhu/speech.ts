/**
 * 斗地主读牌：只朗读牌面本身（点数与张数），
 * 不朗读「顺子 / 飞机 / 炸弹 / 三带一」等牌型术语与座位名。
 * 语音能力由 engine/speech 提供，本文件只负责把牌型翻译成中文。
 */
import type { Combo } from './cards';
import { createSpeaker } from '../../engine/speech';

const speaker = createSpeaker('ddz.voice', {
  lang: 'zh-CN',
  rate: 1.08,
  pitch: 1,
});

export const voiceEnabled = speaker.enabled;
export const setVoiceEnabled = speaker.setEnabled;
export const cancelSpeech = speaker.cancel;
export const speak = speaker.speak;

const SPOKEN_RANK: Record<number, string> = {
  3: '三',
  4: '四',
  5: '五',
  6: '六',
  7: '七',
  8: '八',
  9: '九',
  10: '十',
  11: '钩',
  12: '圈',
  13: '凯',
  14: '尖',
  15: '二',
  16: '小王',
  17: '大王',
};

const SPOKEN_COUNT: Record<number, string> = {
  2: '两',
  3: '三',
  4: '四',
  5: '五',
  6: '六',
  7: '七',
  8: '八',
  9: '九',
  10: '十',
};

const spokenRank = (rank: number): string => SPOKEN_RANK[rank] ?? String(rank);
const spokenCount = (count: number): string => SPOKEN_COUNT[count] ?? String(count);

/** 把牌型转成只含牌面信息的中文短句 */
export function comboSpeech(combo: Combo): string {
  const main = spokenRank(combo.main);
  const start = spokenRank(combo.main - combo.len + 1);

  switch (combo.type) {
    case 'single':
      return `一张${main}`;
    case 'pair':
      return `对${main}`;
    case 'triple':
      return `三个${main}`;
    case 'triple1':
      return `三个${main}带一张`;
    case 'triple2':
      return `三个${main}带一对`;
    case 'straight':
      return `${start}到${main}`;
    case 'pairStraight':
      return `对${start}到对${main}`;
    case 'plane':
      return `三个${start}到三个${main}`;
    case 'plane1':
      return `三个${start}到三个${main}带${spokenCount(combo.len)}张`;
    case 'plane2':
      return `三个${start}到三个${main}带${spokenCount(combo.len)}对`;
    case 'bomb':
      return `四个${main}`;
    case 'rocket':
      return '小王大王';
    default:
      return '';
  }
}
