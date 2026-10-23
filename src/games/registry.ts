import type { GameModule } from './types';

export interface GameMeta {
  id: string;
  index: string;
  title: string;
  mode: string;
  description: string;
  tags: string[];
  status: 'ready' | 'soon';
  art?: string;
  loader?: () => Promise<GameModule>;
}

const tankArt = `
<svg viewBox="0 0 420 300" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="hullGrad" x1="0.1" y1="0" x2="0.85" y2="1">
      <stop offset="0%" stop-color="#dde6f0"/>
      <stop offset="52%" stop-color="#a9b6c5"/>
      <stop offset="100%" stop-color="#78868f"/>
    </linearGradient>
    <linearGradient id="treadGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3b4553"/>
      <stop offset="100%" stop-color="#141920"/>
    </linearGradient>
    <linearGradient id="barrelGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#c78c3c"/>
      <stop offset="100%" stop-color="#f6bd62"/>
    </linearGradient>
    <radialGradient id="halo">
      <stop offset="0%" stop-color="#f2a63b" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#f2a63b" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <circle cx="204" cy="150" r="156" fill="url(#halo)"/>

  <!-- 地面砖块 -->
  <g opacity="0.5">
    <rect x="14" y="244" width="58" height="28" rx="3" fill="#6b382b"/>
    <rect x="14" y="244" width="58" height="9" rx="3" fill="#8b4b38"/>
    <rect x="78" y="244" width="58" height="28" rx="3" fill="#552c22"/>
    <rect x="78" y="244" width="58" height="9" rx="3" fill="#7a4032"/>
    <rect x="46" y="214" width="58" height="20" rx="3" fill="#552c22"/>
    <rect x="330" y="46" width="54" height="22" rx="3" fill="#552c22"/>
    <rect x="340" y="30" width="36" height="10" rx="2" fill="#6b382b"/>
  </g>

  <!-- 远处敌车 -->
  <g opacity="0.42" transform="translate(348 232) rotate(-16) scale(0.6)">
    <rect x="-48" y="-32" width="96" height="18" rx="6" fill="#3a1d1f"/>
    <rect x="-48" y="14" width="96" height="18" rx="6" fill="#3a1d1f"/>
    <rect x="-40" y="-20" width="80" height="40" rx="8" fill="#7c2f34"/>
    <rect x="0" y="-4" width="56" height="9" rx="4" fill="#491c21"/>
  </g>

  <g transform="translate(204 148) rotate(-10)">
    <ellipse cx="8" cy="16" rx="104" ry="62" fill="#000000" opacity="0.4"/>

    <!-- 履带 -->
    <rect x="-94" y="-64" width="188" height="32" rx="11" fill="url(#treadGrad)"/>
    <rect x="-94" y="32" width="188" height="32" rx="11" fill="url(#treadGrad)"/>
    <g stroke="#56616f" stroke-width="2.4" stroke-linecap="round" opacity="0.9">
      <path d="M-78 -53v10M-58 -53v10M-38 -53v10M-18 -53v10M2 -53v10M22 -53v10M42 -53v10M62 -53v10"/>
      <path d="M-78 43v10M-58 43v10M-38 43v10M-18 43v10M2 43v10M22 43v10M42 43v10M62 43v10"/>
    </g>

    <!-- 挡泥板 -->
    <rect x="-102" y="-40" width="15" height="80" rx="4" fill="#5a6573"/>
    <rect x="88" y="-40" width="15" height="80" rx="4" fill="#5a6573"/>

    <!-- 车体 -->
    <rect x="-86" y="-40" width="172" height="80" rx="13" fill="url(#hullGrad)"/>
    <rect x="-86" y="-40" width="172" height="22" rx="11" fill="#ffffff" opacity="0.1"/>
    <path d="M-54 -24v48M46 -24v48" stroke="#6d7a8a" stroke-width="2" opacity="0.32"/>
    <rect x="-76" y="10" width="34" height="18" rx="4" fill="#8391a0" opacity="0.45"/>
    <g stroke="#5f6c7b" stroke-width="2" opacity="0.45">
      <path d="M18 -30h48M18 -24h48"/>
    </g>

    <!-- 炮塔 -->
    <g class="turret">
      <rect x="14" y="-8" width="92" height="16" rx="5" fill="url(#barrelGrad)"/>
      <rect x="98" y="-11" width="15" height="22" rx="4" fill="#d69c47"/>
      <rect x="22" y="-8" width="16" height="16" fill="#000000" opacity="0.16"/>
      <circle cx="0" cy="0" r="32" fill="#e9eff7"/>
      <circle cx="0" cy="0" r="32" fill="none" stroke="#f2a63b" stroke-width="3"/>
      <circle cx="0" cy="0" r="21" fill="#94a2b2"/>
      <circle cx="0" cy="0" r="20" fill="none" stroke="#6d7a8a" stroke-width="2" opacity="0.55"/>
      <circle cx="0" cy="0" r="8" fill="#f2a63b"/>
      <path d="M-17 -21A32 32 0 0 1 9 -31" stroke="#ffffff" stroke-width="3" opacity="0.45" stroke-linecap="round"/>
    </g>
  </g>
</svg>`;

const breakoutArt = `
<svg class="breakout-art" viewBox="0 0 420 300" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="boHalo">
      <stop offset="0%" stop-color="#5ec8e6" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#5ec8e6" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="boPaddle" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f6fbff"/>
      <stop offset="60%" stop-color="#c4d3e2"/>
      <stop offset="100%" stop-color="#8ea1b4"/>
    </linearGradient>
    <filter id="boGlow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="7" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <circle cx="210" cy="150" r="150" fill="url(#boHalo)"/>
  <g stroke="#ffffff" stroke-opacity="0.035">
    <path d="M36 0v300M84 0v300M132 0v300M180 0v300M228 0v300M276 0v300M324 0v300M372 0v300"/>
    <path d="M0 48h420M0 96h420M0 144h420M0 192h420M0 240h420"/>
  </g>

  <!-- 砖块墙 -->
  <g>
    <rect x="33" y="66" width="54" height="19" rx="4" fill="#f2a63b" fill-opacity="0.28" stroke="#f2a63b" stroke-width="1.6"/>
    <rect x="93" y="66" width="54" height="19" rx="4" fill="#f2a63b" fill-opacity="0.28" stroke="#f2a63b" stroke-width="1.6"/>
    <rect x="153" y="66" width="54" height="19" rx="4" fill="#f2a63b" fill-opacity="0.28" stroke="#f2a63b" stroke-width="1.6"/>
    <rect x="213" y="66" width="54" height="19" rx="4" fill="#f2a63b" fill-opacity="0.28" stroke="#f2a63b" stroke-width="1.6"/>
    <rect x="273" y="66" width="54" height="19" rx="4" fill="#f2a63b" fill-opacity="0.28" stroke="#f2a63b" stroke-width="1.6"/>
    <rect x="333" y="66" width="54" height="19" rx="4" fill="#f2a63b" fill-opacity="0.28" stroke="#f2a63b" stroke-width="1.6"/>

    <rect x="33" y="91" width="54" height="19" rx="4" fill="#e98a5f" fill-opacity="0.26" stroke="#e98a5f" stroke-width="1.6"/>
    <rect x="93" y="91" width="54" height="19" rx="4" fill="#e98a5f" fill-opacity="0.26" stroke="#e98a5f" stroke-width="1.6"/>
    <rect x="213" y="91" width="54" height="19" rx="4" fill="#e98a5f" fill-opacity="0.26" stroke="#e98a5f" stroke-width="1.6"/>
    <rect x="273" y="91" width="54" height="19" rx="4" fill="#e98a5f" fill-opacity="0.26" stroke="#e98a5f" stroke-width="1.6"/>
    <rect x="333" y="91" width="54" height="19" rx="4" fill="#e98a5f" fill-opacity="0.26" stroke="#e98a5f" stroke-width="1.6"/>

    <rect x="33" y="116" width="54" height="19" rx="4" fill="#ad7ce0" fill-opacity="0.24" stroke="#ad7ce0" stroke-width="1.6"/>
    <rect x="93" y="116" width="54" height="19" rx="4" fill="#ad7ce0" fill-opacity="0.24" stroke="#ad7ce0" stroke-width="1.6"/>
    <rect x="153" y="116" width="54" height="19" rx="4" fill="#ad7ce0" fill-opacity="0.24" stroke="#ad7ce0" stroke-width="1.6"/>
    <rect x="273" y="116" width="54" height="19" rx="4" fill="#ad7ce0" fill-opacity="0.24" stroke="#ad7ce0" stroke-width="1.6"/>
    <rect x="333" y="116" width="54" height="19" rx="4" fill="#ad7ce0" fill-opacity="0.24" stroke="#ad7ce0" stroke-width="1.6"/>

    <rect x="33" y="141" width="54" height="19" rx="4" fill="#5ec8e6" fill-opacity="0.24" stroke="#5ec8e6" stroke-width="1.6"/>
    <rect x="153" y="141" width="54" height="19" rx="4" fill="#5ec8e6" fill-opacity="0.24" stroke="#5ec8e6" stroke-width="1.6"/>
    <rect x="213" y="141" width="54" height="19" rx="4" fill="#5ec8e6" fill-opacity="0.24" stroke="#5ec8e6" stroke-width="1.6"/>
    <rect x="333" y="141" width="54" height="19" rx="4" fill="#5ec8e6" fill-opacity="0.24" stroke="#5ec8e6" stroke-width="1.6"/>
  </g>

  <!-- 球与轨迹 -->
  <g filter="url(#boGlow)">
    <circle cx="286" cy="196" r="4.5" fill="#ffd08a" opacity="0.35"/>
    <circle cx="271" cy="212" r="5" fill="#ffd08a" opacity="0.55"/>
    <circle class="ball" cx="254" cy="230" r="8" fill="#fff8ec"/>
  </g>

  <!-- 挡板 -->
  <g filter="url(#boGlow)">
    <rect x="112" y="252" width="196" height="15" rx="7.5" fill="url(#boPaddle)"/>
    <rect x="112" y="263" width="196" height="4" rx="2" fill="#f2a63b" fill-opacity="0.9"/>
  </g>

  <circle cx="254" cy="230" r="20" stroke="#ffd08a" stroke-opacity="0.18"/>
</svg>`;

export const games: GameMeta[] = [
  {
    id: 'tank',
    index: '01',
    title: '坦克大战',
    mode: '单机生存',
    description: '守住基地，击退一波又一波装甲部队。键盘鼠标或双摇杆触屏，都能开打。',
    tags: ['单人', '波次生存', '键鼠 / 触屏'],
    status: 'ready',
    art: tankArt,
    loader: () => import('./tank/index'),
  },
  {
    id: 'breakout',
    index: '02',
    title: '打砖块',
    mode: '单机闯关',
    description: '反弹小球击碎全部砖块，接住补给强化挡板，连击越高得分越多。',
    tags: ['单人', '休闲闯关', '键鼠 / 触屏'],
    status: 'ready',
    art: breakoutArt,
    loader: () => import('./breakout/index'),
  },
  {
    id: 'starfall',
    index: '03',
    title: '星际弹幕',
    mode: '筹备中',
    description: '俯视视角的太空射击，弹幕、闪避与极限擦弹。',
    tags: ['单人', '射击'],
    status: 'soon',
  },
];
