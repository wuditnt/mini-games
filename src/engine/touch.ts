const MAX_OFFSET = 34; // 摇杆最大位移
const DEAD_ZONE = 0.2; // 死区（相对于最大位移）

export interface StickState {
  active: boolean;
  x: number;
  y: number;
  /** 0~1，超过死区后才有值 */
  mag: number;
}

interface Stick {
  state: StickState;
  el: HTMLDivElement;
  knob: HTMLDivElement;
  tip: HTMLDivElement | null;
  pointerId: number;
  originX: number;
  originY: number;
  used: boolean;
}

const idle = (): StickState => ({ active: false, x: 0, y: 0, mag: 0 });

/** 触屏虚拟摇杆：左半屏移动，右半屏瞄准并自动开火。 */
export class TouchControls {
  readonly enabled: boolean;
  readonly move: StickState = idle();
  readonly aim: StickState = idle();

  private active = false;
  private layer: HTMLDivElement | null = null;
  private tips: HTMLDivElement | null = null;
  private moveStick: Stick | null = null;
  private aimStick: Stick | null = null;
  private cleanups: Array<() => void> = [];

  constructor(host: HTMLElement, frame: HTMLElement) {
    this.enabled =
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);
    if (!this.enabled) return;

    frame.classList.add('is-touch');
    host.classList.add('has-touch');

    const layer = document.createElement('div');
    layer.className = 'touch-layer';
    layer.innerHTML = `
      <div class="stick stick-move"><div class="stick-knob"></div></div>
      <div class="stick stick-aim"><div class="stick-knob"></div></div>
    `;
    host.appendChild(layer);
    this.layer = layer;

    const tips = document.createElement('div');
    tips.className = 'touch-tips';
    tips.innerHTML = `
      <div class="touch-tip tip-move">拖动移动</div>
      <div class="touch-tip tip-aim">拖动瞄准 · 自动开火</div>
    `;
    frame.appendChild(tips);
    this.tips = tips;

    this.moveStick = this.createStick(layer, '.stick-move', tips, '.tip-move', this.move);
    this.aimStick = this.createStick(layer, '.stick-aim', tips, '.tip-aim', this.aim);

    const on = (type: string, fn: EventListener) => {
      layer.addEventListener(type, fn, { passive: false });
      this.cleanups.push(() => layer.removeEventListener(type, fn));
    };

    on('pointerdown', (e) => this.onDown(e as PointerEvent));
    on('pointermove', (e) => this.onMove(e as PointerEvent));
    on('pointerup', (e) => this.onUp(e as PointerEvent));
    on('pointercancel', (e) => this.onUp(e as PointerEvent));
  }

  private createStick(
    host: HTMLElement,
    elSel: string,
    tips: HTMLElement,
    tipSel: string,
    state: StickState
  ): Stick {
    const el = host.querySelector<HTMLDivElement>(elSel)!;
    const knob = el.querySelector<HTMLDivElement>('.stick-knob')!;
    const tip = tips.querySelector<HTMLDivElement>(tipSel);
    return { state, el, knob, tip, pointerId: -1, originX: 0, originY: 0, used: false };
  }

  private stickFor(x: number): Stick | null {
    const rect = this.layer?.getBoundingClientRect();
    if (!rect) return null;
    return x - rect.left < rect.width / 2 ? this.moveStick : this.aimStick;
  }

  private onDown(e: PointerEvent) {
    if (!this.active || e.pointerType === 'mouse') return;
    const stick = this.stickFor(e.clientX);
    if (!stick || stick.pointerId !== -1) return;
    e.preventDefault();

    stick.pointerId = e.pointerId;
    stick.originX = e.clientX;
    stick.originY = e.clientY;
    stick.used = true;
    stick.el.classList.add('on');
    this.place(stick, e.clientX, e.clientY);
    this.setVector(stick, 0, 0);

    if (stick.tip) stick.tip.classList.add('used');
    try {
      this.layer?.setPointerCapture(e.pointerId);
    } catch {
      /* 部分浏览器不支持多点捕获，忽略 */
    }
  }

  private onMove(e: PointerEvent) {
    const stick = this.find(e.pointerId);
    if (!stick) return;
    e.preventDefault();
    this.setVector(stick, e.clientX - stick.originX, e.clientY - stick.originY);
  }

  private onUp(e: PointerEvent) {
    const stick = this.find(e.pointerId);
    if (!stick) return;
    this.release(stick);
  }

  /** 仅在游戏进行中响应触控，暂停/菜单时不生成摇杆 */
  setActive(on: boolean) {
    if (this.active === on || !this.enabled) return;
    this.active = on;
    this.layer?.classList.toggle('live', on);
    this.tips?.classList.toggle('live', on);
    if (!on) {
      for (const s of [this.moveStick, this.aimStick]) {
        if (s) this.release(s);
      }
    }
  }

  private release(stick: Stick) {
    stick.pointerId = -1;
    stick.state.active = false;
    stick.state.x = 0;
    stick.state.y = 0;
    stick.state.mag = 0;
    stick.el.classList.remove('on');
    stick.knob.style.transform = 'translate3d(0, 0, 0)';
  }

  private find(pointerId: number): Stick | null {
    for (const s of [this.moveStick, this.aimStick]) {
      if (s && s.pointerId === pointerId) return s;
    }
    return null;
  }

  private place(stick: Stick, clientX: number, clientY: number) {
    const rect = this.layer!.getBoundingClientRect();
    stick.el.style.left = `${clientX - rect.left}px`;
    stick.el.style.top = `${clientY - rect.top}px`;
  }

  private setVector(stick: Stick, dx: number, dy: number) {
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, MAX_OFFSET);
    const ratio = clamped / MAX_OFFSET;
    const mag = ratio < DEAD_ZONE ? 0 : ratio;

    stick.state.active = true;
    stick.state.mag = mag;
    if (len > 0.01 && mag > 0) {
      stick.state.x = (dx / len) * mag;
      stick.state.y = (dy / len) * mag;
    } else {
      stick.state.x = 0;
      stick.state.y = 0;
    }

    const kx = clamped > 0 ? (dx / len) * clamped : 0;
    const ky = clamped > 0 ? (dy / len) * clamped : 0;
    stick.knob.style.transform = `translate3d(${kx}px, ${ky}px, 0)`;
  }

  dispose() {
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
    this.layer?.remove();
    this.layer = null;
    this.tips?.remove();
    this.tips = null;
  }
}
