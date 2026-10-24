import type { NetRole } from './protocol';
import { NetSession } from './session';

export interface RoomPanelOptions {
  /** 渲染容器（通常是某个 overlay 的卡片内容区） */
  host: HTMLElement;
  /** 可以开始游戏时触发：房主点“开始战斗”，队员收到房主的开始指令 */
  onStart: (session: NetSession, role: NetRole) => void;
  /** 返回上一级菜单 */
  onBack: () => void;
}

type Step = 'choose' | 'join' | 'hosting' | 'guest' | 'error';

const CODE_LENGTH = 4;

/**
 * 通用联机房间面板：创建房间 / 输入房间码加入 / 等待队友 / 房主开始。
 * 不依赖任何具体游戏，后续其它游戏可直接复用。
 */
export class RoomPanel {
  private step: Step = 'choose';
  private session: NetSession | null = null;
  private peerReady = false;
  private busy = false;
  private note = '';
  private errorText = '';
  private codeInput = '';
  private token = 0;

  constructor(private opts: RoomPanelOptions) {
    this.opts.host.addEventListener('click', this.onClick);
    this.opts.host.addEventListener('input', this.onInput);
    this.render();
  }

  /** 回到初始选择房间状态，并断开旧连接 */
  reset() {
    this.token++;
    this.session?.leave();
    this.session = null;
    this.step = 'choose';
    this.peerReady = false;
    this.busy = false;
    this.note = '';
    this.errorText = '';
    this.codeInput = '';
    this.render();
  }

  destroy() {
    this.token++;
    this.opts.host.removeEventListener('click', this.onClick);
    this.opts.host.removeEventListener('input', this.onInput);
    this.session?.leave();
    this.session = null;
    this.opts.host.innerHTML = '';
  }

  private onInput = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.dataset.roomInput === 'code') {
      const clean = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
      if (input.value !== clean) input.value = clean;
      this.codeInput = clean;
      const submit = this.opts.host.querySelector<HTMLButtonElement>('[data-room="join-submit"]');
      if (submit) submit.disabled = clean.length !== CODE_LENGTH || this.busy;
    }
  };

  private onClick = (e: Event) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-room]');
    if (!btn || btn.hasAttribute('disabled')) return;
    const action = btn.dataset.room;

    if (action === 'back') {
      this.reset();
      this.opts.onBack();
      return;
    }
    if (action === 'choose-host') void this.createRoom();
    else if (action === 'choose-join') {
      this.step = 'join';
      this.render();
      this.opts.host.querySelector<HTMLInputElement>('[data-room-input="code"]')?.focus();
    }
    else if (action === 'join-submit') void this.joinRoom();
    else if (action === 'start') this.startAsHost();
    else if (action === 'retry') this.reset();
  };

  private async createRoom() {
    if (this.busy) return;
    this.busy = true;
    const token = ++this.token;
    this.step = 'hosting';
    this.note = '正在创建房间…';
    this.render();
    try {
      const session = await NetSession.host({
        onPeerJoin: () => {
          if (token !== this.token) return;
          this.peerReady = true;
          this.note = '队友已加入，可以开始战斗';
          this.render();
        },
        onPeerLeave: () => {
          if (token !== this.token) return;
          this.peerReady = false;
          this.note = '队友已离开，等待新的队友…';
          this.render();
        },
        onClose: (reason) => {
          if (token !== this.token) return;
          this.fail(reason);
        },
      });
      if (token !== this.token) {
        session.leave();
        return;
      }
      this.session = session;
      this.busy = false;
      this.note = '把房间码告诉队友，等待加入…';
      this.render();
    } catch (err) {
      if (token !== this.token) return;
      this.fail(err instanceof Error ? err.message : '创建房间失败');
    }
  }

  private async joinRoom() {
    if (this.busy || this.codeInput.length !== CODE_LENGTH) return;
    this.busy = true;
    const token = ++this.token;
    this.step = 'guest';
    this.note = '正在加入房间…';
    this.render();
    try {
      const session = await NetSession.join(this.codeInput, {
        onPeerLeave: () => {
          if (token !== this.token) return;
          this.fail('房主已离开房间');
        },
        onClose: (reason) => {
          if (token !== this.token) return;
          this.fail(reason);
        },
        onData: (data) => {
          if (token !== this.token) return;
          if (data && typeof data === 'object' && (data as { t?: string }).t === 'start') {
            this.launch(session, 'guest');
          }
        },
      });
      if (token !== this.token) {
        session.leave();
        return;
      }
      this.session = session;
      this.busy = false;
      this.note = '等待房主开始战斗…';
      this.render();
    } catch (err) {
      if (token !== this.token) return;
      this.fail(err instanceof Error ? err.message : '加入房间失败');
    }
  }

  private startAsHost() {
    if (!this.session || !this.peerReady) return;
    this.session.send({ t: 'start' });
    this.launch(this.session, 'host');
  }

  private launch(session: NetSession, role: NetRole) {
    this.token++;
    this.opts.onStart(session, role);
  }

  private fail(message: string) {
    this.session?.leave();
    this.session = null;
    this.busy = false;
    this.errorText = message;
    this.step = 'error';
    this.render();
  }

  private render() {
    const host = this.opts.host;

    if (this.step === 'choose') {
      host.innerHTML = `
        <p class="ov-desc">同一局域网内，两名玩家一起守住基地。房主创建房间，队友输入房间码加入。</p>
        <div class="btn-row">
          <button class="btn-primary" type="button" data-room="choose-host">创建房间</button>
          <button class="btn-secondary" type="button" data-room="choose-join">加入房间</button>
        </div>
        <button class="room-back" type="button" data-room="back">返回</button>
      `;
      return;
    }

    if (this.step === 'join') {
      host.innerHTML = `
        <p class="ov-desc">输入房主提供的 4 位房间码：</p>
        <input
          class="room-code-input"
          type="text"
          inputmode="text"
          autocomplete="off"
          spellcheck="false"
          maxlength="${CODE_LENGTH}"
          placeholder="例如 7KQ2"
          value="${this.codeInput}"
          data-room-input="code"
        />
        <div class="btn-row">
          <button class="btn-primary" type="button" data-room="join-submit" ${this.codeInput.length === CODE_LENGTH ? '' : 'disabled'}>加入</button>
          <button class="btn-secondary" type="button" data-room="back">返回</button>
        </div>
      `;
      return;
    }

    if (this.step === 'error') {
      host.innerHTML = `
        <p class="room-error">${escapeHtml(this.errorText)}</p>
        <div class="btn-row">
          <button class="btn-primary" type="button" data-room="retry">重新连接</button>
          <button class="btn-secondary" type="button" data-room="back">返回大厅</button>
        </div>
      `;
      return;
    }

    if (this.step === 'hosting') {
      const ready = this.peerReady;
      host.innerHTML = `
        <p class="ov-desc">房间码</p>
        <div class="room-code">${this.session?.code ?? '····'}</div>
        <p class="room-note ${ready ? 'ok' : ''}">${escapeHtml(this.note)}</p>
        <div class="btn-row">
          ${
            ready
              ? '<button class="btn-primary" type="button" data-room="start">开始战斗</button>'
              : '<button class="btn-primary" type="button" disabled>开始战斗</button>'
          }
          <button class="btn-secondary" type="button" data-room="back">解散房间</button>
        </div>
      `;
      return;
    }

    // guest
    host.innerHTML = `
      <p class="ov-desc">房间码</p>
      <div class="room-code">${escapeHtml(this.session?.code ?? this.codeInput)}</div>
      <p class="room-note ${this.busy ? '' : 'ok'}">${escapeHtml(this.note)}</p>
      <div class="btn-row">
        <button class="btn-secondary" type="button" data-room="back">取消</button>
      </div>
    `;
  }
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}
