import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Checkpoint } from '../mechanic/checkpoint';

describe('Checkpoint', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const checkpoint = new Checkpoint('checkpoint-1', params);
    engine.addModule(checkpoint);
    return { engine, checkpoint };
  }

  it('should have correct default schema values', () => {
    const checkpoint = new Checkpoint('checkpoint-1');
    const params = checkpoint.getParams();

    // BaseModule spreads object defaults with { ...default }, so [] becomes {}
    expect(params.checkpoints).toEqual({});
    expect(params.layer).toBe('checkpoints');
    expect(params.asset).toBe('');
    expect(params.activeAsset).toBe('');
  });

  it('should activate a checkpoint on call', () => {
    const { engine, checkpoint } = setup({
      checkpoints: [
        { x: 100, y: 200, width: 32, height: 32 },
        { x: 300, y: 400, width: 32, height: 32 },
      ],
    });

    const activateHandler = vi.fn();
    engine.eventBus.on('checkpoint:activate', activateHandler);

    checkpoint.activate(0);

    expect(checkpoint.isActivated(0)).toBe(true);
    expect(activateHandler).toHaveBeenCalledOnce();
    expect(activateHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'checkpoint-0',
        index: 0,
        x: 100,
        y: 200,
      }),
    );
  });

  it('should return last activated respawn point', () => {
    const { checkpoint } = setup({
      checkpoints: [
        { x: 100, y: 200, width: 32, height: 32 },
        { x: 300, y: 400, width: 32, height: 32 },
      ],
    });

    checkpoint.activate(0);
    checkpoint.activate(1);

    const point = checkpoint.getRespawnPoint();
    expect(point).toEqual({ x: 300, y: 400 });
  });

  it('should emit checkpoint:respawn on lives:zero', () => {
    const { engine, checkpoint } = setup({
      checkpoints: [
        { x: 100, y: 200, width: 32, height: 32 },
      ],
    });

    checkpoint.activate(0);

    const respawnHandler = vi.fn();
    engine.eventBus.on('checkpoint:respawn', respawnHandler);

    engine.eventBus.emit('lives:zero');

    expect(respawnHandler).toHaveBeenCalledOnce();
    expect(respawnHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'checkpoint-0',
        x: 100,
        y: 200,
      }),
    );
  });

  it('should return null respawn point if none activated', () => {
    const { checkpoint } = setup({
      checkpoints: [
        { x: 100, y: 200, width: 32, height: 32 },
      ],
    });

    expect(checkpoint.getRespawnPoint()).toBeNull();
  });

  it('should not re-activate an already activated checkpoint', () => {
    const { engine, checkpoint } = setup({
      checkpoints: [
        { x: 100, y: 200, width: 32, height: 32 },
      ],
    });

    const activateHandler = vi.fn();
    engine.eventBus.on('checkpoint:activate', activateHandler);

    checkpoint.activate(0);
    checkpoint.activate(0);

    expect(activateHandler).toHaveBeenCalledOnce();
  });

  it('should reset activated set and lastActivated', () => {
    const { checkpoint } = setup({
      checkpoints: [
        { x: 100, y: 200, width: 32, height: 32 },
        { x: 300, y: 400, width: 32, height: 32 },
      ],
    });

    checkpoint.activate(0);
    checkpoint.activate(1);

    checkpoint.reset();

    expect(checkpoint.isActivated(0)).toBe(false);
    expect(checkpoint.isActivated(1)).toBe(false);
    expect(checkpoint.getRespawnPoint()).toBeNull();
  });
});
