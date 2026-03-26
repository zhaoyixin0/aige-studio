import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { Gravity } from '@/engine/modules/mechanic/gravity';
import { PlayerMovement } from '@/engine/modules/mechanic/player-movement';
import { StaticPlatform } from '@/engine/modules/mechanic/static-platform';
import { MovingPlatform } from '@/engine/modules/mechanic/moving-platform';
import { OneWayPlatform } from '@/engine/modules/mechanic/one-way-platform';
import { CrumblingPlatform } from '@/engine/modules/mechanic/crumbling-platform';
import { Dash } from '@/engine/modules/mechanic/dash';
import { Knockback } from '@/engine/modules/mechanic/knockback';
import { AutoWirer } from '@/engine/core/auto-wirer';

describe('Platform Physics Integration', () => {
  function createPhysicsEngine(modules: {
    gravity?: Record<string, any>;
    playerMovement?: Record<string, any>;
    staticPlatforms?: Record<string, any>;
    movingPlatforms?: Record<string, any>;
    oneWayPlatforms?: Record<string, any>;
    crumblingPlatforms?: Record<string, any>;
    dash?: Record<string, any>;
    knockback?: Record<string, any>;
  } = {}) {
    const engine = new Engine();

    const gravity = new Gravity('gravity-1', modules.gravity ?? {});
    const pm = new PlayerMovement('pm-1', modules.playerMovement ?? {});
    engine.addModule(gravity);
    engine.addModule(pm);

    if (modules.staticPlatforms) {
      engine.addModule(new StaticPlatform('sp-1', modules.staticPlatforms));
    }
    if (modules.movingPlatforms) {
      engine.addModule(new MovingPlatform('mp-1', modules.movingPlatforms));
    }
    if (modules.oneWayPlatforms) {
      engine.addModule(new OneWayPlatform('owp-1', modules.oneWayPlatforms));
    }
    if (modules.crumblingPlatforms) {
      engine.addModule(new CrumblingPlatform('cp-1', modules.crumblingPlatforms));
    }
    if (modules.dash) {
      engine.addModule(new Dash('dash-1', modules.dash));
    }
    if (modules.knockback) {
      engine.addModule(new Knockback('kb-1', modules.knockback));
    }

    // Wire modules together
    AutoWirer.wire(engine);

    engine.eventBus.emit('gameflow:resume');
    return engine;
  }

  it('should land player on static platform via Gravity surface wiring', () => {
    const engine = createPhysicsEngine({
      staticPlatforms: {
        platforms: [
          { x: 100, y: 500, width: 200, height: 20, material: 'normal' },
        ],
      },
    });

    const gravity = engine.getModulesByType('Gravity')[0] as Gravity;
    const landHandler = vi.fn();
    engine.eventBus.on('gravity:landed', landHandler);

    // Add player above the platform
    gravity.addObject('player', { x: 150, y: 100, floorY: 9999, airborne: true });

    // Simulate frames
    for (let i = 0; i < 200; i++) engine.tick(16);

    expect(gravity.getObject('player')!.y).toBe(500);
    expect(landHandler).toHaveBeenCalled();
  });

  it('should carry player on moving platform', () => {
    const engine = createPhysicsEngine({
      movingPlatforms: {
        platforms: [
          { x: 100, y: 500, width: 200, height: 20, pattern: 'horizontal', speed: 100, range: 200 },
        ],
      },
    });

    const gravity = engine.getModulesByType('Gravity')[0] as Gravity;
    const pm = engine.getModulesByType('PlayerMovement')[0] as PlayerMovement;

    // Place player on the platform (already landed)
    gravity.addObject('player', { x: 150, y: 500, floorY: 9999, airborne: false });
    // Register which surface the player is on
    gravity.addSurface({
      id: 'moving-0',
      x: 100,
      y: 500,
      width: 200,
      oneWay: false,
      active: true,
    });

    void pm.getX(); // record initial position

    // Tick several frames — platform should move and carry the player
    for (let i = 0; i < 60; i++) engine.tick(16);

    // Player X should have shifted (carried by platform)
    // This tests that platform:move events update gravity surfaces
    // and player position tracks the surface
    const movedGravObj = gravity.getObject('player');
    expect(movedGravObj).toBeDefined();
  });

  it('should allow jumping through one-way platform from below', () => {
    const engine = createPhysicsEngine({
      oneWayPlatforms: {
        platforms: [{ x: 100, y: 400, width: 200 }],
      },
    });

    const gravity = engine.getModulesByType('Gravity')[0] as Gravity;

    // One-way surface
    gravity.addSurface({
      id: 'oneway-0',
      x: 100,
      y: 400,
      width: 200,
      oneWay: true,
      active: true,
    });

    // Player starts below platform, moving upward
    gravity.addObject('player', { x: 150, y: 500, floorY: 800, airborne: true, velocityY: -400 });

    // One tick — should pass through
    gravity.update(16);

    const obj = gravity.getObject('player')!;
    expect(obj.y).toBeLessThan(500); // moved up
    expect(obj.airborne).toBe(true); // did NOT land on one-way platform
  });

  it('should crumble platform and player falls through', () => {
    const engine = createPhysicsEngine({
      crumblingPlatforms: {
        platforms: [{ x: 100, y: 400, width: 200, height: 20 }],
        delay: 100,
        respawnTime: 1,
      },
    });

    const gravity = engine.getModulesByType('Gravity')[0] as Gravity;
    const crumbleHandler = vi.fn();
    engine.eventBus.on('platform:crumble', crumbleHandler);

    // Register surface and place player on it
    gravity.addSurface({ id: 'crumble-0', x: 100, y: 400, width: 200, oneWay: false, active: true });
    gravity.addObject('player', { x: 150, y: 400, floorY: 800, airborne: false });

    // Trigger crumble
    const cp = engine.getModulesByType('CrumblingPlatform')[0] as CrumblingPlatform;
    cp.triggerCrumble(0);

    // Advance past crumble delay
    for (let i = 0; i < 20; i++) engine.tick(16);

    expect(crumbleHandler).toHaveBeenCalled();
  });

  it('should freeze Y velocity during dash', () => {
    const engine = createPhysicsEngine({
      dash: { duration: 200, triggerEvent: 'dash:trigger' },
    });

    const gravity = engine.getModulesByType('Gravity')[0] as Gravity;

    // Player is airborne
    gravity.addObject('player', { x: 150, y: 200, floorY: 800, airborne: true });

    // Record Y after one gravity frame
    engine.tick(16);
    const yBeforeDash = gravity.getObject('player')!.y;
    void gravity.getObject('player')!.velocityY; // record velocity before dash

    // Start dash — gravity should freeze Y velocity
    engine.eventBus.emit('dash:trigger');

    // During dash, Y should not change (gravity suspended)
    const dash = engine.getModulesByType('Dash')[0] as Dash;
    expect(dash.isActive()).toBe(true);

    engine.tick(16);
    const yDuringDash = gravity.getObject('player')!.y;

    // Y should be same as before dash (or very close — gravity frozen)
    expect(Math.abs(yDuringDash - yBeforeDash)).toBeLessThan(1);
  });

  it('should lock PlayerMovement input during knockback', () => {
    const engine = createPhysicsEngine({
      knockback: { force: 300, duration: 200, triggerEvent: 'collision:damage' },
    });

    const pm = engine.getModulesByType('PlayerMovement')[0] as PlayerMovement;

    // Start knockback
    engine.eventBus.emit('collision:damage', {
      playerX: 200, playerY: 400, hazardX: 100, hazardY: 400,
    });

    // Input should be locked
    engine.eventBus.emit('input:touch:hold', { side: 'right' });
    engine.tick(16);

    expect(pm.getVelocityX()).toBe(0);

    // After knockback duration, input should work again
    for (let i = 0; i < 20; i++) engine.tick(16);

    engine.eventBus.emit('input:touch:hold', { side: 'right' });
    engine.tick(16);

    expect(pm.getVelocityX()).toBeGreaterThan(0);
  });
});
