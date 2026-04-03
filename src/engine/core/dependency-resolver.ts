// Parameter dependency DAG resolver with cycle detection
// Pure functions — no side effects, no mutation

import type { ParameterMeta } from '../../data/parameter-registry';

export interface ParamVisibility {
  readonly visible: boolean;
  readonly enabled: boolean;
}

interface DagValidationResult {
  readonly valid: boolean;
  readonly cyclePath?: readonly string[];
}

export function isTruthy(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value === null || value === undefined) return false;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === '' || v === '0') return false;
    if (['false', 'no', 'off', 'disabled', '关闭', '隐藏'].includes(v)) return false;
    if (['true', 'yes', 'on', 'enabled', '开启', '显示'].includes(v)) return true;
    return v.length > 0; // non-empty string treated as truthy
  }
  return Boolean(value);
}

export function matchesCondition(condition: string, parentValue: unknown): boolean {
  const c = condition.trim().toLowerCase();

  // Wildcards / any
  if (c === '任意' || c === 'any' || c === '*') return true;

  // Truthy / Falsy keywords (multi-lingual)
  if (['开启', '显示', 'on', 'enabled', 'true', 'yes', 'visible'].includes(c)) {
    return isTruthy(parentValue);
  }
  if (['关闭', '隐藏', 'off', 'disabled', 'false', 'no', 'hidden'].includes(c)) {
    return !isTruthy(parentValue);
  }

  // Emptiness checks
  if (c === 'empty' || c === '空') {
    return parentValue === null || parentValue === undefined || (typeof parentValue === 'string' && parentValue.trim() === '');
  }
  if (c === 'not-empty' || c === '非空') {
    return !(parentValue === null || parentValue === undefined || (typeof parentValue === 'string' && parentValue.trim() === ''));
  }

  // Default: string-insensitive equality, else strict
  if (typeof parentValue === 'string') {
    return parentValue.trim().toLowerCase() === c;
  }
  return parentValue === condition;
}

/**
 * Validate that the parameter dependency graph is a DAG (no cycles).
 * Uses Kahn's algorithm for topological sort.
 */
export function validateDag(
  params: readonly ParameterMeta[]
): DagValidationResult {
  if (params.length === 0) return { valid: true };

  const paramIds = new Set(params.map((p) => p.id));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const p of params) { inDegree.set(p.id, 0); adjacency.set(p.id, []); }
  for (const p of params) {
    if (!p.dependsOn || !paramIds.has(p.dependsOn.paramId)) continue;
    adjacency.get(p.dependsOn.paramId)!.push(p.id);
    inDegree.set(p.id, (inDegree.get(p.id) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) { if (deg === 0) queue.push(id); }

  let processed = 0;
  while (queue.length > 0) {
    const node = queue.shift()!;
    processed++;
    for (const child of adjacency.get(node) ?? []) {
      const newDeg = (inDegree.get(child) ?? 1) - 1;
      inDegree.set(child, newDeg);
      if (newDeg === 0) queue.push(child);
    }
  }

  if (processed === params.length) return { valid: true };

  const remaining = new Set<string>();
  for (const [id, deg] of inDegree) { if (deg > 0) remaining.add(id); }
  return { valid: false, cyclePath: findCycleDfs(remaining, adjacency) };
}

function findCycleDfs(
  remaining: ReadonlySet<string>,
  adjacency: ReadonlyMap<string, string[]>
): string[] {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const parent = new Map<string, string>();

  for (const startNode of remaining) {
    if (visited.has(startNode)) continue;
    const cycle = dfsVisit(startNode, adjacency, remaining, visited, stack, parent);
    if (cycle) return cycle;
  }
  return [...remaining]; // fallback
}

function dfsVisit(
  node: string,
  adjacency: ReadonlyMap<string, string[]>,
  remaining: ReadonlySet<string>,
  visited: Set<string>,
  stack: Set<string>,
  parent: Map<string, string>
): string[] | null {
  visited.add(node);
  stack.add(node);

  for (const child of adjacency.get(node) ?? []) {
    if (!remaining.has(child)) continue;
    if (!visited.has(child)) {
      parent.set(child, node);
      const cycle = dfsVisit(child, adjacency, remaining, visited, stack, parent);
      if (cycle) return cycle;
    } else if (stack.has(child)) {
      // Reconstruct cycle
      const path: string[] = [child];
      let cur = node;
      while (cur !== child) {
        path.push(cur);
        cur = parent.get(cur)!;
      }
      path.push(child);
      return path.reverse();
    }
  }

  stack.delete(node);
  return null;
}

/**
 * Resolve visibility for all params based on current values and dependency conditions.
 * If a parent is hidden or its value doesn't match the condition, the child is hidden+disabled.
 * Propagation: if a parent is hidden, all descendants are hidden regardless of values.
 */
export function resolveVisibility(
  params: readonly ParameterMeta[],
  currentValues: ReadonlyMap<string, unknown>
): Map<string, ParamVisibility> {
  const result = new Map<string, ParamVisibility>();
  if (params.length === 0) return result;

  const byId = new Map<string, ParameterMeta>(params.map((p) => [p.id, p]));
  const memo = new Map<string, ParamVisibility>();
  const VISIBLE: ParamVisibility = { visible: true, enabled: true };
  const HIDDEN: ParamVisibility = { visible: false, enabled: false };

  function resolve(id: string): ParamVisibility {
    const cached = memo.get(id);
    if (cached) return cached;

    const param = byId.get(id);
    if (!param || !param.dependsOn || !byId.has(param.dependsOn.paramId)) {
      memo.set(id, VISIBLE);
      return VISIBLE;
    }

    const parentVis = resolve(param.dependsOn.paramId);
    if (!parentVis.visible) { memo.set(id, HIDDEN); return HIDDEN; }

    const parentValue = currentValues.get(param.dependsOn.paramId);
    const vis = matchesCondition(param.dependsOn.condition, parentValue) ? VISIBLE : HIDDEN;
    memo.set(id, vis);
    return vis;
  }

  for (const param of params) {
    result.set(param.id, resolve(param.id));
  }

  return result;
}
