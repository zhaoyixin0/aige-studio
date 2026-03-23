export class SoundSynth {
  private ctx: AudioContext | null = null;
  private muted = false;

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'sine', gain: number = 0.3): void {
    if (this.muted) return;
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  playScore(): void {
    // Ascending arpeggio matching V1: C5 → E5 → G5
    this.playTone(523, 0.08);              // C5
    setTimeout(() => this.playTone(659, 0.08), 50);  // E5
    setTimeout(() => this.playTone(784, 0.12), 100);  // G5
  }

  playHit(): void {
    // Low sawtooth buzz matching V1
    this.playTone(110, 0.2, 'sawtooth', 0.15);
  }

  playGameOver(): void {
    // Descending tone matching V1: 440 → 370 → 330 → 262
    this.playTone(440, 0.15);
    setTimeout(() => this.playTone(370, 0.15), 150);
    setTimeout(() => this.playTone(330, 0.15), 300);
    setTimeout(() => this.playTone(262, 0.4), 450);
  }

  playTick(): void {
    this.playTone(800, 0.05, 'square', 0.15);
  }

  playCombo(level: number): void {
    // Higher pitch with each combo level
    const baseFreq = 600 + level * 100;
    this.playTone(baseFreq, 0.1, 'sine', 0.25);
    setTimeout(() => this.playTone(baseFreq * 1.25, 0.1, 'sine', 0.2), 60);
  }

  setMuted(m: boolean): void {
    this.muted = m;
  }

  destroy(): void {
    this.ctx?.close();
    this.ctx = null;
  }
}
