import type { EventBus } from '@/engine/core/event-bus';

export interface RecordedEvent {
  event: string;
  data: any;
  timestamp: number;
  listenerCount: number;
  frame: number;
}

/**
 * Records all events passing through an EventBus for later analysis.
 * Monkey-patches emit() — call detach() to restore.
 */
export class EventRecorder {
  private events: RecordedEvent[] = [];
  private originalEmit: EventBus['emit'] | null = null;
  private bus: EventBus | null = null;
  private startTime = 0;
  private frameCount = 0;

  attach(eventBus: EventBus): void {
    this.bus = eventBus;
    this.originalEmit = eventBus.emit.bind(eventBus);
    this.startTime = Date.now();
    this.frameCount = 0;
    this.events = [];

    const self = this;
    eventBus.emit = function (event: string, data?: any) {
      self.events.push({
        event,
        data: data !== undefined ? structuredClone(data) : undefined,
        timestamp: Date.now() - self.startTime,
        listenerCount: eventBus.getListenerCount(event),
        frame: self.frameCount,
      });
      self.originalEmit!.call(eventBus, event, data);
    };
  }

  detach(): void {
    if (this.bus && this.originalEmit) {
      this.bus.emit = this.originalEmit;
    }
    this.bus = null;
    this.originalEmit = null;
  }

  /** Call once per engine tick to track frame boundaries */
  tick(): void {
    this.frameCount++;
  }

  getEvents(): RecordedEvent[] {
    return this.events;
  }

  /** Events that were emitted with 0 listeners */
  getOrphaned(): Map<string, number> {
    const orphans = new Map<string, number>();
    for (const e of this.events) {
      if (e.listenerCount === 0) {
        orphans.set(e.event, (orphans.get(e.event) ?? 0) + 1);
      }
    }
    return orphans;
  }

  /** Check if event B was emitted after event A at least once */
  hasEventChain(eventA: string, eventB: string): boolean {
    let aFired = false;
    for (const e of this.events) {
      if (e.event === eventA) aFired = true;
      if (aFired && e.event === eventB) return true;
    }
    return false;
  }

  /** Count occurrences of an event */
  countEvent(event: string): number {
    return this.events.filter((e) => e.event === event).length;
  }

  /** Get events per frame (for storm detection) */
  getEventsPerFrame(): Map<number, number> {
    const perFrame = new Map<number, number>();
    for (const e of this.events) {
      perFrame.set(e.frame, (perFrame.get(e.frame) ?? 0) + 1);
    }
    return perFrame;
  }

  /** Get event frequency by name */
  getEventFrequency(): Map<string, number> {
    const freq = new Map<string, number>();
    for (const e of this.events) {
      freq.set(e.event, (freq.get(e.event) ?? 0) + 1);
    }
    return freq;
  }

  getDurationMs(): number {
    return Date.now() - this.startTime;
  }

  getFrameCount(): number {
    return this.frameCount;
  }

  clear(): void {
    this.events = [];
    this.frameCount = 0;
    this.startTime = Date.now();
  }
}
