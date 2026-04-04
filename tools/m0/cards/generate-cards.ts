// tools/m0/cards/generate-cards.ts
// Generates knowledge cards for ConversationAgent from taxonomy, recipes, and calibrations.

import type { TaxonomyV2 } from '../taxonomy/game-types-v2';
import type { Recipe } from '../recipes/recipe-types';
import type { CanonicalParams } from '../calibration/extract-params';
import { calibrate } from '../calibration/calibrate';

export interface GameTypeCard {
  readonly id: string;
  readonly displayName: string;
  readonly group: string;
  readonly description: string;
  readonly supportedToday: boolean;
  readonly topModules: readonly string[];
  readonly missingModules: readonly string[];
  readonly evidence: string;
  readonly signatureParams: Record<string, { suggested: number; confidence: number }>;
  readonly expertDataCount: number;
}

export interface RecipeCard {
  readonly id: string;
  readonly source: string;
  readonly description: string;
  readonly stepCount: number;
  readonly complexity: 'S' | 'M' | 'L';
  readonly commands: readonly string[];
  readonly decomposeInputs: readonly string[];
}

export function generateGameTypeCards(
  taxonomy: TaxonomyV2,
  paramsByExpertType: Map<string, CanonicalParams[]>,
): GameTypeCard[] {
  return taxonomy.types.map((t) => {
    // Find matching expert params (fuzzy match on expert type keys)
    const expertParams = findExpertParams(t.id, t.evidence, paramsByExpertType);
    const signatureParams: Record<string, { suggested: number; confidence: number }> = {};

    if (expertParams.length > 0) {
      for (const key of ['object_count', 'collider_count', 'complexity_score', 'canvas_coverage']) {
        const result = calibrate(expertParams, key, 0);
        if (result.confidence > 0) {
          signatureParams[key] = { suggested: result.suggested, confidence: result.confidence };
        }
      }
    }

    return {
      id: `gametype-${t.id}`,
      displayName: t.displayName,
      group: t.group,
      description: t.description,
      supportedToday: t.supportedToday,
      topModules: [...t.requiredModules].slice(0, 5),
      missingModules: [...t.missingModules],
      evidence: t.evidence,
      signatureParams,
      expertDataCount: expertParams.length,
    };
  });
}

export function generateRecipeCards(recipes: readonly Recipe[]): RecipeCard[] {
  return recipes.map((r) => ({
    id: `recipe-${r.id}`,
    source: r.source,
    description: r.description,
    stepCount: r.steps.length,
    complexity: r.estimatedComplexity,
    commands: [...new Set(r.steps.map((s) => s.command))],
    decomposeInputs: [...r.decomposeInputs],
  }));
}

// --- Helpers ---

function findExpertParams(
  aigeType: string,
  evidence: string,
  paramsByExpertType: Map<string, CanonicalParams[]>,
): CanonicalParams[] {
  // Direct match on expert type keys containing the AIGE type name
  const collected: CanonicalParams[] = [];
  const searchTerms = [
    aigeType.toLowerCase(),
    ...evidence.toLowerCase().split(/[,\s]+/).filter((s) => s.length > 3),
  ];

  for (const [expertType, params] of paramsByExpertType) {
    const normalized = expertType.toLowerCase();
    if (searchTerms.some((term) => normalized.includes(term) || term.includes(normalized))) {
      collected.push(...params);
    }
  }

  return collected;
}
