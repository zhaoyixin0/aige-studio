import { useMemo } from 'react';
import { getParamById } from '@/data/parameter-registry';
import type { ParameterMeta } from '@/data/parameter-registry';

/**
 * Resolves paramIds to ParameterMeta entries and builds a lookup map.
 * Shared by all bespoke cards to avoid duplicated memoization logic.
 */
export function useResolvedParams(paramIds: readonly string[]) {
  const resolvedParams = useMemo(
    () =>
      paramIds
        .map((id) => getParamById(id))
        .filter((p): p is ParameterMeta => p !== undefined),
    [paramIds],
  );

  const byId = useMemo(
    () => new Map(resolvedParams.map((p) => [p.id, p])),
    [resolvedParams],
  );

  return { resolvedParams, byId } as const;
}
