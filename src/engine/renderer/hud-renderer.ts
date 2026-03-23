import { Container, Text, TextStyle, Graphics } from 'pixi.js';
import type { Engine } from '@/engine/core/engine';
import type { UIOverlay } from '@/engine/modules/feedback/ui-overlay';
import type { QuizEngine } from '@/engine/modules/mechanic/quiz-engine';
import type { Randomizer } from '@/engine/modules/mechanic/randomizer';

export class HudRenderer {
  private scoreText: Text;
  private timerText: Text;
  private livesText: Text;
  private comboText: Text;

  // Quiz UI elements
  private quizContainer: Container;
  private questionText: Text;
  private optionTexts: Text[] = [];
  private optionBgs: Graphics[] = [];
  private progressText: Text;

  // Wheel UI elements
  private wheelContainer: Container;
  private wheelGraphics: Graphics;
  private wheelPointer: Graphics;
  private wheelResultText: Text;
  private wheelHintText: Text;
  private wheelAngle = 0;

  private width: number;
  private height: number;

  constructor(container: Container, width: number, height: number) {
    this.width = width;
    this.height = height;

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
    this.comboText.position.set(width / 2, height / 2 - 200);
    this.comboText.alpha = 0;

    // Quiz container
    this.quizContainer = new Container();
    this.quizContainer.visible = false;

    this.questionText = new Text({
      text: '',
      style: new TextStyle({
        fill: '#ffffff',
        fontSize: 40,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        wordWrap: true,
        wordWrapWidth: width - 120,
        align: 'center',
      }),
    });
    this.questionText.anchor.set(0.5, 0);
    this.questionText.position.set(width / 2, height * 0.2);

    this.progressText = new Text({
      text: '',
      style: new TextStyle({
        fill: '#888888',
        fontSize: 24,
        fontFamily: 'Arial',
      }),
    });
    this.progressText.anchor.set(0.5, 0);
    this.progressText.position.set(width / 2, height * 0.15);

    this.quizContainer.addChild(this.progressText, this.questionText);

    // Create 4 option slots
    const optionStyle = new TextStyle({
      fill: '#ffffff',
      fontSize: 32,
      fontFamily: 'Arial',
      wordWrap: true,
      wordWrapWidth: width - 200,
    });

    for (let i = 0; i < 4; i++) {
      const bg = new Graphics();
      const y = height * 0.45 + i * 120;
      bg.roundRect(60, y, width - 120, 90, 16);
      bg.fill({ color: 0x1e3a5f, alpha: 0.8 });
      bg.stroke({ color: 0x3b82f6, width: 2, alpha: 0.5 });

      const text = new Text({ text: '', style: optionStyle });
      text.anchor.set(0, 0.5);
      text.position.set(100, y + 45);

      this.optionBgs.push(bg);
      this.optionTexts.push(text);
      this.quizContainer.addChild(bg, text);
    }

    // Wheel container
    this.wheelContainer = new Container();
    this.wheelContainer.visible = false;

    this.wheelGraphics = new Graphics();
    this.wheelContainer.addChild(this.wheelGraphics);

    this.wheelPointer = new Graphics();
    this.wheelPointer.moveTo(width / 2, height * 0.15);
    this.wheelPointer.lineTo(width / 2 - 20, height * 0.15 - 40);
    this.wheelPointer.lineTo(width / 2 + 20, height * 0.15 - 40);
    this.wheelPointer.closePath();
    this.wheelPointer.fill({ color: 0xff4444 });
    this.wheelContainer.addChild(this.wheelPointer);

    this.wheelResultText = new Text({
      text: '',
      style: new TextStyle({ fill: '#ffffff', fontSize: 48, fontWeight: 'bold', fontFamily: 'Arial' }),
    });
    this.wheelResultText.anchor.set(0.5);
    this.wheelResultText.position.set(width / 2, height * 0.82);
    this.wheelResultText.alpha = 0;
    this.wheelContainer.addChild(this.wheelResultText);

    this.wheelHintText = new Text({
      text: '点击屏幕开始旋转',
      style: new TextStyle({ fill: '#888888', fontSize: 28, fontFamily: 'Arial' }),
    });
    this.wheelHintText.anchor.set(0.5);
    this.wheelHintText.position.set(width / 2, height * 0.88);
    this.wheelContainer.addChild(this.wheelHintText);

    container.addChild(this.scoreText, this.timerText, this.livesText, this.comboText, this.quizContainer, this.wheelContainer);
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
        this.comboText.alpha = Math.min(1, comboFade / 500);
      } else {
        this.comboText.alpha = 0;
      }
    }

    // Quiz rendering
    const quizEngine = engine.getModulesByType('QuizEngine')[0] as QuizEngine | undefined;
    if (quizEngine) {
      this.quizContainer.visible = true;
      const question = quizEngine.getCurrentQuestion();
      const progress = quizEngine.getProgress();

      if (question) {
        this.progressText.text = `${progress.current + 1} / ${progress.total}`;
        this.questionText.text = String((question as any).question ?? '');
        const options: string[] = (question as any).options ?? [];
        for (let i = 0; i < 4; i++) {
          if (i < options.length) {
            this.optionTexts[i].text = `${String.fromCharCode(65 + i)}. ${options[i]}`;
            this.optionTexts[i].visible = true;
            this.optionBgs[i].visible = true;
          } else {
            this.optionTexts[i].visible = false;
            this.optionBgs[i].visible = false;
          }
        }
      } else {
        this.questionText.text = quizEngine.isFinished() ? '答题完成！' : '准备开始...';
        this.progressText.text = '';
        for (let i = 0; i < 4; i++) {
          this.optionTexts[i].visible = false;
          this.optionBgs[i].visible = false;
        }
      }
    } else {
      this.quizContainer.visible = false;
    }

    // Wheel rendering
    const randomizer = engine.getModulesByType('Randomizer')[0] as Randomizer | undefined;
    if (randomizer) {
      this.wheelContainer.visible = true;
      const items = randomizer.getItems();
      const spinning = randomizer.isSpinning();
      const progress = randomizer.getSpinProgress();
      const result = randomizer.getResult();

      if (spinning) {
        // Ease-out spin: fast at start, slow at end
        const eased = 1 - Math.pow(1 - progress, 3);
        this.wheelAngle += (1 - eased) * 0.4 + 0.02;
        this.wheelHintText.text = '';
      }

      if (result && !spinning) {
        this.wheelResultText.text = String((result as any).item?.label ?? (result as any).item?.asset ?? '');
        this.wheelResultText.alpha = 1;
        this.wheelHintText.text = '点击再转一次';
      } else if (!spinning && !result) {
        this.wheelResultText.alpha = 0;
        this.wheelHintText.text = '点击屏幕开始旋转';
      }

      // Draw wheel
      this.drawWheel(items, this.wheelAngle);
    } else {
      this.wheelContainer.visible = false;
    }
  }

  private drawWheel(items: Array<{ asset: string; label?: string; weight: number }>, angle: number): void {
    if (items.length === 0) return;

    const g = this.wheelGraphics;
    g.clear();

    const cx = this.width / 2;
    const cy = this.height * 0.45;
    const radius = Math.min(this.width, this.height) * 0.28;
    const segAngle = (Math.PI * 2) / items.length;

    const COLORS = [0x3b82f6, 0xef4444, 0x22c55e, 0xf59e0b, 0x8b5cf6, 0xec4899, 0x06b6d4, 0xf97316];

    for (let i = 0; i < items.length; i++) {
      const startA = angle + i * segAngle;
      const endA = startA + segAngle;
      const color = COLORS[i % COLORS.length];

      // Draw segment
      g.moveTo(cx, cy);
      g.arc(cx, cy, radius, startA, endA);
      g.closePath();
      g.fill({ color, alpha: 0.85 });
      g.stroke({ color: 0xffffff, width: 2, alpha: 0.3 });
    }

    // Draw center circle
    g.circle(cx, cy, 30).fill({ color: 0x1f2937 });
    g.circle(cx, cy, 28).stroke({ color: 0xffffff, width: 2 });

    // Draw pointer triangle at top
    this.wheelPointer.clear();
    this.wheelPointer.moveTo(cx, cy - radius - 5);
    this.wheelPointer.lineTo(cx - 18, cy - radius - 40);
    this.wheelPointer.lineTo(cx + 18, cy - radius - 40);
    this.wheelPointer.closePath();
    this.wheelPointer.fill({ color: 0xff4444 });
  }

  reset(): void {
    this.scoreText.text = '0';
    this.timerText.text = '';
    this.livesText.text = '';
    this.comboText.alpha = 0;
    this.quizContainer.visible = false;
    this.wheelContainer.visible = false;
    this.wheelAngle = 0;
  }
}
