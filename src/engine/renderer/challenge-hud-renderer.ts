import { Container, Text, TextStyle, Graphics } from 'pixi.js';
import type { Engine } from '@/engine/core/engine';
import type { ExpressionDetector } from '@/engine/modules/mechanic/expression-detector';
import type { GestureMatch } from '@/engine/modules/mechanic/gesture-match';
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

export class ChallengeHudRenderer {
  private width: number;
  private height: number;

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

  constructor(parent: Container, width: number, height: number) {
    this.width = width;
    this.height = height;

    this.expressionContainer = this.buildExpressionContainer();
    this.gestureContainer = this.buildGestureContainer();
    this.puzzleContainer = this.buildPuzzleContainer();
    this.dressUpContainer = this.buildDressUpContainer();
    this.narrativeContainer = this.buildNarrativeContainer();

    parent.addChild(
      this.expressionContainer,
      this.gestureContainer,
      this.puzzleContainer,
      this.dressUpContainer,
      this.narrativeContainer,
    );
  }

  sync(engine: Engine): void {
    this.syncExpression(engine);
    this.syncGesture(engine);
    this.syncPuzzle(engine);
    this.syncDressUp(engine);
    this.syncNarrative(engine);
  }

  reset(): void {
    this.expressionContainer.visible = false;
    this.gestureContainer.visible = false;
    this.puzzleContainer.visible = false;
    this.dressUpContainer.visible = false;
    this.narrativeContainer.visible = false;
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

    this.dressUpSilhouette = new Graphics();
    c.addChild(this.dressUpSilhouette);

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
        g.roundRect(x, y, cardW, cardH, 8);
        g.fill({ color: CARD_COLORS[cell.value % CARD_COLORS.length], alpha: 0.6 });
        g.stroke({ color: 0x22c55e, width: 3 });
      } else if (cell.revealed) {
        g.roundRect(x, y, cardW, cardH, 8);
        g.fill({ color: CARD_COLORS[cell.value % CARD_COLORS.length], alpha: 0.85 });
        g.stroke({ color: 0xffffff, width: 2, alpha: 0.5 });
      } else {
        g.roundRect(x, y, cardW, cardH, 8);
        g.fill({ color: 0x374151, alpha: 0.9 });
        g.stroke({ color: 0x6b7280, width: 2, alpha: 0.5 });
      }

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

      this.drawSilhouette();

      for (let i = 0; i < 5; i++) {
        if (i < layers.length) {
          const layer = layers[i];
          const emoji = LAYER_EMOJI[layer] ?? '\uD83D\uDCE6';
          const label = LAYER_LABEL[layer] ?? layer;
          this.dressUpLayerTexts[i].text = `${emoji} ${label}`;
          this.dressUpLayerTexts[i].visible = true;

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

    g.roundRect(cx - w / 2, cy - h / 2, w, h, 20);
    g.fill({ color: 0x1f2937, alpha: 0.7 });
    g.stroke({ color: 0x4b5563, width: 2, alpha: 0.6 });

    g.circle(cx, cy - h * 0.28, w * 0.2);
    g.fill({ color: 0x374151, alpha: 0.8 });
    g.stroke({ color: 0x6b7280, width: 2 });

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
}
