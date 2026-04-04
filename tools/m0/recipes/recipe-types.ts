// tools/m0/recipes/recipe-types.ts
// Structured recipe definitions.

export interface RecipeStep {
  readonly index: number;
  readonly command: string; // AIGE-mapped command name
  readonly originalCommand: string; // Effect House command name
  readonly args: Record<string, unknown>;
  readonly comment?: string;
}

export interface Recipe {
  readonly id: string;
  readonly source: string; // "command:<filename>" or "template:<filename>"
  readonly description: string;
  readonly steps: readonly RecipeStep[];
  readonly decomposeInputs: readonly string[];
  readonly estimatedComplexity: 'S' | 'M' | 'L';
}
