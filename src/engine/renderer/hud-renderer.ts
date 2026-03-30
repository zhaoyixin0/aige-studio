import { Container, Text, TextStyle, Graphics } from 'pixi.js';
import type { Engine } from '@/engine/core/engine';
import type { UIOverlay } from '@/engine/modules/feedback/ui-overlay';
import type { QuizEngine } from '@/engine/modules/mechanic/quiz-engine';
import type { Randomizer } from '@/engine/modules/mechanic/randomizer';
import type { GameFlow } from '@/engine/modules/feedback/game-flow';
import type { WaveSpawner } from '@/engine/modules/mechanic/wave-spawner';
import type { Health } from '@/engine/modules/mechanic/health';
import type { Shield } from '@/engine/modules/mechanic/shield';
import type { LevelUp } from '@/engine/modules/mechanic/level-up';
import type { SkillTree } from '@/engine/modules/mechanic/skill-tree';
import { computeHealthBarWidth, getHealthBarColor, computeShieldAlpha } from './shooter-renderer';
import { computeXpBarWidth } from './rpg-overlay-renderer';
import { ChallengeHudRenderer } from './challenge-hud-renderer';
import { ActivityHudRenderer } from './activity-hud-renderer';
import { GameFlowOverlayRenderer } from './game-flow-overlay-renderer';

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

  // Shooter HUD elements
  private shooterContainer: Container | null = null;
  private waveText!: Text;
  private enemyCountText!: Text;
  private playerHealthBarBg!: Graphics;
  private playerHealthBarFill!: Graphics;
  private shieldDotsContainer!: Container;

  // RPG HUD elements
  private rpgContainer: Container | null = null;
  private levelText!: Text;
  private xpBarBg!: Graphics;
  private xpBarFill!: Graphics;
  private skillPointText!: Text;

  // Sub-renderers
  private challengeHud: ChallengeHudRenderer;
  private activityHud: ActivityHudRenderer;
  private gameFlowOverlay: GameFlowOverlayRenderer;

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

    // Shooter HUD
    this.shooterContainer = this.buildShooterHudContainer();

    // RPG HUD
    this.rpgContainer = this.buildRpgHudContainer();

    // Sub-renderers (each adds its own children to the container)
    this.challengeHud = new ChallengeHudRenderer(container, width, height);
    this.activityHud = new ActivityHudRenderer(container, width, height);

    // Add core HUD elements to container (before game flow overlay so overlays render on top)
    container.addChild(
      this.scoreText,
      this.timerText,
      this.livesText,
      this.comboText,
      this.quizContainer,
      this.wheelContainer,
      this.shooterContainer,
      this.rpgContainer,
    );

    // Game flow overlay must be last — renders on top of everything
    this.gameFlowOverlay = new GameFlowOverlayRenderer(container, width, height);
  }

  // ── sync ────────────────────────────────────────────────────

  sync(engine: Engine, dt = 16): void {
    // Hide score/timer/lives HUD elements unless actively playing
    const gameFlow = engine.getModulesByType('GameFlow')[0] as GameFlow | undefined;
    const flowState = gameFlow?.getState() ?? 'playing';
    const hudVisible = flowState === 'playing';
    this.scoreText.visible = hudVisible;
    this.timerText.visible = hudVisible;
    this.livesText.visible = hudVisible;
    this.comboText.visible = hudVisible;

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
        (this.timerText.style as TextStyle).fill = '#ff4757';
      } else if (ratio < 0.4) {
        (this.timerText.style as TextStyle).fill = '#ffa500';
      } else {
        (this.timerText.style as TextStyle).fill = '#00d4ff';
      }

      // V1-style lives: filled + empty
      const currentLives = hud.lives ?? 0;
      const livesModule = engine.getModulesByType('Lives')[0] as { getParams: () => Record<string, unknown> } | undefined;
      const maxLives = (livesModule?.getParams()?.maxLives as number | undefined) ?? 3;
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
    this.syncQuiz(engine);

    // Wheel rendering
    this.syncWheel(engine);

    // Sub-renderer sync
    this.challengeHud.sync(engine);
    this.activityHud.sync(engine, dt);

    // Shooter HUD rendering
    this.syncShooterHud(engine);

    // RPG HUD rendering
    this.syncRpgHud(engine);

    // Game flow overlay (must be last — renders on top)
    this.gameFlowOverlay.sync(engine);
  }

  showRhythmFeedback(accuracy: number): void {
    this.activityHud.showRhythmFeedback(accuracy);
  }

  // ── Quiz sync ───────────────────────────────────────────────

  private syncQuiz(engine: Engine): void {
    const quizEngine = engine.getModulesByType('QuizEngine')[0] as QuizEngine | undefined;
    if (quizEngine) {
      this.quizContainer.visible = true;
      const question = quizEngine.getCurrentQuestion();
      const progress = quizEngine.getProgress();

      if (question) {
        this.progressText.text = `${progress.current + 1} / ${progress.total}`;
        const q = question as { question?: string; options?: string[] };
        this.questionText.text = String(q.question ?? '');
        const options: string[] = q.options ?? [];
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
  }

  // ── Wheel sync ──────────────────────────────────────────────

  private syncWheel(engine: Engine): void {
    const randomizer = engine.getModulesByType('Randomizer')[0] as Randomizer | undefined;
    if (randomizer) {
      this.wheelContainer.visible = true;

      const items = randomizer.getItems();
      const spinning = randomizer.isSpinning();
      const progress = randomizer.getSpinProgress();
      const result = randomizer.getResult();

      if (spinning) {
        const eased = 1 - Math.pow(1 - progress, 3);
        this.wheelAngle += (1 - eased) * 0.4 + 0.02;
        this.wheelHintText.text = '';
      }

      if (result && !spinning) {
        const r = result as { item?: { label?: string; asset?: string } };
        this.wheelResultText.text = String(r.item?.label ?? r.item?.asset ?? '');
        this.wheelResultText.alpha = 1;
        this.wheelHintText.text = '\u70B9\u51FB\u518D\u8F6C\u4E00\u6B21';
      } else if (!spinning && !result) {
        this.wheelResultText.alpha = 0;
        this.wheelHintText.text = '\u70B9\u51FB\u5C4F\u5E55\u5F00\u59CB\u65CB\u8F6C';
      }

      this.drawWheel(items, this.wheelAngle);
    } else {
      this.wheelContainer.visible = false;
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

      g.moveTo(cx, cy);
      g.arc(cx, cy, radius, startA, endA);
      g.closePath();
      g.fill({ color, alpha: 0.85 });
      g.stroke({ color: 0xffffff, width: 2, alpha: 0.3 });
    }

    g.circle(cx, cy, 30).fill({ color: 0x1f2937 });
    g.circle(cx, cy, 28).stroke({ color: 0xffffff, width: 2 });

    this.wheelPointer.clear();
    this.wheelPointer.moveTo(cx, cy - radius - 5);
    this.wheelPointer.lineTo(cx - 18, cy - radius - 40);
    this.wheelPointer.lineTo(cx + 18, cy - radius - 40);
    this.wheelPointer.closePath();
    this.wheelPointer.fill({ color: 0xff4444 });
  }

  // ── Shooter HUD ───────────────────────────────────────────────

  private buildShooterHudContainer(): Container {
    const c = new Container();
    c.visible = false;

    this.waveText = new Text({
      text: '',
      style: new TextStyle({ fill: '#ffffff', fontSize: 24, fontFamily: 'Arial', fontWeight: 'bold' }),
    });
    this.waveText.position.set(20, 60);

    this.enemyCountText = new Text({
      text: '',
      style: new TextStyle({ fill: '#aaaaaa', fontSize: 20, fontFamily: 'Arial' }),
    });
    this.enemyCountText.position.set(20, 88);

    this.playerHealthBarBg = new Graphics();
    this.playerHealthBarBg.rect(20, 115, 150, 8).fill({ color: 0x333333 });

    this.playerHealthBarFill = new Graphics();

    this.shieldDotsContainer = new Container();
    this.shieldDotsContainer.position.set(20, 130);

    c.addChild(
      this.waveText,
      this.enemyCountText,
      this.playerHealthBarBg,
      this.playerHealthBarFill,
      this.shieldDotsContainer,
    );
    return c;
  }

  private syncShooterHud(engine: Engine): void {
    const waveSpawner = engine.getModulesByType('WaveSpawner')[0] as WaveSpawner | undefined;
    const health = engine.getModulesByType('Health')[0] as Health | undefined;
    const shield = engine.getModulesByType('Shield')[0] as Shield | undefined;

    if (!waveSpawner && !health && !shield) {
      if (this.shooterContainer) this.shooterContainer.visible = false;
      return;
    }
    if (this.shooterContainer) this.shooterContainer.visible = true;

    if (waveSpawner) {
      const wave = waveSpawner.getCurrentWave();
      const remaining = waveSpawner.getEnemiesRemaining();
      this.waveText.text = wave > 0 ? `Wave ${wave}` : '';
      this.enemyCountText.text = wave > 0 ? `Enemies: ${remaining}` : '';
    } else {
      this.waveText.text = '';
      this.enemyCountText.text = '';
    }

    if (health) {
      const entity = health.getEntity('player_1');
      if (entity) {
        const ratio = entity.maxHp > 0 ? Math.max(0, Math.min(entity.hp / entity.maxHp, 1)) : 0;
        const fillWidth = computeHealthBarWidth(entity.hp, entity.maxHp, 150);
        const color = getHealthBarColor(ratio);
        this.playerHealthBarFill.clear();
        if (fillWidth > 0) {
          this.playerHealthBarFill.rect(20, 115, fillWidth, 8).fill({ color });
        }
        this.playerHealthBarBg.visible = true;
        this.playerHealthBarFill.visible = true;
      } else {
        this.playerHealthBarBg.visible = false;
        this.playerHealthBarFill.visible = false;
      }
    } else {
      this.playerHealthBarBg.visible = false;
      this.playerHealthBarFill.visible = false;
    }

    if (shield) {
      const charges = shield.getCharges();
      const maxCharges = (shield.getParams().maxCharges as number | undefined) ?? 3;
      this.shieldDotsContainer.removeChildren();
      for (let i = 0; i < maxCharges; i++) {
        const dot = new Graphics();
        const isFilled = i < charges;
        dot.circle(i * 18, 0, 6).fill({ color: isFilled ? 0x4488FF : 0x333333 });
        this.shieldDotsContainer.addChild(dot);
      }
      this.shieldDotsContainer.visible = true;
    } else {
      this.shieldDotsContainer.visible = false;
    }
  }

  // ── RPG HUD ──────────────────────────────────────────────────

  private buildRpgHudContainer(): Container {
    const c = new Container();
    c.visible = false;

    this.levelText = new Text({
      text: '',
      style: new TextStyle({ fill: '#BB86FC', fontSize: 22, fontFamily: 'Arial', fontWeight: 'bold' }),
    });
    this.levelText.position.set(20, 60);

    this.xpBarBg = new Graphics();
    this.xpBarBg.rect(80, 65, 120, 6).fill({ color: 0x333333 });

    this.xpBarFill = new Graphics();

    this.skillPointText = new Text({
      text: '',
      style: new TextStyle({ fill: '#FFD700', fontSize: 18, fontFamily: 'Arial', fontWeight: 'bold' }),
    });
    this.skillPointText.position.set(210, 60);

    c.addChild(this.levelText, this.xpBarBg, this.xpBarFill, this.skillPointText);
    return c;
  }

  private syncRpgHud(engine: Engine): void {
    const levelUp = engine.getModulesByType('LevelUp')[0] as LevelUp | undefined;
    const skillTree = engine.getModulesByType('SkillTree')[0] as SkillTree | undefined;

    if (!levelUp && !skillTree) {
      if (this.rpgContainer) this.rpgContainer.visible = false;
      return;
    }
    if (this.rpgContainer) this.rpgContainer.visible = true;

    if (levelUp) {
      const level = levelUp.getLevel();
      const currentXp = levelUp.getXp();
      const xpToNext = levelUp.getXpToNextLevel();
      this.levelText.text = `Lv.${level}`;
      const fillWidth = computeXpBarWidth(currentXp, xpToNext, 120);
      this.xpBarFill.clear();
      if (fillWidth > 0) {
        this.xpBarFill.rect(80, 65, fillWidth, 6).fill({ color: 0xBB86FC });
      }
    } else {
      this.levelText.text = '';
      this.xpBarFill.clear();
    }

    if (skillTree) {
      const points = skillTree.getAvailablePoints();
      this.skillPointText.text = points > 0 ? `SP: ${points}` : '';
    } else {
      this.skillPointText.text = '';
    }
  }

  reset(): void {
    this.scoreText.text = '0';
    this.timerText.text = '';
    this.livesText.text = '';
    this.comboText.alpha = 0;
    this.quizContainer.visible = false;
    this.wheelContainer.visible = false;
    this.wheelAngle = 0;
    if (this.shooterContainer) this.shooterContainer.visible = false;
    if (this.rpgContainer) this.rpgContainer.visible = false;
    this.challengeHud.reset();
    this.activityHud.reset();
    this.gameFlowOverlay.reset();
  }
}
