import { ease } from './easings';
import { sampleBezierPath } from './bezier';
import type { TweenClip, TweenState, TweenProperty } from './types';

export interface TweenUpdateResult {
  readonly entityId: string;
  readonly properties: Readonly<Partial<Record<TweenProperty, number>>>;
}

type EventEmitter = (event: string, data: Record<string, unknown>) => void;

/** Internal mutable tween instance — not exposed to consumers */
interface TweenInstance {
  readonly clipId: string;
  readonly entityId: string;
  elapsed: number;
  loopsRemaining: number;
  direction: 1 | -1;
  state: TweenState;
  delayRemaining: number;
}

interface ActiveTween {
  clip: TweenClip;
  instance: TweenInstance;
}

export class TweenSystem {
  private readonly tweens: ActiveTween[] = [];
  private readonly emit: EventEmitter;

  constructor(emit: EventEmitter) {
    this.emit = emit;
  }

  start(clip: TweenClip, entityId: string): void {
    const delay = clip.delay ?? 0;
    const loopsRemaining = clip.loop === 'infinite' ? Infinity
      : typeof clip.loop === 'number' ? clip.loop
      : 1;

    const instance: TweenInstance = {
      clipId: clip.id,
      entityId,
      elapsed: 0,
      loopsRemaining,
      direction: 1,
      state: delay > 0 ? 'delayed' : 'playing',
      delayRemaining: delay,
    };

    this.tweens.push({ clip, instance });

    if (instance.state === 'playing') {
      this.emit('tween:start', { entityId, clipId: clip.id });
    }
  }

  update(dt: number): TweenUpdateResult[] {
    const results: TweenUpdateResult[] = [];
    const completed: number[] = [];

    for (let i = 0; i < this.tweens.length; i++) {
      const { clip, instance } = this.tweens[i];

      // Handle delay phase
      if (instance.state === 'delayed') {
        instance.delayRemaining -= dt;
        if (instance.delayRemaining > 0) continue;
        // Overflow dt into play phase
        const overflow = -instance.delayRemaining;
        instance.delayRemaining = 0;
        instance.state = 'playing';
        this.emit('tween:start', { entityId: instance.entityId, clipId: clip.id });
        if (overflow > 0) {
          const result = this.advancePlaying(clip, instance, overflow);
          if (result) results.push(result);
          if ((instance.state as string) === 'completed') completed.push(i);
        }
        continue;
      }

      if (instance.state !== 'playing') continue;

      const result = this.advancePlaying(clip, instance, dt);
      if (result) results.push(result);
      if ((instance.state as string) === 'completed') completed.push(i);
    }

    // Remove completed tweens in reverse order
    for (let i = completed.length - 1; i >= 0; i--) {
      this.tweens.splice(completed[i], 1);
    }

    return results;
  }

  stop(entityId: string, clipId: string): void {
    const idx = this.tweens.findIndex(
      (t) => t.instance.entityId === entityId && t.instance.clipId === clipId,
    );
    if (idx !== -1) this.tweens.splice(idx, 1);
  }

  stopAll(entityId: string): void {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      if (this.tweens[i].instance.entityId === entityId) {
        this.tweens.splice(i, 1);
      }
    }
  }

  clear(): void {
    this.tweens.length = 0;
  }

  getActiveCount(): number {
    return this.tweens.length;
  }

  private advancePlaying(clip: TweenClip, inst: TweenInstance, dt: number): TweenUpdateResult | null {
    const timeScale = clip.timeScale ?? 1;
    inst.elapsed += dt * timeScale * inst.direction;

    // Check for loop/completion boundaries
    if (inst.elapsed >= clip.duration) {
      inst.loopsRemaining--;

      if (inst.loopsRemaining <= 0) {
        inst.elapsed = clip.duration;
        inst.state = 'completed';
        this.emitComplete(clip, inst);
        return this.sample(clip, inst, 1);
      }

      if (clip.pingPong) {
        inst.direction = -1 as 1 | -1;
        inst.elapsed = clip.duration - (inst.elapsed - clip.duration);
      } else {
        inst.elapsed -= clip.duration;
      }
    } else if (inst.elapsed <= 0 && inst.direction === -1) {
      // PingPong reverse reached start
      inst.loopsRemaining--;

      if (inst.loopsRemaining <= 0) {
        inst.elapsed = 0;
        inst.state = 'completed';
        this.emitComplete(clip, inst);
        return this.sample(clip, inst, 0);
      }

      inst.direction = 1;
      inst.elapsed = -inst.elapsed;
    }

    const t = Math.max(0, Math.min(1, inst.elapsed / clip.duration));
    return this.sample(clip, inst, t);
  }

  private sample(clip: TweenClip, inst: TweenInstance, t: number): TweenUpdateResult {
    const properties: Partial<Record<TweenProperty, number>> = {};

    for (const track of clip.tracks) {
      const eased = ease(track.easing, t);

      if (track.bezierPath && track.bezierPath.points.length >= 2) {
        const point = sampleBezierPath(track.bezierPath.points, eased);
        properties.x = point.x;
        properties.y = point.y;
      } else {
        properties[track.property] = track.from + (track.to - track.from) * eased;
      }
    }

    return { entityId: inst.entityId, properties };
  }

  private emitComplete(clip: TweenClip, inst: TweenInstance): void {
    this.emit('tween:complete', {
      entityId: inst.entityId,
      clipId: clip.id,
    });

    if (clip.onComplete?.eventName) {
      this.emit(clip.onComplete.eventName, {
        entityId: inst.entityId,
      });
    }
  }
}
