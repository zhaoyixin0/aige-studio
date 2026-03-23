import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { BeatMap } from '../mechanic/beat-map';

describe('BeatMap', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const beatMap = new BeatMap('beat-1', params);
    engine.addModule(beatMap);
    return { engine, beatMap };
  }

  it('should generate beats from BPM when no explicit beats given', () => {
    const { beatMap } = setup({ bpm: 120 });
    beatMap.start();

    const beats = beatMap.getBeats();
    expect(beats.length).toBe(32);
    // At 120 BPM, interval is 500ms
    expect(beats[0]).toBe(500);
    expect(beats[1]).toBe(1000);
  });

  it('should use explicit beats when provided', () => {
    const { beatMap } = setup({ beats: [100, 300, 500] });
    beatMap.start();

    const beats = beatMap.getBeats();
    expect(beats).toEqual([100, 300, 500]);
  });

  it('should emit beat:hit when input matches a beat within tolerance', () => {
    const { engine, beatMap } = setup({
      beats: [500],
      tolerance: 200,
    });
    const hitHandler = vi.fn();
    engine.eventBus.on('beat:hit', hitHandler);

    beatMap.start();

    // Advance time to 450ms then tap
    beatMap.update(450);
    engine.eventBus.emit('input:touch:tap');
    beatMap.update(16); // process the input

    expect(hitHandler).toHaveBeenCalledWith(
      expect.objectContaining({ beatIndex: 0 }),
    );
  });

  it('should emit beat:miss when beat passes without input', () => {
    const { engine, beatMap } = setup({
      beats: [500],
      tolerance: 100,
    });
    const missHandler = vi.fn();
    engine.eventBus.on('beat:miss', missHandler);

    beatMap.start();

    // Advance past beat + tolerance
    beatMap.update(700);

    expect(missHandler).toHaveBeenCalledWith(
      expect.objectContaining({ beatIndex: 0, beatTime: 500 }),
    );
  });
});
