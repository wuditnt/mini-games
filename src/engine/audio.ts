/** 轻量 WebAudio 合成音效：不依赖任何音频文件。 */
class Sfx {
  enabled = true;

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.42;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** 用户首次交互时解锁音频上下文。 */
  unlock() {
    this.ensure();
  }

  private noiseBuffer(ctx: AudioContext) {
    if (this.noise) return this.noise;
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
    return buf;
  }

  private tone(opts: {
    from: number;
    to?: number;
    dur: number;
    type?: OscillatorType;
    gain?: number;
    delay?: number;
    attack?: number;
  }) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const peak = opts.gain ?? 0.18;
    osc.type = opts.type ?? 'square';
    osc.frequency.setValueAtTime(opts.from, t0);
    if (opts.to !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t0 + opts.dur);
    }
    const atk = opts.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.02);
  }

  private burst(opts: { dur: number; gain?: number; from?: number; to?: number; delay?: number }) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(opts.from ?? 1800, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, opts.to ?? 180), t0 + opts.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.gain ?? 0.16, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + opts.dur + 0.02);
  }

  shoot() {
    this.tone({ from: 420, to: 150, dur: 0.09, type: 'square', gain: 0.09 });
    this.burst({ dur: 0.06, gain: 0.05, from: 2400, to: 600 });
  }

  enemyShoot() {
    this.tone({ from: 250, to: 110, dur: 0.09, type: 'square', gain: 0.035 });
  }

  hit() {
    this.tone({ from: 200, to: 70, dur: 0.11, type: 'sawtooth', gain: 0.1 });
  }

  explode() {
    this.burst({ dur: 0.42, gain: 0.24, from: 1500, to: 90 });
    this.tone({ from: 120, to: 38, dur: 0.38, type: 'sine', gain: 0.16 });
  }

  brick() {
    this.burst({ dur: 0.12, gain: 0.1, from: 3200, to: 700 });
  }

  ping() {
    this.tone({ from: 1250, to: 800, dur: 0.07, type: 'triangle', gain: 0.05 });
  }

  pickup() {
    this.tone({ from: 620, to: 940, dur: 0.1, type: 'triangle', gain: 0.11 });
    this.tone({ from: 940, to: 1240, dur: 0.12, type: 'triangle', gain: 0.09, delay: 0.07 });
  }

  wave() {
    [392, 523, 659].forEach((f, i) =>
      this.tone({ from: f, dur: 0.16, type: 'triangle', gain: 0.08, delay: i * 0.09 })
    );
  }

  gameOver() {
    [330, 262, 196, 147].forEach((f, i) =>
      this.tone({ from: f, to: f * 0.92, dur: 0.3, type: 'sawtooth', gain: 0.09, delay: i * 0.14 })
    );
  }

  click() {
    this.tone({ from: 700, to: 520, dur: 0.05, type: 'triangle', gain: 0.05 });
  }
}

export const sfx = new Sfx();
