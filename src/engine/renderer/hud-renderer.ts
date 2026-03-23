import { Container, Text, TextStyle, Graphics } from 'pixi.js';
import type { Engine } from '@/engine/core/engine';
import type { UIOverlay } from '@/engine/modules/feedback/ui-overlay';
import type { QuizEngine } from '@/engine/modules/mechanic/quiz-engine';
import type { Randomizer } from '@/engine/modules/mechanic/randomizer';
import type { GestureMatch } from '@/engine/modules/mechanic/gesture-match';
import type { ExpressionDetector } from '@/engine/modules/mechanic/expression-detector';
import type { MatchEngine } from '@/engine/modules/mechanic/match-engine';
import type { DressUpEngine } from '@/engine/modules/mechanic/dress-up-engine';
import type { BranchStateMachine } from '@/engine/modules/mechanic/branch-state-machine';

const GESTURE_EMOJI: Record<string, string> = {
  thumbs_up: '\uD83D\uDC4D',
  peace: '\u270C\uFE0F',
  fist: '\u270A',
  open_palm: '\uD83D\uDD90\uFE0F',
};

const EXPRESSION_EMOJI: Record<string, { emoji: string; label: string }> = {
  smile: { emoji: '\uD83D\uDE0A', label: '\u5FAE\u7B11' },
  surprise: { emoji: '\uD83D\uDE2E', label: '\u60CA\u8BB6' },
  wink: { emoji: '\uD83D\uDE09', label: '\u7728\u773C' },
  'open-mouth': { emoji: '\uD83D\uDE2E', label: '\u5F20\u5634' },
};

const LAYER_EMOJI: Record<string, string> = {
  hat: '\uD83C\uDFA9',
  glasses: '\uD83D\uDC53',
  shirt: '\uD83D\uDC54',
  pants: '\uD83D\uDC56',
  shoes: '\uD83D\uDC5F',
};

const LAYER_LABEL: Record<string, string> = {
  hat: '\u5E3D\u5B50',
  glasses: '\u773C\u955C',
  shirt: '\u4E0A\u8863',
  pants: '\u88E4\u5B50',
  shoes: '\u978B\u5B50',
};

const CARD_COLORS = [0x3b82f6, 0xef4444, 0x22c55e, 0xf59e0b, 0x8b5cf6, 0xec4899, 0x06b6d4, 0xf97316];

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

  // Expression UI elements
  private expressionContainer: Container;
  private expressionEmojiText!: Text;
  private expressionHintText!: Text;
  private expressionCheckText!: Text;

  // Gesture UI elements
  private gestureContainer: Container;
  private gestureEmojiText!: Text;
  private gestureLabelText!: Text;
  private gestureHintText!: Text;
  private gestureProgressText!: Text;

  // Puzzle UI elements
  private puzzleContainer: Container;
  private puzzleGraphics!: Graphics;
  private puzzleCardTexts: Text[] = [];
  private puzzleProgressText!: Text;

  // Dress-Up UI elements
  private dressUpContainer: Container;
  private dressUpSilhouette!: Graphics;
  private dressUpLayerTexts: Text[] = [];
  private dressUpEquipTexts: Text[] = [];
  private dressUpHintText!: Text;

  // Narrative UI elements
  private narrativeContainer: Container;
  private narrativeStoryText!: Text;
  private narrativeChoiceTexts: Text[] = [];
  private narrativeChoiceBgs: Graphics[] = [];
  private narrativeEndText!: Text;

  private width: number;
  private height: number;

  constructor(container: Container, width: number, height: number) {
    this.width = width;
    this.height = height;

    // V1-style HUD with emoji icons and colored backgrounds
    this.scoreText = new Text({
      text: '\u2b50 0',
      style: new TextStyle({ fill: '#FFD700', fontSize: 36, fontFamily: 'Arial', fontWeight: 'bold' }),
    });
    this.scoreText.anchor.set(1, 0);
    this.scoreText.position.set(width - 20, 16);

    this.timerText = new Text({
      text: '\u23f1 30',
      style: new TextStyle({ fill: '#00d4ff', fontSize: 36, fontFamily: 'Arial', fontWeight: 'bold' }),
    });
    this.timerText.anchor.set(0.5, 0);
    this.timerText.position.set(width / 2, 16);

    this.livesText = new Text({
      text: '\u2764\ufe0f\u2764\ufe0f\u2764\ufe0f',
      style: new TextStyle({ fill: '#ffffff', fontSize: 28, fontFamily: 'Arial' }),
    });
    this.livesText.position.set(20, 20);

    this.comboText = new Text({
      text: '',
      style: new TextStyle({ fill: '#ff6b9d', fontSize: 52, fontWeight: 'bold', fontFamily: 'Arial' }),
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
      text: '\u70B9\u51FB\u5C4F\u5E55\u5F00\u59CB\u65CB\u8F6C',
      style: new TextStyle({ fill: '#888888', fontSize: 28, fontFamily: 'Arial' }),
    });
    this.wheelHintText.anchor.set(0.5);
    this.wheelHintText.position.set(width / 2, height * 0.88);
    this.wheelContainer.addChild(this.wheelHintText);

    // Expression container
    this.expressionContainer = this.buildExpressionContainer();

    // Gesture container
    this.gestureContainer = this.buildGestureContainer();

    // Puzzle container
    this.puzzleContainer = this.buildPuzzleContainer();

    // Dress-Up container
    this.dressUpContainer = this.buildDressUpContainer();

    // Narrative container
    this.narrativeContainer = this.buildNarrativeContainer();

    container.addChild(
      this.scoreText,
      this.timerText,
      this.livesText,
      this.comboText,
      this.quizContainer,
      this.wheelContainer,
      this.expressionContainer,
      this.gestureContainer,
      this.puzzleContainer,
      this.dressUpContainer,
      this.narrativeContainer,
    );
  }

  // ── Expression (表情挑战) ────────────────────────────────────

  private buildExpressionContainer(): Container {
    const c = new Container();
    c.visible = false;

    this.expressionEmojiText = new Text({
      text: '',
      style: new TextStyle({
        fill: '#ffffff',
        fontSize: 80,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        align: 'center',
      }),
    });
    this.expressionEmojiText.anchor.set(0.5);
    this.expressionEmojiText.position.set(this.width / 2, this.height * 0.4);

    this.expressionHintText = new Text({
      text: '\u505A\u51FA\u8868\u60C5\u6765\u5339\u914D\uFF01',
      style: new TextStyle({
        fill: '#aaaaaa',
        fontSize: 28,
        fontFamily: 'Arial',
        align: 'center',
      }),
    });
    this.expressionHintText.anchor.set(0.5);
    this.expressionHintText.position.set(this.width / 2, this.height * 0.55);

    this.expressionCheckText = new Text({
      text: '\u2705',
      style: new TextStyle({
        fill: '#22c55e',
        fontSize: 96,
        fontWeight: 'bold',
      }),
    });
    this.expressionCheckText.anchor.set(0.5);
    this.expressionCheckText.position.set(this.width / 2, this.height * 0.65);
    this.expressionCheckText.alpha = 0;

    c.addChild(this.expressionEmojiText, this.expressionHintText, this.expressionCheckText);
    return c;
  }

  // ── Gesture (手势互动) ────────────────────────────────────

  private buildGestureContainer(): Container {
    const c = new Container();
    c.visible = false;

    this.gestureEmojiText = new Text({
      text: '',
      style: new TextStyle({
        fill: '#ffffff',
        fontSize: 80,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        align: 'center',
      }),
    });
    this.gestureEmojiText.anchor.set(0.5);
    this.gestureEmojiText.position.set(this.width / 2, this.height * 0.35);

    this.gestureLabelText = new Text({
      text: '',
      style: new TextStyle({
        fill: '#ffffff',
        fontSize: 36,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        align: 'center',
      }),
    });
    this.gestureLabelText.anchor.set(0.5);
    this.gestureLabelText.position.set(this.width / 2, this.height * 0.48);

    this.gestureHintText = new Text({
      text: '\u505A\u51FA\u624B\u52BF\u6765\u5339\u914D\uFF01',
      style: new TextStyle({
        fill: '#aaaaaa',
        fontSize: 28,
        fontFamily: 'Arial',
        align: 'center',
      }),
    });
    this.gestureHintText.anchor.set(0.5);
    this.gestureHintText.position.set(this.width / 2, this.height * 0.58);

    this.gestureProgressText = new Text({
      text: '',
      style: new TextStyle({
        fill: '#888888',
        fontSize: 24,
        fontFamily: 'Arial',
        align: 'center',
      }),
    });
    this.gestureProgressText.anchor.set(0.5);
    this.gestureProgressText.position.set(this.width / 2, this.height * 0.28);

    c.addChild(
      this.gestureProgressText,
      this.gestureEmojiText,
      this.gestureLabelText,
      this.gestureHintText,
    );
    return c;
  }

  // ── Puzzle (拼图配对) ────────────────────────────────────

  private buildPuzzleContainer(): Container {
    const c = new Container();
    c.visible = false;

    this.puzzleGraphics = new Graphics();
    c.addChild(this.puzzleGraphics);

    this.puzzleProgressText = new Text({
      text: '',
      style: new TextStyle({
        fill: '#888888',
        fontSize: 24,
        fontFamily: 'Arial',
        align: 'center',
      }),
    });
    this.puzzleProgressText.anchor.set(0.5, 0);
    this.puzzleProgressText.position.set(this.width / 2, this.height * 0.12);
    c.addChild(this.puzzleProgressText);

    return c;
  }

  // ── Dress-Up (换装贴纸) ────────────────────────────────────

  private buildDressUpContainer(): Container {
    const c = new Container();
    c.visible = false;

    // Silhouette placeholder on left
    this.dressUpSilhouette = new Graphics();
    c.addChild(this.dressUpSilhouette);

    // Layer slots on right — create up to 5
    const layerStyle = new TextStyle({
      fill: '#ffffff',
      fontSize: 28,
      fontFamily: 'Arial',
      fontWeight: 'bold',
    });
    const equipStyle = new TextStyle({
      fill: '#aaaaaa',
      fontSize: 24,
      fontFamily: 'Arial',
    });

    for (let i = 0; i < 5; i++) {
      const yPos = this.height * 0.22 + i * 80;

      const layerText = new Text({ text: '', style: layerStyle });
      layerText.position.set(this.width * 0.52, yPos);
      layerText.visible = false;

      const equipText = new Text({ text: '', style: equipStyle });
      equipText.position.set(this.width * 0.52, yPos + 32);
      equipText.visible = false;

      this.dressUpLayerTexts.push(layerText);
      this.dressUpEquipTexts.push(equipText);
      c.addChild(layerText, equipText);
    }

    this.dressUpHintText = new Text({
      text: '\u70B9\u51FB\u9009\u62E9\u88C5\u5907',
      style: new TextStyle({
        fill: '#888888',
        fontSize: 24,
        fontFamily: 'Arial',
        align: 'center',
      }),
    });
    this.dressUpHintText.anchor.set(0.5);
    this.dressUpHintText.position.set(this.width / 2, this.height * 0.88);
    c.addChild(this.dressUpHintText);

    return c;
  }

  // ── Narrative (分支叙事) ────────────────────────────────────

  private buildNarrativeContainer(): Container {
    const c = new Container();
    c.visible = false;

    this.narrativeStoryText = new Text({
      text: '',
      style: new TextStyle({
        fill: '#ffffff',
        fontSize: 36,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        wordWrap: true,
        wordWrapWidth: this.width - 120,
        align: 'center',
      }),
    });
    this.narrativeStoryText.anchor.set(0.5, 0);
    this.narrativeStoryText.position.set(this.width / 2, this.height * 0.15);

    c.addChild(this.narrativeStoryText);

    // Choice buttons — up to 4
    const choiceStyle = new TextStyle({
      fill: '#ffffff',
      fontSize: 30,
      fontFamily: 'Arial',
      wordWrap: true,
      wordWrapWidth: this.width - 200,
    });

    for (let i = 0; i < 4; i++) {
      const y = this.height * 0.5 + i * 100;
      const bg = new Graphics();
      bg.roundRect(80, y, this.width - 160, 80, 12);
      bg.fill({ color: 0x2d1b4e, alpha: 0.85 });
      bg.stroke({ color: 0x8b5cf6, width: 2, alpha: 0.6 });

      const text = new Text({ text: '', style: choiceStyle });
      text.anchor.set(0, 0.5);
      text.position.set(120, y + 40);

      bg.visible = false;
      text.visible = false;

      this.narrativeChoiceBgs.push(bg);
      this.narrativeChoiceTexts.push(text);
      c.addChild(bg, text);
    }

    this.narrativeEndText = new Text({
      text: '',
      style: new TextStyle({
        fill: '#f59e0b',
        fontSize: 40,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        align: 'center',
      }),
    });
    this.narrativeEndText.anchor.set(0.5);
    this.narrativeEndText.position.set(this.width / 2, this.height * 0.6);
    this.narrativeEndText.visible = false;
    c.addChild(this.narrativeEndText);

    return c;
  }

  // ── sync ────────────────────────────────────────────────────

  sync(engine: Engine): void {
    const overlay = engine.getModulesByType('UIOverlay')[0] as UIOverlay | undefined;
    if (overlay) {
      const hud = overlay.getHudState();

      // V1-style score with star emoji
      this.scoreText.text = `\u2b50 ${hud.score ?? 0}`;

      // V1-style timer with color coding
      const remaining = hud.timer?.remaining ?? 0;
      const duration = hud.timer?.elapsed != null ? remaining + hud.timer.elapsed : 30;
      const ratio = duration > 0 ? remaining / duration : 1;
      const ceil = Math.ceil(remaining);
      this.timerText.text = `\u23f1 ${ceil}`;
      if (ratio < 0.2) {
        (this.timerText.style as TextStyle).fill = '#ff4757'; // red
      } else if (ratio < 0.4) {
        (this.timerText.style as TextStyle).fill = '#ffa500'; // orange
      } else {
        (this.timerText.style as TextStyle).fill = '#00d4ff'; // cyan
      }

      // V1-style lives: ❤️ filled + 🖤 empty
      const currentLives = hud.lives ?? 0;
      const maxLives = 3; // default max
      const filled = '\u2764\ufe0f'.repeat(currentLives);
      const empty = '\uD83D\uDDA4'.repeat(Math.max(0, maxLives - currentLives));
      this.livesText.text = filled + empty;

      // V1-style combo with fire emoji
      const comboCount = hud.combo?.count ?? 0;
      const comboFade = hud.combo?.fadeTimer ?? 0;
      if (comboCount > 1 && comboFade > 0) {
        this.comboText.text = `\uD83D\uDD25 x${comboCount} COMBO!`;
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
        this.questionText.text = quizEngine.isFinished() ? '\u7B54\u9898\u5B8C\u6210\uFF01' : '\u51C6\u5907\u5F00\u59CB...';
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
        this.wheelHintText.text = '\u70B9\u51FB\u518D\u8F6C\u4E00\u6B21';
      } else if (!spinning && !result) {
        this.wheelResultText.alpha = 0;
        this.wheelHintText.text = '\u70B9\u51FB\u5C4F\u5E55\u5F00\u59CB\u65CB\u8F6C';
      }

      // Draw wheel
      this.drawWheel(items, this.wheelAngle);
    } else {
      this.wheelContainer.visible = false;
    }

    // Expression rendering
    this.syncExpression(engine);

    // Gesture rendering
    this.syncGesture(engine);

    // Puzzle rendering
    this.syncPuzzle(engine);

    // Dress-Up rendering
    this.syncDressUp(engine);

    // Narrative rendering
    this.syncNarrative(engine);
  }

  // ── Expression sync ─────────────────────────────────────────

  private syncExpression(engine: Engine): void {
    const detector = engine.getModulesByType('ExpressionDetector')[0] as ExpressionDetector | undefined;
    if (detector) {
      this.expressionContainer.visible = true;

      const exprType = detector.getExpressionType();
      const info = EXPRESSION_EMOJI[exprType] ?? { emoji: '\uD83D\uDE10', label: exprType };

      this.expressionEmojiText.text = `${info.emoji} ${info.label}`;

      if (detector.isMatched()) {
        this.expressionCheckText.alpha = Math.min(1, detector.getMatchFadeTimer() / 500);
        this.expressionHintText.text = '\u5339\u914D\u6210\u529F\uFF01';
      } else {
        this.expressionCheckText.alpha = 0;
        this.expressionHintText.text = '\u505A\u51FA\u8868\u60C5\u6765\u5339\u914D\uFF01';
      }
    } else {
      this.expressionContainer.visible = false;
    }
  }

  // ── Gesture sync ────────────────────────────────────────────

  private syncGesture(engine: Engine): void {
    const gestureMatch = engine.getModulesByType('GestureMatch')[0] as GestureMatch | undefined;
    if (gestureMatch) {
      this.gestureContainer.visible = true;

      const target = gestureMatch.getCurrentTarget();
      const progress = gestureMatch.getProgress();

      if (target) {
        const emoji = GESTURE_EMOJI[target] ?? '\u270B';
        this.gestureEmojiText.text = emoji;
        this.gestureLabelText.text = target.replace(/_/g, ' ');
        this.gestureHintText.text = '\u505A\u51FA\u624B\u52BF\u6765\u5339\u914D\uFF01';
        this.gestureProgressText.text = `${progress.matched + 1}/${progress.total}`;
      } else if (!gestureMatch.isActive()) {
        this.gestureEmojiText.text = '\u2705';
        this.gestureLabelText.text = '\u5168\u90E8\u5B8C\u6210\uFF01';
        this.gestureHintText.text = '';
        this.gestureProgressText.text = `${progress.matched}/${progress.total}`;
      } else {
        this.gestureEmojiText.text = '\u270B';
        this.gestureLabelText.text = '\u51C6\u5907...';
        this.gestureHintText.text = '';
        this.gestureProgressText.text = '';
      }
    } else {
      this.gestureContainer.visible = false;
    }
  }

  // ── Puzzle sync ─────────────────────────────────────────────

  private syncPuzzle(engine: Engine): void {
    const matchEngine = engine.getModulesByType('MatchEngine')[0] as MatchEngine | undefined;
    if (matchEngine) {
      this.puzzleContainer.visible = true;

      const grid = matchEngine.getGrid();
      const cols = matchEngine.getGridCols();
      const rows = matchEngine.getGridRows();
      const found = matchEngine.getMatchesFound();
      const total = matchEngine.getTotalPairs();

      this.puzzleProgressText.text = `\u5339\u914D: ${found} / ${total}`;

      this.drawPuzzleGrid(grid, cols, rows);
    } else {
      this.puzzleContainer.visible = false;
    }
  }

  private drawPuzzleGrid(
    grid: Array<{ id: number; value: number; revealed: boolean; matched: boolean }>,
    cols: number,
    rows: number,
  ): void {
    const g = this.puzzleGraphics;
    g.clear();

    // Remove old card texts
    for (const t of this.puzzleCardTexts) {
      t.destroy();
    }
    this.puzzleCardTexts = [];

    if (grid.length === 0) return;

    const padding = 40;
    const gap = 10;
    const availW = this.width - padding * 2;
    const availH = this.height * 0.72;
    const cardW = Math.min(120, (availW - gap * (cols - 1)) / cols);
    const cardH = Math.min(120, (availH - gap * (rows - 1)) / rows);
    const totalW = cols * cardW + (cols - 1) * gap;
    const totalH = rows * cardH + (rows - 1) * gap;
    const startX = (this.width - totalW) / 2;
    const startY = this.height * 0.18 + (availH - totalH) / 2;

    const textStyle = new TextStyle({
      fill: '#ffffff',
      fontSize: Math.min(32, cardH * 0.4),
      fontFamily: 'Arial',
      fontWeight: 'bold',
      align: 'center',
    });

    for (let i = 0; i < grid.length; i++) {
      const cell = grid[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + gap);

      if (cell.matched) {
        // Matched card — green border, colored fill
        g.roundRect(x, y, cardW, cardH, 8);
        g.fill({ color: CARD_COLORS[cell.value % CARD_COLORS.length], alpha: 0.6 });
        g.stroke({ color: 0x22c55e, width: 3 });
      } else if (cell.revealed) {
        // Revealed card — colored
        g.roundRect(x, y, cardW, cardH, 8);
        g.fill({ color: CARD_COLORS[cell.value % CARD_COLORS.length], alpha: 0.85 });
        g.stroke({ color: 0xffffff, width: 2, alpha: 0.5 });
      } else {
        // Face-down card — dark gray
        g.roundRect(x, y, cardW, cardH, 8);
        g.fill({ color: 0x374151, alpha: 0.9 });
        g.stroke({ color: 0x6b7280, width: 2, alpha: 0.5 });
      }

      // Card text
      const label = cell.revealed || cell.matched ? String(cell.value + 1) : '?';
      const txt = new Text({ text: label, style: textStyle });
      txt.anchor.set(0.5);
      txt.position.set(x + cardW / 2, y + cardH / 2);
      this.puzzleContainer.addChild(txt);
      this.puzzleCardTexts.push(txt);
    }
  }

  // ── Dress-Up sync ───────────────────────────────────────────

  private syncDressUp(engine: Engine): void {
    const dressUp = engine.getModulesByType('DressUpEngine')[0] as DressUpEngine | undefined;
    if (dressUp) {
      this.dressUpContainer.visible = true;

      const layers = dressUp.getLayers();
      const equipped = dressUp.getEquipped();

      // Draw silhouette placeholder on the left
      this.drawSilhouette();

      // Update layer slots
      for (let i = 0; i < 5; i++) {
        if (i < layers.length) {
          const layer = layers[i];
          const emoji = LAYER_EMOJI[layer] ?? '\uD83D\uDCE6';
          const label = LAYER_LABEL[layer] ?? layer;
          this.dressUpLayerTexts[i].text = `${emoji} ${label}`;
          this.dressUpLayerTexts[i].visible = true;

          // Find equipped item for this layer
          const layerItems = equipped.filter((e) => e.layer === layer);
          if (layerItems.length > 0) {
            this.dressUpEquipTexts[i].text = layerItems.map((e) => e.itemId).join(', ');
            this.dressUpEquipTexts[i].style.fill = '#22c55e';
          } else {
            this.dressUpEquipTexts[i].text = '\u672A\u88C5\u5907';
            this.dressUpEquipTexts[i].style.fill = '#666666';
          }
          this.dressUpEquipTexts[i].visible = true;
        } else {
          this.dressUpLayerTexts[i].visible = false;
          this.dressUpEquipTexts[i].visible = false;
        }
      }
    } else {
      this.dressUpContainer.visible = false;
    }
  }

  private drawSilhouette(): void {
    const g = this.dressUpSilhouette;
    g.clear();

    const cx = this.width * 0.25;
    const cy = this.height * 0.45;
    const w = this.width * 0.3;
    const h = this.height * 0.55;

    // Simple character silhouette
    g.roundRect(cx - w / 2, cy - h / 2, w, h, 20);
    g.fill({ color: 0x1f2937, alpha: 0.7 });
    g.stroke({ color: 0x4b5563, width: 2, alpha: 0.6 });

    // Head circle
    g.circle(cx, cy - h * 0.28, w * 0.2);
    g.fill({ color: 0x374151, alpha: 0.8 });
    g.stroke({ color: 0x6b7280, width: 2 });

    // Body rectangle
    g.roundRect(cx - w * 0.22, cy - h * 0.08, w * 0.44, h * 0.35, 8);
    g.fill({ color: 0x374151, alpha: 0.8 });
    g.stroke({ color: 0x6b7280, width: 2 });
  }

  // ── Narrative sync ──────────────────────────────────────────

  private syncNarrative(engine: Engine): void {
    const bsm = engine.getModulesByType('BranchStateMachine')[0] as BranchStateMachine | undefined;
    if (bsm) {
      this.narrativeContainer.visible = true;

      const stateData = bsm.getCurrentStateData();
      const isActive = bsm.isStarted();

      if (stateData) {
        this.narrativeStoryText.text = `\uD83D\uDCD6 ${stateData.text}`;
        this.narrativeStoryText.visible = true;

        const choices = stateData.choices ?? [];

        if (choices.length > 0 && isActive) {
          // Show choice buttons
          this.narrativeEndText.visible = false;
          for (let i = 0; i < 4; i++) {
            if (i < choices.length) {
              this.narrativeChoiceTexts[i].text = `${i + 1}. ${choices[i].label}`;
              this.narrativeChoiceTexts[i].visible = true;
              this.narrativeChoiceBgs[i].visible = true;
            } else {
              this.narrativeChoiceTexts[i].visible = false;
              this.narrativeChoiceBgs[i].visible = false;
            }
          }
        } else {
          // End state — no choices
          for (let i = 0; i < 4; i++) {
            this.narrativeChoiceTexts[i].visible = false;
            this.narrativeChoiceBgs[i].visible = false;
          }
          this.narrativeEndText.text = '\u6545\u4E8B\u7ED3\u675F';
          this.narrativeEndText.visible = true;
        }
      } else {
        this.narrativeStoryText.text = '\u6545\u4E8B\u5373\u5C06\u5F00\u59CB...';
        this.narrativeStoryText.visible = true;
        this.narrativeEndText.visible = false;
        for (let i = 0; i < 4; i++) {
          this.narrativeChoiceTexts[i].visible = false;
          this.narrativeChoiceBgs[i].visible = false;
        }
      }
    } else {
      this.narrativeContainer.visible = false;
    }
  }

  // ── Wheel drawing ───────────────────────────────────────────

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
    this.expressionContainer.visible = false;
    this.gestureContainer.visible = false;
    this.puzzleContainer.visible = false;
    this.dressUpContainer.visible = false;
    this.narrativeContainer.visible = false;
  }
}
