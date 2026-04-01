import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export interface GravityObject {
  id: string;
  x: number;
  y: number;
  velocityY: number;
  floorY: number;
  airborne: boolean;
  /** Whether gravity:falling has been emitted for the current airborne phase */
  fallingEmitted?: boolean;
  /** ID of the surface the object is currently standing on */
  currentSurfaceId?: string;
}

export interface PlatformSurface {
  id: string;
  x: number;
  y: number;
  width: number;
  oneWay: boolean;
  active: boolean;
}

export class Gravity extends BaseModule {
  readonly type = 'Gravity';

  private objects = new Map<string, GravityObject>();
  private surfaces = new Map<string, PlatformSurface>();
  private enabled = true;
  private frozen = false;
  private lastDt = 0.016;

  getSchema(): ModuleSchema {
    return {
      strength: {
        type: 'range',
        label: 'Gravity Strength',
        default: 980,
        min: 200,
        max: 2000,
        step: 10,
      },
      terminalVelocity: {
        type: 'range',
        label: 'Terminal Velocity',
        default: 800,
        min: 100,
        max: 2000,
        step: 10,
      },
      applyTo: {
        type: 'select',
        label: 'Apply To',
        default: 'player',
        options: ['player', 'items', 'all'],
      },
      toggleEvent: {
        type: 'string',
        label: 'Toggle Event',
        default: '',
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on('jump:start', (data?: any) => {
      if (data?.id) {
        const obj = this.objects.get(data.id);
        if (obj) {
          this.objects.set(data.id, {
            ...obj,
            airborne: true,
            fallingEmitted: false,
            currentSurfaceId: undefined,
          });
        }
      }
    });

    this.on('dash:start', () => {
      this.frozen = true;
    });

    this.on('dash:end', () => {
      this.frozen = false;
    });

    const toggleEvent = this.params.toggleEvent;
    if (toggleEvent) {
      this.on(toggleEvent, () => {
        this.enabled = !this.enabled;
      });
    }
  }

  // ── Object API ──

  addObject(
    id: string,
    opts: { x: number; y: number; floorY: number; airborne: boolean; velocityY?: number },
  ): void {
    this.objects.set(id, {
      id,
      x: opts.x,
      y: opts.y,
      velocityY: opts.velocityY ?? 0,
      floorY: opts.floorY,
      airborne: opts.airborne,
    });
  }

  getObject(id: string): GravityObject | undefined {
    return this.objects.get(id);
  }

  removeObject(id: string): void {
    this.objects.delete(id);
  }

  // ── Surface API ──

  addSurface(surface: PlatformSurface): void {
    this.surfaces.set(surface.id, { ...surface });
  }

  updateSurface(id: string, updates: Partial<PlatformSurface>): void {
    const existing = this.surfaces.get(id);
    if (!existing) return;
    this.surfaces.set(id, { ...existing, ...updates });
  }

  removeSurface(id: string): void {
    this.surfaces.delete(id);
  }

  getSurfaces(): PlatformSurface[] {
    return [...this.surfaces.values()];
  }

  /**
   * Check if an object is no longer on its current surface and mark airborne if so.
   * Call this after a surface is removed, deactivated, or the object has moved.
   */
  checkSurfaceDeparture(objId: string): void {
    const obj = this.objects.get(objId);
    if (!obj || obj.airborne) return;

    const surfaceId = obj.currentSurfaceId;
    if (surfaceId) {
      const surface = this.surfaces.get(surfaceId);
      if (!surface || !surface.active || !this.isOnSurface(obj, surface)) {
        this.objects.set(objId, {
          ...obj,
          airborne: true,
          fallingEmitted: false,
          currentSurfaceId: undefined,
        });
      }
    } else {
      // Object has no tracked surface — check if still on any surface
      const resolved = this.findSurface(obj);
      if (!resolved) {
        this.objects.set(objId, {
          ...obj,
          airborne: true,
          fallingEmitted: false,
        });
      }
    }
  }

  // ── Physics ──

  reset(): void {
    this.objects.clear();
    this.surfaces.clear();
    this.enabled = true;
    this.frozen = false;
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;
    if (!this.enabled) return;

    const strength = this.params.strength ?? 980;
    const terminalVelocity = this.params.terminalVelocity ?? 800;
    const dtSec = dt / 1000;
    this.lastDt = dtSec;

    for (const obj of this.objects.values()) {
      if (!obj.airborne) continue;

      let updated = obj;

      // Emit falling event only on the first frame of being airborne
      if (!updated.fallingEmitted) {
        updated = { ...updated, fallingEmitted: true };
        this.emit('gravity:falling', { id: updated.id });
      }

      // Skip physics when frozen (e.g., during dash)
      if (this.frozen) {
        if (updated !== obj) this.objects.set(updated.id, updated);
        continue;
      }

      // Apply gravity acceleration
      let newVelocityY = updated.velocityY + strength * dtSec;

      // Cap at terminal velocity
      if (newVelocityY > terminalVelocity) {
        newVelocityY = terminalVelocity;
      }

      // Update position
      const newY = updated.y + newVelocityY * dtSec;
      updated = { ...updated, velocityY: newVelocityY, y: newY };

      // Check for landing on surfaces first, then fallback to floorY
      const resolvedFloor = this.resolveFloorY(updated);

      if (updated.y >= resolvedFloor.y) {
        updated = {
          ...updated,
          y: resolvedFloor.y,
          velocityY: 0,
          airborne: false,
          fallingEmitted: false,
          currentSurfaceId: resolvedFloor.surfaceId,
        };
        this.objects.set(updated.id, updated);
        this.emit('gravity:landed', {
          id: updated.id,
          y: updated.y,
          surfaceId: resolvedFloor.surfaceId,
        });
      } else {
        this.objects.set(updated.id, updated);
      }
    }
  }

  /**
   * Find the highest valid surface or floorY below the object.
   */
  private resolveFloorY(obj: GravityObject): { y: number; surfaceId?: string } {
    let bestY = obj.floorY;
    let bestSurfaceId: string | undefined;

    // Use actual dt for previous-frame position estimate instead of hardcoded 0.016
    const dt = this.lastDt;
    const displacement = Math.abs(obj.velocityY * dt);
    // Landing tolerance: accounts for velocity-based displacement to prevent tunneling
    const tolerance = Math.max(2, displacement);

    for (const surface of this.surfaces.values()) {
      if (!surface.active) continue;

      // One-way surfaces: only land when falling (velocityY >= 0)
      if (surface.oneWay && obj.velocityY < 0) continue;

      // Object X must overlap surface horizontally
      if (!this.isXOverlapping(obj, surface)) continue;

      // Sweep check: surface.y must be between previous-frame Y and current Y
      // Previous Y estimate: obj.y - velocityY * dt
      const prevY = obj.y - obj.velocityY * dt;
      const surfaceReachable = surface.y >= prevY - tolerance && surface.y < bestY;

      if (surfaceReachable) {
        bestY = surface.y;
        bestSurfaceId = surface.id;
      }
    }

    return { y: bestY, surfaceId: bestSurfaceId };
  }

  private findSurface(obj: GravityObject): PlatformSurface | undefined {
    for (const surface of this.surfaces.values()) {
      if (!surface.active) continue;
      if (this.isOnSurface(obj, surface)) return surface;
    }
    return undefined;
  }

  private isOnSurface(obj: GravityObject, surface: PlatformSurface): boolean {
    return (
      this.isXOverlapping(obj, surface) &&
      Math.abs(obj.y - surface.y) < 2
    );
  }

  private isXOverlapping(obj: GravityObject, surface: PlatformSurface): boolean {
    return obj.x >= surface.x && obj.x <= surface.x + surface.width;
  }
}
