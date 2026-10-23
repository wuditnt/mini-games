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

const starfallArt = `
<svg class="starfall-art" viewBox="0 0 420 300" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="sfHalo">
      <stop offset="0%" stop-color="#5ec8e6" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#5ec8e6" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sfHull" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f4fdff"/>
      <stop offset="55%" stop-color="#b7e6f5"/>
      <stop offset="100%" stop-color="#5f8fae"/>
    </linearGradient>
    <filter id="sfGlow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <circle cx="210" cy="150" r="150" fill="url(#sfHalo)"/>
  <g stroke="#ffffff" stroke-opacity="0.03">
    <path d="M42 0v300M100 0v300M158 0v300M216 0v300M274 0v300M332 0v300M390 0v300"/>
    <path d="M0 54h420M0 108h420M0 162h420M0 216h420M0 270h420"/>
  </g>

  <g opacity="0.7">
    <circle cx="72" cy="62" r="1.6" fill="#9fb6d4"/>
    <circle cx="342" cy="46" r="1.2" fill="#9fb6d4"/>
    <circle cx="300" cy="104" r="1.8" fill="#cfe8ff"/>
    <circle cx="108" cy="128" r="1.1" fill="#9fb6d4"/>
    <circle cx="364" cy="196" r="1.4" fill="#cfe8ff"/>
    <circle cx="58" cy="222" r="1.2" fill="#9fb6d4"/>
  </g>

  <!-- 敌机 -->
  <g filter="url(#sfGlow)">
    <path d="M210 96 L186 70 L203 76 L217 76 L234 70 Z" fill="rgba(197,140,255,0.18)" stroke="#b884ff" stroke-width="1.8" stroke-linejoin="round"/>
    <circle cx="210" cy="82" r="2.6" fill="#efe2ff"/>
  </g>

  <!-- 弹幕 -->
  <g class="sf-orbs" filter="url(#sfGlow)">
    <circle cx="196" cy="122" r="4" fill="#ff6f9f"/>
    <circle cx="228" cy="130" r="3.4" fill="#ff6f9f"/>
    <circle cx="178" cy="146" r="3" fill="#ffb15e"/>
    <circle cx="244" cy="152" r="4.2" fill="#c58cff"/>
    <circle cx="206" cy="160" r="3" fill="#ff6f9f" opacity="0.8"/>
    <circle cx="166" cy="168" r="2.6" fill="#ffb15e" opacity="0.7"/>
    <circle cx="256" cy="174" r="2.8" fill="#c58cff" opacity="0.7"/>
  </g>

  <!-- 战机 -->
  <g filter="url(#sfGlow)">
    <path d="M210 244 L204 262 L210 278 L216 262 Z" fill="#8ff2ff" opacity="0.35"/>
    <g transform="translate(210 232)">
      <path d="M0 -24 L-7 -6 L-19 6 L-13 14 L-4 11 L4 11 L13 14 L19 6 L7 -6Z" fill="url(#sfHull)" stroke="#bff4ff" stroke-width="1.4"/>
      <ellipse cx="0" cy="-6" rx="3.2" ry="6.5" fill="#64f0ff"/>
      <rect x="-15" y="3" width="3" height="7" rx="1" fill="#f2a63b"/>
      <rect x="12" y="3" width="3" height="7" rx="1" fill="#f2a63b"/>
    </g>
  </g>
</svg>`;

const snakeArt = `
<svg class="snake-art" viewBox="0 0 420 300" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="snHalo">
      <stop offset="0%" stop-color="#5ec8e6" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#5ec8e6" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="snBody" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#9ff2ff"/>
      <stop offset="100%" stop-color="#3f9fbf"/>
    </linearGradient>
    <filter id="snGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <circle cx="210" cy="150" r="150" fill="url(#snHalo)"/>
  <g stroke="#ffffff" stroke-opacity="0.04">
    <path d="M0 60h420M0 120h420M0 180h420M0 240h420"/>
    <path d="M60 0v300M120 0v300M180 0v300M240 0v300M300 0v300M360 0v300"/>
  </g>

  <g filter="url(#snGlow)">
    <path d="M86 224 H190 Q210 224 210 204 V182 Q210 162 230 162 H276 Q296 162 296 182 V204 Q296 224 316 224 H328"
      stroke="url(#snBody)" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <rect x="326" y="210" width="30" height="30" rx="9" fill="#bff6ff"/>
    <circle cx="336" cy="221" r="3" fill="#0b1a22"/>
    <circle cx="345" cy="231" r="3" fill="#0b1a22"/>
  </g>

  <g class="apple" filter="url(#snGlow)">
    <circle cx="104" cy="128" r="15" fill="#ff7a5c"/>
    <circle cx="99" cy="123" r="5" fill="#ffb199" opacity="0.8"/>
    <ellipse cx="112" cy="113" rx="7" ry="3.4" transform="rotate(-28 112 113)" fill="#7ce0a3"/>
  </g>

  <circle cx="276" cy="92" r="8" fill="#ffd76a" opacity="0.9"/>
  <circle cx="276" cy="92" r="14" stroke="#ffd76a" stroke-opacity="0.35" stroke-dasharray="3 5"/>
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
    mode: '单机弹幕',
    description: '在密集弹幕中穿行，擦弹充能、引爆炸弹清屏。每五波迎战一次 BOSS。',
    tags: ['单人', '弹幕射击', '键鼠 / 触屏'],
    status: 'ready',
    art: starfallArt,
    loader: () => import('./starfall/index'),
  },
  {
    id: 'snake',
    index: '04',
    title: '贪吃蛇',
    mode: '单机经典',
    description: '吞下果实不断变长，连续进食叠加连击倍率。速度随长度提升，别撞墙，也别咬到自己。',
    tags: ['单人', '经典街机', '键鼠 / 触屏'],
    status: 'ready',
    art: snakeArt,
    loader: () => import('./snake/index'),
  },
];
