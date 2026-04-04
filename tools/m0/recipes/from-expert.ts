// tools/m0/recipes/from-expert.ts
// Converts expert command sequences and templates into structured recipes.

import type { NormalizedExpert } from '../schema/expert-types';
import type { RecipeStep, Recipe } from './recipe-types';

export type { Recipe };

// Map Effect House commands → AIGE conceptual commands
const COMMAND_MAP: Record<string, string> = {
  AddSceneObjectByConfig: 'createObject',
  AddSceneObjectByConfigCommand: 'createObject',
  SetComponentProperty: 'setProperty',
  SetComponentPropertyCommand: 'setProperty',
  SetSceneObjectPropertyCommand: 'renameObject',
  SetParentOfSceneObjectCommand: 'setParent',
  AddCollider2DComponent: 'addCollider2D',
  AddRigidbody2DComponent: 'addRigidBody2D',
  DuplicateSceneObject: 'duplicateObject',
  RemoveSceneObject: 'removeObject',
  GetSceneInfo: 'queryScene',
  AddCollider3DComponent: 'addCollider3D',
  AddSceneObjectByAsset: 'createFromAsset',
  GenerateAndImport2DAssetByAI: 'generateAsset2D',
  GenerateAndImport3DAssetByAI: 'generateAsset3D',
};

function mapCommand(original: string): string {
  if (!original) return 'unknown';
  return COMMAND_MAP[original] ?? original;
}

function estimateComplexity(stepCount: number): 'S' | 'M' | 'L' {
  if (stepCount <= 10) return 'S';
  if (stepCount <= 25) return 'M';
  return 'L';
}

function slugify(name: string): string {
  return name
    .replace(/\.json$/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase();
}

function recipeFromCommand(doc: Extract<NormalizedExpert, { kind: 'command' }>): Recipe {
  const steps: RecipeStep[] = doc.steps.map((s) => ({
    index: s.index,
    command: mapCommand(s.name),
    originalCommand: s.name,
    args: s.arguments,
    comment: s.comment,
  }));

  return {
    id: slugify(doc.filename),
    source: `command:${doc.filename}`,
    description: doc.description,
    steps,
    decomposeInputs: [...doc.decomposeInputs],
    estimatedComplexity: estimateComplexity(steps.length),
  };
}

function recipeFromTemplate(doc: Extract<NormalizedExpert, { kind: 'template' }>): Recipe {
  // Templates define reusable patterns as named data
  // Convert data keys into pseudo-steps
  const data = doc.data as Record<string, unknown>;
  const entries = typeof data === 'object' && data !== null ? Object.entries(data) : [];

  const steps: RecipeStep[] = entries.length > 0
    ? entries.map(([key, value], idx) => ({
        index: idx + 1,
        command: 'applyTemplate',
        originalCommand: 'Template',
        args: { templateKey: key, data: value },
        comment: `Apply template section: ${key}`,
      }))
    : [{
        index: 1,
        command: 'applyTemplate',
        originalCommand: 'Template',
        args: { name: doc.name, data: doc.data },
        comment: `Apply full template: ${doc.name}`,
      }];

  return {
    id: `tpl-${slugify(doc.filename)}`,
    source: `template:${doc.filename}`,
    description: `Template: ${doc.name}`,
    steps,
    decomposeInputs: [],
    estimatedComplexity: 'S',
  };
}

export function buildRecipes(
  commandDocs: readonly NormalizedExpert[],
  templateDocs: readonly NormalizedExpert[],
): Recipe[] {
  const recipes: Recipe[] = [];

  for (const doc of commandDocs) {
    if (doc.kind === 'command') {
      recipes.push(recipeFromCommand(doc));
    }
  }

  for (const doc of templateDocs) {
    if (doc.kind === 'template') {
      recipes.push(recipeFromTemplate(doc));
    }
  }

  return recipes;
}
