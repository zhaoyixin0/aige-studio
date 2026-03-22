import { Container, Text, TextStyle } from 'pixi.js';
import type { Engine } from '@/engine/core/engine';
import type { UIOverlay } from '@/engine/modules/feedback/ui-overlay';

export class HudRenderer {
  private scoreText: Text;
  private timerText: Text;
  private livesText: Text;
  private comboText: Text;

  constructor(container: Container, width: number, height: number) {
    const style = new TextStyle({
      fill: '#ffffff',
      fontSize: 36,
      fontFamily: 'Arial',
      fontWeight: 'bold',
    });
    const smallStyle = new TextStyle({
      fill: '#ffffff',
      fontSize: 24,
      fontFamily: 'Arial',
    });

    this.scoreText = new Text({ text: '0', style });
    this.scoreText.anchor.set(1, 0);
    this.scoreText.position.set(width - 20, 20);

    this.timerText = new Text({ text: '30', style });
    this.timerText.anchor.set(0.5, 0);
    this.timerText.position.set(width / 2, 20);

    this.livesText = new Text({ text: '\u2764\u2764\u2764', style: smallStyle });
    this.livesText.position.set(20, 20);

    this.comboText = new Text({
      text: '',
      style: new TextStyle({
        fill: '#ffdd00',
        fontSize: 48,
        fontWeight: 'bold',
      }),
    });
    this.comboText.anchor.set(0.5);
    this.comboText.position.set(width / 2, height / 2);
    this.comboText.alpha = 0;

    container.addChild(this.scoreText, this.timerText, this.livesText, this.comboText);
  }

  sync(engine: Engine): void {
    const overlay = engine.getModulesByType('UIOverlay')[0] as UIOverlay | undefined;
    if (overlay) {
      const hud = overlay.getHudState();
      this.scoreText.text = String(hud.score ?? 0);

      const remaining = hud.timer?.remaining ?? 0;
      this.timerText.text = String(Math.ceil(remaining));

      this.livesText.text = '\u2764'.repeat(hud.lives ?? 0);

      const comboCount = hud.combo?.count ?? 0;
      const comboFade = hud.combo?.fadeTimer ?? 0;
      if (comboCount > 1 && comboFade > 0) {
        this.comboText.text = `${comboCount}x COMBO!`;
        // Normalize fade: fadeTimer goes from 1500 -> 0
        this.comboText.alpha = Math.min(1, comboFade / 500);
      } else {
        this.comboText.alpha = 0;
      }
    }
  }

  reset(): void {
    this.scoreText.text = '0';
    this.timerText.text = '';
    this.livesText.text = '';
    this.comboText.alpha = 0;
  }
}
