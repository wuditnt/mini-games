/**
 * 斗地主读牌：用浏览器自带的语音合成，以普通话朗读桌面上打出的牌。
 * 不依赖任何外部音频资源，并拥有独立的开关（与全局音效互不影响）。
 */
import type { Combo } from './cards';

const VOICE_KEY = 'ddz.voice';

/** 读牌开关，默认开启 */
export function voiceEnabled(): boolean {
  return localStorage.getItem(VOICE_KEY) !== 'off';
}

export function setVoiceEnabled(on: boolean) {
  localStorage.setItem(VOICE_KEY, on ? 'on' : 'off');
  if (!on) cancelSpeech();
}

export function cancelSpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

const SPOKEN_RANK: Record<number, string> = {
  11: '钩',
  12: '圈',
  13: '凯',
  14: '尖',
  15: '二',
  16: '小王',
  17: '大王',
};

function spokenRank(rank: number): string {
  return SPOKEN_RANK[rank] ?? String(rank);
}

function rangeText(start: number, end: number): string {
  return start === end ? spokenRank(start) : `${spokenRank(start)}到${spokenRank(end)}`;
}

/** 把牌型转成适合朗读的中文短句 */
export function comboSpeech(combo: Combo): string {
  const main = spokenRank(combo.main);
  const start = combo.main - combo.len + 1;
  switch (combo.type) {
    case 'single':
      return `单张，${main}`;
    case 'pair':
      return `一对${main}`;
    case 'triple':
      return `三个${main}`;
    case 'triple1':
      return `三带一，三个${main}`;
    case 'triple2':
      return `三带二，三个${main}`;
    case 'straight':
      return `顺子，${rangeText(start, combo.main)}`;
    case 'pairStraight':
      return `${combo.len}连对，${rangeText(start, combo.main)}`;
    case 'plane':
      return `飞机，${rangeText(start, combo.main)}`;
    case 'plane1':
      return `飞机带单，${rangeText(start, combo.main)}`;
    case 'plane2':
      return `飞机带对，${rangeText(start, combo.main)}`;
    case 'bomb':
      return `炸弹，四个${main}`;
    case 'rocket':
      return '王炸';
    default:
      return '';
  }
}

/** 朗读一句中文；需读牌开关处于开启状态 */
export function speak(text: string) {
  if (!text || !voiceEnabled()) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  const synth = window.speechSynthesis;
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 1.08;
  utterance.pitch = 1;
  synth.speak(utterance);
}
