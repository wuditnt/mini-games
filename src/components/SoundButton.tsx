import { useState } from 'react';
import { Button } from 'antd';
import { soundEnabled, setSoundEnabled } from '../lib/sound';

interface Props {
  /** ghost：游戏页顶栏样式；text：后台顶栏样式 */
  variant?: 'ghost' | 'text';
}

export function SoundButton({ variant = 'text' }: Props) {
  const [on, setOn] = useState(soundEnabled);

  const toggle = () => {
    const next = !on;
    setSoundEnabled(next);
    setOn(next);
  };

  const label = `音效 ${on ? '开' : '关'}`;

  return variant === 'ghost' ? (
    <button className="ghost-btn" type="button" onClick={toggle}>
      {label}
    </button>
  ) : (
    <Button type="text" onClick={toggle}>
      {label}
    </Button>
  );
}
