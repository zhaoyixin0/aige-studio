import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../event-bus';

describe('EventBus', () => {
  it('should emit and receive events', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('test', handler);
    bus.emit('test', { value: 42 });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ value: 42 });
  });

  it('should unsubscribe with off()', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('test', handler);
    bus.off('test', handler);
    bus.emit('test');

    expect(handler).not.toHaveBeenCalled();
  });

  it('should support wildcard listeners (collision:* matches collision:hit)', () => {
    const bus = new EventBus();
    const wildcardHandler = vi.fn();
    const exactHandler = vi.fn();

    bus.on('collision:*', wildcardHandler);
    bus.on('collision:hit', exactHandler);
    bus.emit('collision:hit', { id: 'a' });

    expect(wildcardHandler).toHaveBeenCalledOnce();
    expect(wildcardHandler).toHaveBeenCalledWith({ id: 'a' });
    expect(exactHandler).toHaveBeenCalledOnce();
    expect(exactHandler).toHaveBeenCalledWith({ id: 'a' });
  });

  it('should clear all listeners for a specific event', () => {
    const bus = new EventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const otherHandler = vi.fn();

    bus.on('test', handler1);
    bus.on('test', handler2);
    bus.on('other', otherHandler);

    bus.clear('test');
    bus.emit('test');
    bus.emit('other');

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
    expect(otherHandler).toHaveBeenCalledOnce();
  });

  it('should clearAll listeners', () => {
    const bus = new EventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bus.on('event1', handler1);
    bus.on('event2', handler2);

    bus.clearAll();
    bus.emit('event1');
    bus.emit('event2');

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  it('setDebug() should not crash', () => {
    const bus = new EventBus();
    expect(() => bus.setDebug(true)).not.toThrow();
    expect(() => bus.setDebug(false)).not.toThrow();
  });

  it('getListenerCount() should return correct count', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();

    expect(bus.getListenerCount('test')).toBe(0);

    bus.on('test', h1);
    expect(bus.getListenerCount('test')).toBe(1);

    bus.on('test', h2);
    expect(bus.getListenerCount('test')).toBe(2);

    bus.off('test', h1);
    expect(bus.getListenerCount('test')).toBe(1);

    bus.off('test', h2);
    expect(bus.getListenerCount('test')).toBe(0);
  });

  it('getRegisteredEvents() should return event names with listeners', () => {
    const bus = new EventBus();
    expect(bus.getRegisteredEvents()).toEqual([]);

    bus.on('alpha', vi.fn());
    bus.on('beta', vi.fn());
    bus.on('gamma', vi.fn());

    const events = bus.getRegisteredEvents();
    expect(events).toHaveLength(3);
    expect(events).toContain('alpha');
    expect(events).toContain('beta');
    expect(events).toContain('gamma');
  });
});
