import type { EventHandler } from './types';

export class EventBus {
  private listeners = new Map<string, Set<EventHandler>>();

  on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit(event: string, data?: any): void {
    // Exact match listeners
    const exact = this.listeners.get(event);
    if (exact) {
      for (const handler of exact) {
        handler(data);
      }
    }

    // Wildcard listeners: check patterns ending with :*
    for (const [pattern, handlers] of this.listeners) {
      if (pattern === event) continue; // already handled above
      if (pattern.endsWith(':*')) {
        const prefix = pattern.slice(0, -1); // e.g. "collision:" from "collision:*"
        if (event.startsWith(prefix)) {
          for (const handler of handlers) {
            handler(data);
          }
        }
      }
    }
  }

  clear(event: string): void {
    this.listeners.delete(event);
  }

  clearAll(): void {
    this.listeners.clear();
  }
}
