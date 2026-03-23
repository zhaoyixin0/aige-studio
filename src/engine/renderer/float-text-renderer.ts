import { Container, Text, TextStyle } from 'pixi.js';

interface FloatText {
  text: Text;
  life: number;
  maxLife: number;
  vy: number;
}

export class FloatTextRenderer {
  private container: Container;
  private texts: FloatText[] = [];
  private static readonly DRIFT_SPEED = -40; // px/s (upward)
  private static readonly LIFETIME = 1; // seconds

  constructor(parent: Container) {
    this.container = new Container();
    parent.addChild(this.container);
  }

  spawn(x: number, y: number, message: string, color = 0xffffff): void {
    const style = new TextStyle({
      fontSize: 24,
      fontWeight: 'bold',
      fill: color,
      stroke: { color: 0x000000, width: 3 },
    });
    const text = new Text({ text: message, style });
    text.anchor.set(0.5);
    text.x = x;
    text.y = y;
    this.container.addChild(text);
    this.texts.push({
      text,
      life: 0,
      maxLife: FloatTextRenderer.LIFETIME,
      vy: FloatTextRenderer.DRIFT_SPEED,
    });
  }

  update(dt: number): void {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const ft = this.texts[i];
      ft.life += dt;
      if (ft.life >= ft.maxLife) {
        this.container.removeChild(ft.text);
        ft.text.destroy();
        this.texts.splice(i, 1);
        continue;
      }
      ft.text.y += ft.vy * dt;
      ft.text.alpha = 1 - ft.life / ft.maxLife;
    }
  }

  destroy(): void {
    for (const ft of this.texts) {
      this.container.removeChild(ft.text);
      ft.text.destroy();
    }
    this.texts = [];
    this.container.destroy();
  }
}
