import { describe, it, expect } from 'vitest';
import {
  validateCommand,
  validateParamValue,
  validateSequence,
} from '../validators';
import type { Command, ParamSpec } from '../types';

// ── validateParamValue ──

describe('validateParamValue', () => {
  it('accepts number within range', () => {
    const spec: ParamSpec = { name: 'speed', type: 'number', min: 0, max: 100 };
    expect(validateParamValue(spec, 50).valid).toBe(true);
  });

  it('rejects number below min', () => {
    const spec: ParamSpec = { name: 'speed', type: 'number', min: 0, max: 100 };
    const r = validateParamValue(spec, -5);
    expect(r.valid).toBe(false);
    expect(r.errors[0].message).toMatch(/min/i);
  });

  it('rejects number above max', () => {
    const spec: ParamSpec = { name: 'speed', type: 'number', min: 0, max: 100 };
    const r = validateParamValue(spec, 200);
    expect(r.valid).toBe(false);
    expect(r.errors[0].message).toMatch(/max/i);
  });

  it('rejects wrong type for number', () => {
    const spec: ParamSpec = { name: 'speed', type: 'number' };
    const r = validateParamValue(spec, 'fast');
    expect(r.valid).toBe(false);
    expect(r.errors[0].message).toMatch(/type/i);
  });

  it('accepts valid string', () => {
    const spec: ParamSpec = { name: 'label', type: 'string' };
    expect(validateParamValue(spec, 'hello').valid).toBe(true);
  });

  it('rejects non-string for string type', () => {
    const spec: ParamSpec = { name: 'label', type: 'string' };
    expect(validateParamValue(spec, 42).valid).toBe(false);
  });

  it('accepts valid boolean', () => {
    const spec: ParamSpec = { name: 'active', type: 'boolean' };
    expect(validateParamValue(spec, true).valid).toBe(true);
  });

  it('accepts valid enum value', () => {
    const spec: ParamSpec = { name: 'dir', type: 'enum', enumValues: ['up', 'down', 'left'] };
    expect(validateParamValue(spec, 'up').valid).toBe(true);
  });

  it('rejects invalid enum value', () => {
    const spec: ParamSpec = { name: 'dir', type: 'enum', enumValues: ['up', 'down', 'left'] };
    const r = validateParamValue(spec, 'diagonal');
    expect(r.valid).toBe(false);
    expect(r.errors[0].message).toMatch(/enum/i);
  });

  it('accepts vec2 with x and y', () => {
    const spec: ParamSpec = { name: 'pos', type: 'vec2' };
    expect(validateParamValue(spec, { x: 10, y: 20 }).valid).toBe(true);
  });

  it('rejects vec2 missing y', () => {
    const spec: ParamSpec = { name: 'pos', type: 'vec2' };
    expect(validateParamValue(spec, { x: 10 }).valid).toBe(false);
  });

  it('accepts color string', () => {
    const spec: ParamSpec = { name: 'bg', type: 'color' };
    expect(validateParamValue(spec, '#FF0000').valid).toBe(true);
  });

  it('accepts assetId string', () => {
    const spec: ParamSpec = { name: 'sprite', type: 'assetId' };
    expect(validateParamValue(spec, 'player_sprite').valid).toBe(true);
  });
});

// ── validateCommand ──

describe('validateCommand', () => {
  it('validates addModule with type and id', () => {
    const cmd: Command = { name: 'addModule', args: { type: 'Spawner', id: 'Spawner_1', params: {} } };
    expect(validateCommand(cmd).valid).toBe(true);
  });

  it('rejects addModule without type', () => {
    const cmd: Command = { name: 'addModule', args: { id: 'Spawner_1' } };
    const r = validateCommand(cmd);
    expect(r.valid).toBe(false);
    expect(r.errors[0].field).toBe('type');
  });

  it('rejects addModule without id', () => {
    const cmd: Command = { name: 'addModule', args: { type: 'Spawner' } };
    const r = validateCommand(cmd);
    expect(r.valid).toBe(false);
    expect(r.errors[0].field).toBe('id');
  });

  it('validates removeModule with id', () => {
    const cmd: Command = { name: 'removeModule', args: { id: 'Spawner_1' } };
    expect(validateCommand(cmd).valid).toBe(true);
  });

  it('rejects removeModule without id', () => {
    const cmd: Command = { name: 'removeModule', args: {} };
    expect(validateCommand(cmd).valid).toBe(false);
  });

  it('validates setParam with moduleId, param, value', () => {
    const cmd: Command = { name: 'setParam', args: { moduleId: 'Spawner_1', param: 'speed', value: 5 } };
    expect(validateCommand(cmd).valid).toBe(true);
  });

  it('rejects setParam without param name', () => {
    const cmd: Command = { name: 'setParam', args: { moduleId: 'Spawner_1', value: 5 } };
    expect(validateCommand(cmd).valid).toBe(false);
  });

  it('validates batchSetParams with moduleId and params object', () => {
    const cmd: Command = { name: 'batchSetParams', args: { moduleId: 'Spawner_1', params: { speed: 5, count: 10 } } };
    expect(validateCommand(cmd).valid).toBe(true);
  });

  it('rejects batchSetParams with non-object params', () => {
    const cmd: Command = { name: 'batchSetParams', args: { moduleId: 'Spawner_1', params: 'bad' } };
    expect(validateCommand(cmd).valid).toBe(false);
  });

  it('validates addAsset with assetId and entry', () => {
    const cmd: Command = { name: 'addAsset', args: { assetId: 'bg_1', type: 'sprite', src: 'img.png' } };
    expect(validateCommand(cmd).valid).toBe(true);
  });

  it('rejects addAsset without src', () => {
    const cmd: Command = { name: 'addAsset', args: { assetId: 'bg_1', type: 'sprite' } };
    expect(validateCommand(cmd).valid).toBe(false);
  });

  it('validates setMeta with at least one field', () => {
    const cmd: Command = { name: 'setMeta', args: { name: 'My Game' } };
    expect(validateCommand(cmd).valid).toBe(true);
  });

  it('rejects setMeta with empty args', () => {
    const cmd: Command = { name: 'setMeta', args: {} };
    expect(validateCommand(cmd).valid).toBe(false);
  });

  it('validates configureCanvas with width and height', () => {
    const cmd: Command = { name: 'configureCanvas', args: { width: 1080, height: 1920 } };
    expect(validateCommand(cmd).valid).toBe(true);
  });

  it('rejects configureCanvas without height', () => {
    const cmd: Command = { name: 'configureCanvas', args: { width: 1080 } };
    expect(validateCommand(cmd).valid).toBe(false);
  });

  it('validates enableModule with id', () => {
    const cmd: Command = { name: 'enableModule', args: { id: 'Timer_1' } };
    expect(validateCommand(cmd).valid).toBe(true);
  });

  it('validates disableModule with id', () => {
    const cmd: Command = { name: 'disableModule', args: { id: 'Timer_1' } };
    expect(validateCommand(cmd).valid).toBe(true);
  });

  it('validates duplicateModule with sourceId and newId', () => {
    const cmd: Command = { name: 'duplicateModule', args: { sourceId: 'Spawner_1', newId: 'Spawner_2' } };
    expect(validateCommand(cmd).valid).toBe(true);
  });

  it('rejects duplicateModule without newId', () => {
    const cmd: Command = { name: 'duplicateModule', args: { sourceId: 'Spawner_1' } };
    expect(validateCommand(cmd).valid).toBe(false);
  });
});

// ── validateSequence ──

describe('validateSequence', () => {
  it('returns valid for a correct sequence', () => {
    const r = validateSequence({
      id: 'test-seq',
      commands: [
        { name: 'addModule', args: { type: 'Spawner', id: 'Spawner_1', params: {} } },
        { name: 'setParam', args: { moduleId: 'Spawner_1', param: 'speed', value: 3 } },
      ],
    });
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('collects errors from multiple invalid commands', () => {
    const r = validateSequence({
      id: 'bad-seq',
      commands: [
        { name: 'addModule', args: {} },
        { name: 'removeModule', args: {} },
      ],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('returns valid for empty command list', () => {
    const r = validateSequence({ id: 'empty', commands: [] });
    expect(r.valid).toBe(true);
  });
});
