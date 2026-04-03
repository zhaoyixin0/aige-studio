/**
 * Conservative dependency name resolver for the parameter DAG.
 *
 * Resolution order (first match wins):
 *   1. Exact name match
 *   2. Normalized equality — strip punctuation, whitespace, case
 *   3. Suffix-stripped match — strip common Chinese suffixes (系统/模式/设置/效果)
 *      from both sides and compare normalized forms
 *   4. No match — return undefined (caller should emit a warning and skip)
 *
 * IMPORTANT: No substring / includes / token-overlap matching.
 * That approach created wrong DAG edges (issue H2).
 */

const STRIP_SUFFIXES = ['系统', '模式', '设置', '效果'] as const;

/**
 * Normalize a name by stripping punctuation, whitespace, and lowercasing.
 */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * Strip common Chinese suffixes from a name.
 * Returns the stripped form, or the original if no suffix matched
 * or stripping would leave an empty string.
 */
export function stripSuffix(name: string): string {
  const trimmed = name.trim();
  for (const suffix of STRIP_SUFFIXES) {
    if (trimmed.endsWith(suffix) && trimmed.length > suffix.length) {
      return trimmed.slice(0, -suffix.length);
    }
  }
  return trimmed;
}

export interface ResolveResult {
  readonly id?: string;
  readonly ambiguity?: string;
}

/**
 * Resolve a dependency name to a parameter ID using conservative matching.
 *
 * Returns { id } on match, { ambiguity } on ambiguous suffix match,
 * or {} when no match is found.
 */
export function resolveDependencyName(
  nameToId: ReadonlyMap<string, string>,
  depName: string,
): ResolveResult {
  // Step 1: exact match
  const exact = nameToId.get(depName);
  if (exact) return { id: exact };

  // Step 2: normalized equality
  const targetNorm = normalizeName(depName);
  for (const [name, id] of nameToId) {
    if (normalizeName(name) === targetNorm) return { id };
  }

  // Step 3: suffix-stripped match
  // Normalize the stripped target
  const targetStripped = normalizeName(stripSuffix(depName));
  const candidates: Array<{ id: string; name: string }> = [];

  for (const [name, id] of nameToId) {
    const nameStripped = normalizeName(stripSuffix(name));
    if (nameStripped === targetStripped) {
      candidates.push({ id, name });
    }
  }

  if (candidates.length === 1) return { id: candidates[0].id };
  if (candidates.length > 1) {
    return {
      ambiguity: `ambiguous: ${depName} -> ${candidates.map((c) => `${c.name}(${c.id})`).join(', ')}`,
    };
  }

  // Step 4: no match
  return {};
}
