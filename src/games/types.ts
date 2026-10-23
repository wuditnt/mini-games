export interface MountOptions {
  /** 退出游戏，返回大厅 */
  onExit: () => void;
}

export interface GameHandle {
  destroy: () => void;
}

export interface GameModule {
  mount: (host: HTMLElement, opts: MountOptions) => GameHandle;
}
