import { describe, it, expect } from 'vitest';
import {
  buildCapabilityIndex,
  type CapabilityIndex,
} from '../taxonomy/module-capabilities';

describe('Module Capability Digest', () => {
  let index: CapabilityIndex;

  beforeAll(async () => {
    index = await buildCapabilityIndex();
  });

  it('indexes all module files (>= 55)', () => {
    expect(Object.keys(index).length).toBeGreaterThanOrEqual(55);
  });

  it('every entry has at least one capability', () => {
    for (const [name, caps] of Object.entries(index)) {
      expect(caps.length, `${name} has no capabilities`).toBeGreaterThanOrEqual(1);
    }
  });

  it('Collision module has collisionProvider capability', () => {
    expect(index['Collision']).toBeDefined();
    expect(index['Collision']).toContain('collisionProvider');
  });

  it('Spawner module has spawnProvider capability', () => {
    expect(index['Spawner']).toBeDefined();
    expect(index['Spawner']).toContain('spawnProvider');
  });

  it('Health module has damageReceiver capability', () => {
    expect(index['Health']).toBeDefined();
    expect(index['Health']).toContain('damageReceiver');
  });

  it('PlayerMovement has playerPosition capability', () => {
    expect(index['PlayerMovement']).toBeDefined();
    expect(index['PlayerMovement']).toContain('playerPosition');
  });

  it('input modules have inputProvider capability', () => {
    for (const name of ['TouchInput', 'FaceInput', 'HandInput']) {
      expect(index[name]).toBeDefined();
      expect(index[name]).toContain('inputProvider');
    }
  });

  it('feedback modules have feedbackProvider capability', () => {
    for (const name of ['GameFlow', 'UIOverlay', 'ResultScreen']) {
      expect(index[name]).toBeDefined();
      expect(index[name]).toContain('feedbackProvider');
    }
  });

  it('no duplicate capabilities per module', () => {
    for (const [name, caps] of Object.entries(index)) {
      expect(new Set(caps).size, `${name} has duplicate caps`).toBe(caps.length);
    }
  });
});
