const PREVENT_DEFAULT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

export interface InputOptions {
  /** 将屏幕坐标换算为游戏逻辑坐标 */
  toWorld: (clientX: number, clientY: number) => { x: number; y: number };
  /** 键盘按下回调（不含自动重复） */
  onKey?: (code: string) => void;
}

/** 统一的键鼠输入：移动用键盘，瞄准用鼠标。 */
export class Input {
  readonly keys = new Set<string>();
  readonly pointer = { x: 0, y: 0, down: false, inside: false, active: false };

  private cleanups: Array<() => void> = [];

  constructor(private canvas: HTMLCanvasElement, private opts: InputOptions) {
    const on = <K extends keyof WindowEventMap>(
      target: Window | HTMLCanvasElement,
      type: K | string,
      fn: EventListener,
      opts2?: AddEventListenerOptions
    ) => {
      target.addEventListener(type, fn, opts2);
      this.cleanups.push(() => target.removeEventListener(type, fn, opts2));
    };

    on(window, 'keydown', ((e: KeyboardEvent) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
      this.opts.onKey?.(e.code);
    }) as EventListener);

    on(window, 'keyup', ((e: KeyboardEvent) => {
      this.keys.delete(e.code);
    }) as EventListener);

    on(window, 'blur', (() => {
      this.keys.clear();
      this.pointer.down = false;
    }) as EventListener);

    on(window, 'pointermove', ((e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const p = this.opts.toWorld(e.clientX, e.clientY);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      this.pointer.active = true;
    }) as EventListener);

    on(canvas, 'pointerdown', ((e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      const p = this.opts.toWorld(e.clientX, e.clientY);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      this.pointer.down = true;
      this.pointer.active = true;
    }) as EventListener);

    on(window, 'pointerup', ((e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      this.pointer.down = false;
    }) as EventListener);

    on(canvas, 'mouseleave', (() => {
      this.pointer.inside = false;
    }) as EventListener);

    on(canvas, 'mouseenter', (() => {
      this.pointer.inside = true;
    }) as EventListener);

    on(canvas, 'contextmenu', ((e: Event) => e.preventDefault()) as EventListener);
  }

  get up() {
    return this.keys.has('KeyW') || this.keys.has('ArrowUp');
  }
  get down() {
    return this.keys.has('KeyS') || this.keys.has('ArrowDown');
  }
  get left() {
    return this.keys.has('KeyA') || this.keys.has('ArrowLeft');
  }
  get right() {
    return this.keys.has('KeyD') || this.keys.has('ArrowRight');
  }

  dispose() {
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
  }
}
