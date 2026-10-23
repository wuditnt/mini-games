import { sfx } from '../engine/audio';

const KEY = 'arcade.sound';

export const soundEnabled = () => localStorage.getItem(KEY) !== 'off';

export function setSoundEnabled(on: boolean) {
  localStorage.setItem(KEY, on ? 'on' : 'off');
  sfx.enabled = on;
  if (on) sfx.click();
}
