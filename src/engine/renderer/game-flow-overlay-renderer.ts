import { Container, Text, TextStyle, Graphics } from 'pixi.js';
import type { Engine } from '@/engine/core/engine';
import type { GameFlow } from '@/engine/modules/feedback/game-flow';
import type { ResultScreen } from '@/engine/modules/feedback/result-screen';

export class GameFlowOverlayRenderer {
  private width: number;
  private height: number;

  // Countdown overlay
  private countdownContainer: Container;
  private countdownBg!: Graphics;
  private countdownText!: Text;

  // Start screen overlay
  private startContainer: Container;
  private startBg!: Graphics;
  private startTitleText!: Text;
  private startHintText!: Text;
  private startGameNameText!: Text;

  // Result screen overlay
  private resultContainer: Container;
  private resultBg!: Graphics;
  private resultCard!: Graphics;
  private resultTitleText!: Text;
  private resultScoreText!: Text;
  private resultStarsText!: Text;
  private resultTimeText!: Text;
  private resultHintText!: Text;

  // Count-up animation
  private targetScore = 0;
  private displayedScore = 0;

  constructor(parent: Container, width: number, height: number) {
    this.width = width;
    this.height = height;

    this.countdownContainer = this.buildCountdownContainer();
    this.startContainer = this.buildStartContainer();
    this.resultContainer = this.buildResultContainer();

    parent.addChild(
      this.countdownContainer,
      this.startContainer,
      this.resultContainer,
    );
  }

  sync(engine: Engine): void {
    this.syncCountdown(engine);
    this.syncStart(engine);
    this.syncResult(engine);

    // Score count-up animation
    if (this.resultContainer.visible && this.displayedScore < this.targetScore) {
      const diff = this.targetScore - this.displayedScore;
      const increment = Math.max(1, Math.ceil(diff * 0.1));
      this.displayedScore += increment;
      this.resultScoreText.text = `\u2b50 \u5F97\u5206: ${this.displayedScore}`;
    }
  }

  reset(): void {
    this.countdownContainer.visible = false;
    this.startContainer.visible = true;
    this.resultContainer.visible = false;
    this.targetScore = 0;
    this.displayedScore = 0;
  }

  // ── Countdown overlay ──────────────────────────────────────

  private buildCountdownContainer(): Container {
    const c = new Container();
    c.visible = false;

    this.countdownBg = new Graphics();
    this.countdownBg.rect(0, 0, this.width, this.height);
    this.countdownBg.fill({ color: 0x000000, alpha: 0.6 });

    this.countdownText = new Text({
      text: '3',
      style: new TextStyle({
        fill: '#ffffff', fontSize: 160, fontFamily: 'Arial', fontWeight: 'bold', align: 'center',
      }),
    });
    this.countdownText.anchor.set(0.5);
    this.countdownText.position.set(this.width / 2, this.height * 0.4);

    c.addChild(this.countdownBg, this.countdownText);
    return c;
  }

  private syncCountdown(engine: Engine): void {
    const gameFlow = engine.getModulesByType('GameFlow')[0] as GameFlow | undefined;
    if (!gameFlow || gameFlow.getState() !== 'countdown') {
      this.countdownContainer.visible = false;
      return;
    }

    this.countdownContainer.visible = true;
    const remaining = gameFlow.getCountdownRemaining();
    const displayNum = Math.ceil(remaining);
    this.countdownText.text = displayNum > 0 ? String(displayNum) : 'GO!';
  }

  // ── Start screen ───────────────────────────────────────────

  private buildStartContainer(): Container {
    const c = new Container();
    c.visible = true;

    this.startBg = new Graphics();
    this.startBg.rect(0, 0, this.width, this.height);
    this.startBg.fill({ color: 0x000000, alpha: 0.7 });

    this.startTitleText = new Text({
      text: '\u{1F3AE}',
      style: new TextStyle({
        fontSize: 120, fontFamily: 'Arial', align: 'center',
      }),
    });
    this.startTitleText.anchor.set(0.5);
    this.startTitleText.position.set(this.width / 2, this.height * 0.3);

    this.startGameNameText = new Text({
      text: '',
      style: new TextStyle({
        fill: '#ffffff', fontSize: 48, fontFamily: 'Arial', fontWeight: 'bold',
        align: 'center', wordWrap: true, wordWrapWidth: this.width - 100,
      }),
    });
    this.startGameNameText.anchor.set(0.5);
    this.startGameNameText.position.set(this.width / 2, this.height * 0.45);

    this.startHintText = new Text({
      text: '\u{1F449} \u70B9\u51FB\u5C4F\u5E55\u5F00\u59CB\u6E38\u620F',
      style: new TextStyle({
        fill: '#aaaaaa', fontSize: 32, fontFamily: 'Arial', align: 'center',
      }),
    });
    this.startHintText.anchor.set(0.5);
    this.startHintText.position.set(this.width / 2, this.height * 0.6);

    c.addChild(this.startBg, this.startTitleText, this.startGameNameText, this.startHintText);
    return c;
  }

  private syncStart(engine: Engine): void {
    const gameFlow = engine.getModulesByType('GameFlow')[0] as GameFlow | undefined;
    if (!gameFlow) {
      this.startContainer.visible = false;
      return;
    }

    const state = gameFlow.getState();
    if (state === 'ready') {
      this.startContainer.visible = true;
      const config = engine.getConfig();
      this.startGameNameText.text = config.meta?.name || '\u65B0\u6E38\u620F';
    } else {
      this.startContainer.visible = false;
    }
  }

  // ── Result screen ──────────────────────────────────────────

  private buildResultContainer(): Container {
    const c = new Container();
    c.visible = false;

    this.resultBg = new Graphics();
    this.resultBg.rect(0, 0, this.width, this.height);
    this.resultBg.fill({ color: 0x000000, alpha: 0.75 });

    const cardWidth = this.width * 0.85;
    const cardHeight = this.height * 0.45;
    const cx = this.width / 2;
    const cy = this.height / 2;

    this.resultCard = new Graphics();
    this.resultCard.roundRect(cx - cardWidth / 2, cy - cardHeight / 2, cardWidth, cardHeight, 32);
    this.resultCard.fill({ color: 0x1f2937, alpha: 0.95 });
    this.resultCard.stroke({ color: 0x3b82f6, width: 2, alpha: 0.5 });

    this.resultTitleText = new Text({
      text: '\u6E38\u620F\u7ED3\u675F',
      style: new TextStyle({
        fill: '#ffffff', fontSize: 52, fontFamily: 'Arial', fontWeight: 'bold', align: 'center',
      }),
    });
    this.resultTitleText.anchor.set(0.5);
    this.resultTitleText.position.set(cx, cy - cardHeight * 0.3);

    this.resultStarsText = new Text({
      text: '',
      style: new TextStyle({
        fill: '#FFD700', fontSize: 64, fontFamily: 'Arial', align: 'center',
      }),
    });
    this.resultStarsText.anchor.set(0.5);
    this.resultStarsText.position.set(cx, cy - cardHeight * 0.12);

    this.resultScoreText = new Text({
      text: '',
      style: new TextStyle({
        fill: '#ffffff', fontSize: 48, fontFamily: 'Arial', fontWeight: 'bold', align: 'center',
      }),
    });
    this.resultScoreText.anchor.set(0.5);
    this.resultScoreText.position.set(cx, cy + cardHeight * 0.08);

    this.resultTimeText = new Text({
      text: '',
      style: new TextStyle({
        fill: '#00d4ff', fontSize: 28, fontFamily: 'Arial', align: 'center',
      }),
    });
    this.resultTimeText.anchor.set(0.5);
    this.resultTimeText.position.set(cx, cy + cardHeight * 0.22);

    this.resultHintText = new Text({
      text: '\u70B9\u51FB\u5C4F\u5E55\u91CD\u65B0\u5F00\u59CB',
      style: new TextStyle({
        fill: '#aaaaaa', fontSize: 28, fontFamily: 'Arial', align: 'center',
      }),
    });
    this.resultHintText.anchor.set(0.5);
    this.resultHintText.position.set(cx, cy + cardHeight * 0.38);

    c.addChild(this.resultBg, this.resultCard, this.resultTitleText, this.resultStarsText, this.resultScoreText, this.resultTimeText, this.resultHintText);
    return c;
  }


  private syncResult(engine: Engine): void {
    const gameFlow = engine.getModulesByType('GameFlow')[0] as GameFlow | undefined;
    if (!gameFlow || gameFlow.getState() !== 'finished') {
      this.resultContainer.visible = false;
      return;
    }

    // Reset displayed score when first becoming visible
    if (!this.resultContainer.visible) {
      this.displayedScore = 0;
    }

    this.resultContainer.visible = true;

    const resultScreen = engine.getModulesByType('ResultScreen')[0] as ResultScreen | undefined;
    if (resultScreen) {
      const results = resultScreen.getResults();
      const score = results.stats.score ?? 0;
      const time = results.stats.time;
      const stars = results.starRating;

      this.targetScore = score;
      // resultScoreText will be updated in sync() during count-up
      this.resultStarsText.text = '\u2B50'.repeat(stars) + '\u2606'.repeat(Math.max(0, 3 - stars));
      this.resultTimeText.text = time != null ? `\u23f1 \u7528\u65f6: ${Math.ceil(time)}s` : '';
    } else {
      // Fallback: read score directly from Scorer module
      const scorers = engine.getModulesByType('Scorer');
      if (scorers.length > 0) {
        const scorer = scorers[0] as { getScore?: () => number };
        const score = scorer.getScore?.() ?? 0;
        this.targetScore = score;
      }
      this.resultStarsText.text = '';
      this.resultTimeText.text = '';
    }
  }
}
