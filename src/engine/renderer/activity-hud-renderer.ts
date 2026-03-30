import { Container, Text, TextStyle, Graphics } from 'pixi.js';
import type { Engine } from '@/engine/core/engine';
import type { Runner } from '@/engine/modules/mechanic/runner';
import type { BeatMap } from '@/engine/modules/mechanic/beat-map';
import type { PlaneDetection } from '@/engine/modules/mechanic/plane-detection';

export class ActivityHudRenderer {
  private width: number;
  private height: number;

  // Runner UI elements
  private runnerContainer: Container;
  private runnerLaneGraphics!: Graphics;
  private runnerDistanceText!: Text;
  private runnerSpeedText!: Text;

  // Rhythm UI elements
  private rhythmContainer: Container;
  private rhythmGraphics!: Graphics;
  private rhythmFeedbackText!: Text;
  private rhythmLastFeedback = '';
  private rhythmFeedbackTimer = 0;

  // World-AR UI elements
  private arContainer: Container;
  private arGraphics!: Graphics;
  private arPlaneCountText!: Text;

  constructor(parent: Container, width: number, height: number) {
    this.width = width;
    this.height = height;

    this.runnerContainer = this.buildRunnerContainer();
    this.rhythmContainer = this.buildRhythmContainer();
    this.arContainer = this.buildARContainer();

    parent.addChild(
      this.runnerContainer,
      this.rhythmContainer,
      this.arContainer,
    );
  }

  sync(engine: Engine, dt: number): void {
    this.syncRunner(engine);
    this.syncRhythm(engine, dt);
    this.syncAR(engine);
  }

  reset(): void {
    this.runnerContainer.visible = false;
    this.rhythmContainer.visible = false;
    this.arContainer.visible = false;
  }

  showRhythmFeedback(accuracy: number): void {
    if (accuracy > 0.8) {
      this.rhythmLastFeedback = '\u2728 PERFECT!';
      (this.rhythmFeedbackText.style as TextStyle).fill = '#00ff88';
    } else if (accuracy > 0.5) {
      this.rhythmLastFeedback = '\u{1F44D} GOOD';
      (this.rhythmFeedbackText.style as TextStyle).fill = '#ffd700';
    } else {
      this.rhythmLastFeedback = 'MISS';
      (this.rhythmFeedbackText.style as TextStyle).fill = '#ff4444';
    }
    this.rhythmFeedbackTimer = 600;
  }

  // ── Runner (跑酷) ──────────────────────────────────────────

  private buildRunnerContainer(): Container {
    const c = new Container();
    c.visible = false;

    this.runnerLaneGraphics = new Graphics();
    c.addChild(this.runnerLaneGraphics);

    this.runnerDistanceText = new Text({
      text: '',
      style: new TextStyle({ fill: '#ffffff', fontSize: 28, fontFamily: 'Arial', fontWeight: 'bold' }),
    });
    this.runnerDistanceText.anchor.set(0.5, 0);
    this.runnerDistanceText.position.set(this.width / 2, 60);
    c.addChild(this.runnerDistanceText);

    this.runnerSpeedText = new Text({
      text: '',
      style: new TextStyle({ fill: '#aaaaaa', fontSize: 20, fontFamily: 'Arial' }),
    });
    this.runnerSpeedText.anchor.set(0.5, 0);
    this.runnerSpeedText.position.set(this.width / 2, 92);
    c.addChild(this.runnerSpeedText);

    return c;
  }

  private syncRunner(engine: Engine): void {
    const runner = engine.getModulesByType('Runner')[0] as Runner | undefined;
    if (!runner) {
      this.runnerContainer.visible = false;
      return;
    }
    this.runnerContainer.visible = true;

    const distance = runner.getDistance();
    const speed = runner.getCurrentSpeed();
    const lane = runner.getCurrentLane();
    const laneCount = (runner.getParams().laneCount as number | undefined) ?? 3;

    this.runnerDistanceText.text = `\u{1F3C3} ${Math.floor(distance)}m`;
    this.runnerSpeedText.text = `\u26A1 ${Math.floor(speed)} px/s`;

    const g = this.runnerLaneGraphics;
    g.clear();
    const laneWidth = this.width / laneCount;
    const laneY = this.height - 80;

    for (let i = 0; i < laneCount; i++) {
      const x = i * laneWidth;
      const isActive = i === lane;
      g.rect(x + 4, laneY, laneWidth - 8, 6)
        .fill({ color: isActive ? 0x00ff88 : 0x444444, alpha: isActive ? 0.8 : 0.3 });
    }

    const markerX = lane * laneWidth + laneWidth / 2;
    g.circle(markerX, laneY - 10, 8).fill({ color: 0x00ff88 });
  }

  // ── Rhythm (节奏) ─────────────────────────────────────────

  private buildRhythmContainer(): Container {
    const c = new Container();
    c.visible = false;

    this.rhythmGraphics = new Graphics();
    c.addChild(this.rhythmGraphics);

    this.rhythmFeedbackText = new Text({
      text: '',
      style: new TextStyle({ fill: '#ffffff', fontSize: 48, fontFamily: 'Arial', fontWeight: 'bold' }),
    });
    this.rhythmFeedbackText.anchor.set(0.5);
    this.rhythmFeedbackText.position.set(this.width / 2, this.height * 0.4);
    c.addChild(this.rhythmFeedbackText);

    return c;
  }

  private syncRhythm(engine: Engine, dt: number): void {
    const beatMap = engine.getModulesByType('BeatMap')[0] as BeatMap | undefined;
    if (!beatMap) {
      this.rhythmContainer.visible = false;
      return;
    }
    this.rhythmContainer.visible = true;

    const beats = beatMap.getBeats();
    const elapsed = beatMap.getElapsed();
    const currentIndex = beatMap.getCurrentBeatIndex();
    const tolerance = (beatMap.getParams().tolerance as number | undefined) ?? 200;

    const g = this.rhythmGraphics;
    g.clear();

    // Hit zone line
    const hitLineY = this.height * 0.75;
    g.rect(0, hitLineY - 3, this.width, 6).fill({ color: 0x00ff88, alpha: 0.6 });
    g.rect(0, hitLineY - tolerance / 4, this.width, tolerance / 2).fill({ color: 0x00ff88, alpha: 0.1 });

    // Draw upcoming beats as falling notes
    const visibleWindow = 2000;
    for (let i = currentIndex; i < beats.length && i < currentIndex + 10; i++) {
      const beatTime = beats[i];
      const timeUntil = beatTime - elapsed;
      if (timeUntil < -tolerance) continue;
      if (timeUntil > visibleWindow) break;

      const progress = 1 - timeUntil / visibleWindow;
      const noteY = progress * hitLineY;
      const noteX = this.width / 2;

      const alpha = Math.max(0.3, Math.min(1, progress));
      g.circle(noteX, noteY, 16).fill({ color: 0xff6b9d, alpha });
      g.circle(noteX, noteY, 12).fill({ color: 0xff99bb, alpha });
    }

    // Feedback text fade
    if (this.rhythmFeedbackTimer > 0) {
      this.rhythmFeedbackTimer -= dt;
      this.rhythmFeedbackText.text = this.rhythmLastFeedback;
      this.rhythmFeedbackText.alpha = Math.min(1, this.rhythmFeedbackTimer / 300);
    } else {
      this.rhythmFeedbackText.alpha = 0;
    }
  }

  // ── World-AR (世界AR) ─────────────────────────────────────

  private buildARContainer(): Container {
    const c = new Container();
    c.visible = false;

    this.arGraphics = new Graphics();
    c.addChild(this.arGraphics);

    this.arPlaneCountText = new Text({
      text: '',
      style: new TextStyle({ fill: '#00d4ff', fontSize: 24, fontFamily: 'Arial' }),
    });
    this.arPlaneCountText.anchor.set(0.5, 0);
    this.arPlaneCountText.position.set(this.width / 2, 60);
    c.addChild(this.arPlaneCountText);

    return c;
  }

  private syncAR(engine: Engine): void {
    const planeDetection = engine.getModulesByType('PlaneDetection')[0] as PlaneDetection | undefined;
    if (!planeDetection) {
      this.arContainer.visible = false;
      return;
    }
    this.arContainer.visible = true;

    const planes = planeDetection.getPlanes();
    this.arPlaneCountText.text = `\u{1F4CD} ${planes.length} \u5E73\u9762\u68C0\u6D4B\u5230`;

    const g = this.arGraphics;
    g.clear();

    for (const plane of planes) {
      const x = plane.x * this.width;
      const y = plane.y * this.height;
      const w = plane.width * this.width;
      const h = plane.height * this.height;
      const alpha = 0.15 + plane.confidence * 0.25;

      g.rect(x - w / 2, y - h / 2, w, h)
        .fill({ color: 0x00d4ff, alpha })
        .stroke({ color: 0x00d4ff, width: 2, alpha: alpha + 0.2 });

      const cornerSize = 10;
      const corners = [
        [x - w / 2, y - h / 2], [x + w / 2 - cornerSize, y - h / 2],
        [x - w / 2, y + h / 2 - cornerSize], [x + w / 2 - cornerSize, y + h / 2 - cornerSize],
      ];
      for (const [cx, cy] of corners) {
        g.rect(cx, cy, cornerSize, cornerSize).fill({ color: 0x00ff88, alpha: 0.6 });
      }
    }
  }
}
