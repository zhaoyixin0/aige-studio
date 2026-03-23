import { Container, Graphics } from 'pixi.js';

interface Particle {
  gfx: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export class ParticleRenderer {
  private container: Container;
  private particles: Particle[] = [];
  private static readonly GRAVITY = 200; // px/s²

  constructor(parent: Container) {
    this.container = new Container();
    parent.addChild(this.container);
  }

  burst(x: number, y: number, color: number, count = 12): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 80 + Math.random() * 120;
      const gfx = new Graphics();
      gfx.circle(0, 0, 3 + Math.random() * 3).fill({ color });
      gfx.x = x;
      gfx.y = y;
      this.container.addChild(gfx);
      this.particles.push({
        gfx,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.4,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.container.removeChild(p.gfx);
        p.gfx.destroy();
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += ParticleRenderer.GRAVITY * dt;
      p.gfx.x += p.vx * dt;
      p.gfx.y += p.vy * dt;
      p.gfx.alpha = 1 - p.life / p.maxLife;
    }
  }

  destroy(): void {
    for (const p of this.particles) {
      this.container.removeChild(p.gfx);
      p.gfx.destroy();
    }
    this.particles = [];
    this.container.destroy();
  }
}
