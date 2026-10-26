/**
 * 通用语音朗读：封装浏览器 SpeechSynthesis，
 * 提供开关、取消与发音参数，供各游戏复用。
 */

export interface SpeechOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  /** 是否打断上一句，默认 true */
  interrupt?: boolean;
}

export interface Speaker {
  readonly available: boolean;
  enabled: () => boolean;
  setEnabled: (on: boolean) => void;
  toggle: () => boolean;
  speak: (text: string, options?: SpeechOptions) => void;
  cancel: () => void;
}

function engine(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  return 'speechSynthesis' in window ? window.speechSynthesis : null;
}

/** 创建一个带独立开关的朗读器，开关状态存在 localStorage 的 storageKey 中 */
export function createSpeaker(
  storageKey: string,
  defaults: SpeechOptions = {}
): Speaker {
  const enabled = () => localStorage.getItem(storageKey) !== 'off';

  const cancel = () => {
    engine()?.cancel();
  };

  const setEnabled = (on: boolean) => {
    localStorage.setItem(storageKey, on ? 'on' : 'off');
    if (!on) cancel();
  };

  const speak = (text: string, options?: SpeechOptions) => {
    if (!text || !enabled()) return;
    const synth = engine();
    if (!synth) return;

    const opts = { ...defaults, ...options };
    if (opts.interrupt !== false) synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = opts.lang ?? 'zh-CN';
    utterance.rate = opts.rate ?? 1;
    utterance.pitch = opts.pitch ?? 1;
    utterance.volume = opts.volume ?? 1;
    synth.speak(utterance);
  };

  return {
    available: engine() !== null,
    enabled,
    setEnabled,
    toggle: () => {
      const next = !enabled();
      setEnabled(next);
      return next;
    },
    speak,
    cancel,
  };
}
