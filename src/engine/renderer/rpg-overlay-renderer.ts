import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Engine } from '@/engine/core/engine';
import type { DialogueSystem, DialogueNode } from '@/engine/modules/mechanic/dialogue-system';
import type { StatusEffect, ActiveEffect } from '@/engine/modules/mechanic/status-effect';
import type { GameFlow } from '@/engine/modules/feedback/game-flow';
import { loadDataUrlIntoContainer } from './image-utils';

// ── Pure helper functions (exported for testing) ────────────────

const DIALOGUE_PADDING = 30;

export interface DialogueBoxLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  textX: number;
  textY: number;
  textWidth: number;
}

/** Compute dialogue box position and dimensions. Bottom 25% of canvas. */
export function computeDialogueBoxLayout(
  canvasW: number,
  canvasH: number,
): DialogueBoxLayout {
  const height = canvasH * 0.25;
  const y = canvasH * 0.75;
  return {
    x: 0,
    y,
    width: canvasW,
    height,
    textX: DIALOGUE_PADDING,
    textY: y + DIALOGUE_PADDING,
    textWidth: canvasW - DIALOGUE_PADDING * 2,
  };
}

/** Compute XP bar fill width proportional to progress. */
export function computeXpBarWidth(
  currentXp: number,
  xpToNext: number,
  barMaxWidth: number,
): number {
  if (xpToNext <= 0) return 0;
  const ratio = Math.max(0, Math.min(currentXp / xpToNext, 1));
  return Math.round(ratio * barMaxWidth);
}

/** Compute remaining duration as 0..1 ratio. */
export function computeEffectDurationRatio(
  duration: number,
  maxDuration: number,
): number {
  if (maxDuration <= 0) return 0;
  return Math.max(0, Math.min(duration / maxDuration, 1));
}

/** Get color for effect type: green for buff, red for debuff. */
export function getEffectColor(type: 'buff' | 'debuff'): number {
  return type === 'buff' ? 0x44CC44 : 0xCC4444;
}

/** Format drop count label. Empty for count <= 1. */
export function formatDropLabel(count: number): string {
  if (count <= 1) return '';
  return `x${count}`;
}

// ── Constants ───────────────────────────────────────────────────

const SPEAKER_FONT_SIZE = 28;
const DIALOGUE_FONT_SIZE = 24;
const CHOICE_FONT_SIZE = 22;
const CHOICE_HEIGHT = 50;
const CHOICE_GAP = 10;
const EFFECT_ICON_SIZE = 28;
const EFFECT_GAP = 4;
const EFFECT_BAR_HEIGHT = 3;
const DROP_LIFETIME = 2.0; // seconds

// ── Drop tracking ───────────────────────────────────────────────

interface DropVisual {
  container: Container;
  lifetime: number;
  startY: number;
}

// ── RPGOverlayRenderer class ────────────────────────────────────

export class RPGOverlayRenderer {
  private container: Container;
  private canvasW: number;
  private canvasH: number;

  // Dialogue
  private dialogueBox: Container | null = null;
  private lastNodeId: string | null = null;

  // Status effects
  private effectContainer: Container | null = null;

  // Drop items
  private drops: DropVisual[] = [];

  constructor(parent: Container, canvasW: number, canvasH: number) {
    this.container = new Container();
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    parent.addChild(this.container);
  }

  sync(engine: Engine, dt: number): void {
    const dtSec = dt / 1000;
    const configAssets = engine.getConfig().assets ?? {};
    this.syncDialogue(engine, configAssets);
    this.syncStatusEffects(engine);
    this.updateDrops(dtSec);
  }

  /** Add a drop visual from event data. */
  addDrop(data: { x: number; y: number; item: string; asset?: string; count: number; type: string }, configAssets?: Record<string, { src: string }>): void {
    const wrapper = new Container();
    const assetKey = data.asset ?? data.item;
    const imageSrc = configAssets?.[assetKey]?.src;

    if (imageSrc?.startsWith('data:')) {
      loadDataUrlIntoContainer(wrapper, imageSrc, 28);
    } else {
      const emoji = this.getDropEmoji(data.type);
      const text = new Text({
        text: emoji,
        style: new TextStyle({ fontSize: 28 }),
      });
      text.anchor.set(0.5);
      wrapper.addChild(text);
    }

    const countLabel = formatDropLabel(data.count);
    if (countLabel) {
      const countText = new Text({
        text: countLabel,
        style: new TextStyle({
          fontSize: 16,
          fill: 0xFFFFFF,
          fontWeight: 'bold',
          stroke: { color: 0x000000, width: 2 },
        }),
      });
      countText.anchor.set(0.5);
      countText.y = 20;
      wrapper.addChild(countText);
    }

    wrapper.x = data.x;
    wrapper.y = data.y;
    this.container.addChild(wrapper);

    this.drops.push({
      container: wrapper,
      lifetime: DROP_LIFETIME,
      startY: data.y,
    });
  }

  private getDropEmoji(type: string): string {
    switch (type) {
      case 'health': return '❤️';
      case 'equipment': return '🎁';
      case 'xp': return '✨';
      default: return '💰';
    }
  }

  private syncDialogue(engine: Engine, configAssets: Record<string, { src: string }>): void {
    const dialogue = engine.getModulesByType('DialogueSystem')[0] as DialogueSystem | undefined;
    if (!dialogue) {
      this.hideDialogue();
      return;
    }

    const node = dialogue.getCurrentNode();
    if (!node) {
      this.hideDialogue();
      return;
    }

    // Only rebuild if node changed
    if (node.id === this.lastNodeId && this.dialogueBox) return;
    this.lastNodeId = node.id;

    this.hideDialogue();
    this.dialogueBox = this.buildDialogueBox(node, dialogue, configAssets);
    this.container.addChild(this.dialogueBox);
  }

  private buildDialogueBox(node: DialogueNode, dialogue: DialogueSystem, configAssets?: Record<string, { src: string }>): Container {
    const box = new Container();
    const layout = computeDialogueBoxLayout(this.canvasW, this.canvasH);

    // Semi-transparent background
    const bg = new Graphics();
    bg.rect(layout.x, layout.y, layout.width, layout.height)
      .fill({ color: 0x000000, alpha: 0.7 });
    box.addChild(bg);

    // Portrait (if available)
    const PORTRAIT_SIZE = 64;
    let textOffsetX = 0;
    if (node.portrait) {
      const portraitSrc = configAssets?.[node.portrait]?.src;
      if (portraitSrc?.startsWith('data:')) {
        const portraitContainer = new Container();
        portraitContainer.x = layout.textX;
        portraitContainer.y = layout.textY;
        loadDataUrlIntoContainer(portraitContainer, portraitSrc, PORTRAIT_SIZE);
        box.addChild(portraitContainer);
        textOffsetX = PORTRAIT_SIZE + 10;
      }
    }

    // Speaker name
    const speakerText = new Text({
      text: node.speaker,
      style: new TextStyle({
        fontSize: SPEAKER_FONT_SIZE,
        fill: 0x00BFFF,
        fontWeight: 'bold',
      }),
    });
    speakerText.x = layout.textX + textOffsetX;
    speakerText.y = layout.textY;
    box.addChild(speakerText);

    // Dialogue text
    const dialogueText = new Text({
      text: node.text,
      style: new TextStyle({
        fontSize: DIALOGUE_FONT_SIZE,
        fill: 0xFFFFFF,
        wordWrap: true,
        wordWrapWidth: layout.textWidth,
      }),
    });
    dialogueText.x = layout.textX;
    dialogueText.y = layout.textY + SPEAKER_FONT_SIZE + 10;
    box.addChild(dialogueText);

    // Choices or "tap to continue"
    if (node.choices && node.choices.length > 0) {
      const choiceStartY = layout.y + layout.height - (node.choices.length * (CHOICE_HEIGHT + CHOICE_GAP)) - DIALOGUE_PADDING;
      for (let i = 0; i < node.choices.length; i++) {
        const choice = node.choices[i];
        const choiceContainer = new Container();
        const choiceBg = new Graphics();
        choiceBg.roundRect(
          layout.textX,
          0,
          layout.textWidth,
          CHOICE_HEIGHT,
          8,
        ).fill({ color: 0x333333, alpha: 0.8 });
        choiceContainer.addChild(choiceBg);

        const choiceText = new Text({
          text: choice.text,
          style: new TextStyle({
            fontSize: CHOICE_FONT_SIZE,
            fill: 0xFFFFFF,
          }),
        });
        choiceText.x = layout.textX + 15;
        choiceText.y = (CHOICE_HEIGHT - CHOICE_FONT_SIZE) / 2;
        choiceContainer.addChild(choiceText);

        choiceContainer.y = choiceStartY + i * (CHOICE_HEIGHT + CHOICE_GAP);
        choiceContainer.eventMode = 'static';
        choiceContainer.cursor = 'pointer';
        choiceContainer.on('pointerdown', () => {
          dialogue?.selectChoice(i);
        });
        box.addChild(choiceContainer);
      }
    } else {
      // "Tap to continue" hint
      const hintText = new Text({
        text: '[ tap to continue ]',
        style: new TextStyle({
          fontSize: 18,
          fill: 0x888888,
          fontStyle: 'italic',
        }),
      });
      hintText.anchor.set(0.5, 1);
      hintText.x = this.canvasW / 2;
      hintText.y = layout.y + layout.height - 15;
      box.addChild(hintText);
    }

    return box;
  }

  private hideDialogue(): void {
    if (this.dialogueBox) {
      this.container.removeChild(this.dialogueBox);
      this.dialogueBox.destroy();
      this.dialogueBox = null;
      this.lastNodeId = null;
    }
  }

  private syncStatusEffects(engine: Engine): void {
    const statusEffect = engine.getModulesByType('StatusEffect')[0] as StatusEffect | undefined;
    if (!statusEffect) {
      if (this.effectContainer) {
        this.effectContainer.visible = false;
      }
      return;
    }

    const effects = statusEffect.getActiveEffects();
    if (effects.length === 0) {
      if (this.effectContainer) {
        this.effectContainer.visible = false;
      }
      return;
    }

    if (!this.effectContainer) {
      this.effectContainer = new Container();
      this.container.addChild(this.effectContainer);
    }

    this.effectContainer.removeChildren();
    this.effectContainer.visible = true;

    // Position: top-right area, below score
    const startX = this.canvasW - 20;
    const startY = 120;

    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      const x = startX - (i + 1) * (EFFECT_ICON_SIZE + EFFECT_GAP);
      const y = startY;

      const color = getEffectColor(effect.type);

      // Icon background
      const iconBg = new Graphics();
      iconBg.roundRect(x, y, EFFECT_ICON_SIZE, EFFECT_ICON_SIZE, 4)
        .fill({ color, alpha: 0.7 });
      this.effectContainer.addChild(iconBg);

      // Effect abbreviation
      const abbr = effect.name.substring(0, 2).toUpperCase();
      const text = new Text({
        text: abbr,
        style: new TextStyle({
          fontSize: 14,
          fill: 0xFFFFFF,
          fontWeight: 'bold',
        }),
      });
      text.x = x + EFFECT_ICON_SIZE / 2;
      text.y = y + EFFECT_ICON_SIZE / 2;
      text.anchor.set(0.5);
      this.effectContainer.addChild(text);

      // Duration bar
      const ratio = computeEffectDurationRatio(effect.duration, effect.maxDuration);
      const barWidth = EFFECT_ICON_SIZE * ratio;
      if (barWidth > 0) {
        const bar = new Graphics();
        bar.rect(x, y + EFFECT_ICON_SIZE + 2, barWidth, EFFECT_BAR_HEIGHT)
          .fill({ color });
        this.effectContainer.addChild(bar);
      }

      // Stack count badge
      if (effect.stacks > 1) {
        const stackText = new Text({
          text: `${effect.stacks}`,
          style: new TextStyle({
            fontSize: 12,
            fill: 0xFFFFFF,
            fontWeight: 'bold',
            stroke: { color: 0x000000, width: 2 },
          }),
        });
        stackText.anchor.set(1, 0);
        stackText.x = x + EFFECT_ICON_SIZE;
        stackText.y = y;
        this.effectContainer.addChild(stackText);
      }
    }
  }

  private updateDrops(dtSec: number): void {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      drop.lifetime -= dtSec;

      // Drift down slightly and fade
      drop.container.y = drop.startY + (DROP_LIFETIME - drop.lifetime) * 20;
      drop.container.alpha = Math.max(0, drop.lifetime / DROP_LIFETIME);

      if (drop.lifetime <= 0) {
        this.container.removeChild(drop.container);
        drop.container.destroy();
        this.drops.splice(i, 1);
      }
    }
  }

  reset(): void {
    this.hideDialogue();

    if (this.effectContainer) {
      this.container.removeChild(this.effectContainer);
      this.effectContainer.destroy();
      this.effectContainer = null;
    }

    for (const drop of this.drops) {
      this.container.removeChild(drop.container);
      drop.container.destroy();
    }
    this.drops = [];
  }

  destroy(): void {
    this.reset();
    this.container.destroy();
  }
}
