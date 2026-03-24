import type { ModuleSchema, GameEngine } from '@/engine/core';
import { BaseModule } from '@/engine/modules/base-module';

export class AudioInput extends BaseModule {
  readonly type = 'AudioInput';

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private stream: MediaStream | null = null;
  private isActive = false;

  getSchema(): ModuleSchema {
    return {
      mode: {
        type: 'select',
        label: 'Mode',
        default: 'volume',
        options: ['volume', 'blow', 'frequency'],
      },
      threshold: {
        type: 'range',
        label: 'Threshold',
        default: 0.3,
        min: 0,
        max: 1,
        step: 0.05,
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);
    this.startMicrophone();
  }

  private async startMicrophone(): Promise<void> {
    try {
      if (typeof window === 'undefined' || !navigator.mediaDevices) return;

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.stream);

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      this.isActive = true;
    } catch {
      // Microphone access denied or unavailable
      this.isActive = false;
    }
  }

  update(_dt: number): void {
    if (this.gameflowPaused) return;
    if (!this.isActive || !this.analyser || !this.dataArray) return;

    const mode: string = this.params.mode ?? 'volume';
    const threshold: number = this.params.threshold ?? 0.3;

    if (mode === 'volume' || mode === 'blow') {
      this.analyser.getByteTimeDomainData(this.dataArray);

      // Compute RMS volume (0-1)
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        const normalized = (this.dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / this.dataArray.length);
      const level = Math.min(1, rms * 4); // Scale up for usability

      this.emit('input:audio:volume', { level });

      // Blow detection: check low frequency dominance + high volume
      if (mode === 'blow' && level > threshold) {
        this.analyser.getByteFrequencyData(this.dataArray);
        // Low frequencies are the first bins
        let lowFreqEnergy = 0;
        let highFreqEnergy = 0;
        const midpoint = Math.floor(this.dataArray.length / 4);
        for (let i = 0; i < midpoint; i++) {
          lowFreqEnergy += this.dataArray[i];
        }
        for (let i = midpoint; i < this.dataArray.length; i++) {
          highFreqEnergy += this.dataArray[i];
        }
        // Blow is characterized by dominant low frequencies
        if (lowFreqEnergy > highFreqEnergy * 1.5) {
          this.emit('input:audio:blow', { level });
        }
      }
    }

    if (mode === 'frequency') {
      this.analyser.getByteFrequencyData(this.dataArray);

      // Find dominant frequency bin
      let maxVal = 0;
      let maxIndex = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        if (this.dataArray[i] > maxVal) {
          maxVal = this.dataArray[i];
          maxIndex = i;
        }
      }

      const normalizedLevel = maxVal / 255;
      if (normalizedLevel > threshold) {
        // Approximate frequency from bin index
        const sampleRate = this.audioContext?.sampleRate ?? 44100;
        const binSize = sampleRate / (this.analyser.fftSize);
        const frequency = maxIndex * binSize;

        this.emit('input:audio:frequency', {
          frequency,
          level: normalizedLevel,
        });
      }
    }
  }

  reset(): void {
    // Audio resources are kept alive across resets — only game state resets
    this.isActive = !!this.analyser;
  }

  destroy(): void {
    this.isActive = false;

    // Stop microphone stream tracks
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      void this.audioContext.close();
    }
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;

    super.destroy();
  }
}
