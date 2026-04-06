import type { ComponentType } from 'react';
import { GuiParamCard } from '@/ui/chat/gui-param-card';
import type { GuiParamCardProps } from '@/ui/chat/gui-param-card';
import { resolveCategory } from './category-aliases';
import { GameMechanicsCard } from './game-mechanics-card';
import { VisualAudioCard } from './visual-audio-card';

/**
 * Registry of bespoke card components keyed by canonical ParamCategory.
 * Categories not listed here fall back to the generic GuiParamCard.
 */
const BESPOKE_REGISTRY: Readonly<Record<string, ComponentType<GuiParamCardProps>>> = {
  game_mechanics: GameMechanicsCard,
  visual_audio: VisualAudioCard,
};

/**
 * Routes to a bespoke L2 card by category (with alias resolution),
 * or falls back to the generic GuiParamCard for unknown categories.
 */
export function BespokeParamCard(props: GuiParamCardProps) {
  const canonical = resolveCategory(props.category);
  const Card = BESPOKE_REGISTRY[canonical];

  if (Card) {
    return <Card {...props} category={canonical} />;
  }

  return <GuiParamCard {...props} />;
}
