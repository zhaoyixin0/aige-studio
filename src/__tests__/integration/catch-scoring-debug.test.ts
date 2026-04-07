import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core/engine';
import { AutoWirer } from '@/engine/core/auto-wirer';
import { Spawner } from '@/engine/modules/mechanic/spawner';
import { Collision } from '@/engine/modules/mechanic/collision';
import { PlayerMovement } from '@/engine/modules/mechanic/player-movement';
import { Scorer } from '@/engine/modules/mechanic/scorer';
import { getGamePreset } from '@/agent/game-presets';

describe('Catch game full collision→scoring', () => {
  it('should emit collision:hit when player overlaps spawned item', () => {
    const preset = getGamePreset('catch')!;
    const engine = new Engine();
    engine.loadConfig({
      version: '1.0.0',
      meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
      canvas: { width: 1080, height: 1920 },
      modules: [],
      assets: {},
    });

    const pm = new PlayerMovement('pm_1', preset['PlayerMovement'] as Record<string, unknown>);
    const spawner = new Spawner('spawner_1', preset['Spawner'] as Record<string, unknown>);
    const collision = new Collision('collision_1', preset['Collision'] as Record<string, unknown>);
    const scorer = new Scorer('scorer_1', preset['Scorer'] as Record<string, unknown>);

    engine.addModule(pm);
    engine.addModule(spawner);
    engine.addModule(collision);
    engine.addModule(scorer);
    AutoWirer.wire(engine);

    // Verify player is registered
    const playerObj = (collision as any).objects.get('player_1');
    expect(playerObj).toBeDefined();
    expect(playerObj.layer).toBe('player');

    // Unpause
    engine.eventBus.emit('gameflow:resume');

    // Run frames to let spawner create items
    for (let i = 0; i < 200; i++) engine.tick(16);

    // Find an items-layer collision object (not obstacles-layer).
    // The catch preset has bad_1 items on the 'obstacles' layer — those emit
    // collision:damage, not collision:hit, so we must target an 'items'-layer object.
    const collisionEntries = [...(collision as any).objects.entries()] as
      Array<[string, { layer: string; x: number; y: number }]>;
    const itemEntry = collisionEntries.find(([, obj]) => obj.layer === 'items');
    expect(itemEntry).toBeDefined();

    const [itemId] = itemEntry!;

    // Find the matching spawner object so we set pm to its CURRENT position
    // (the pre-update hook will sync both sides on the next tick)
    const matchingSpawnObj = spawner.getObjects().find((o) => o.id === itemId);
    expect(matchingSpawnObj).toBeDefined();

    // Move player directly on top of this items-layer object
    (pm as any).x = matchingSpawnObj!.x;
    (pm as any).y = matchingSpawnObj!.y;

    const hitHandler = vi.fn();
    engine.eventBus.on('collision:hit', hitHandler);

    // One more frame — collision should detect overlap
    engine.tick(16);

    expect(hitHandler).toHaveBeenCalled();
    expect(scorer.getScore()).toBeGreaterThan(0);

    engine.restart();
  });
});
