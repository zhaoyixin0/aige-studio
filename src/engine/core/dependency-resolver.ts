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

function isTruthy(value: unknown): boolean {
  if (value === true || value === 'on' || value === '开启' || value === '显示' || value === 1) return true;
  if (typeof value === 'string') return value.length > 0;
  if (typeof value === 'number') return value !== 0;
  return false;
}

function matchesCondition(condition: string, parentValue: unknown): boolean {
  if (condition === '任意') return true;
  if (condition === '开启' || condition === '显示') return isTruthy(parentValue);
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

  function resolve(id: string): ParamVisibility {
    const cached = memo.get(id);
    if (cached) return cached;

    const param = byId.get(id);
    if (!param) {
      const vis: ParamVisibility = { visible: true, enabled: true };
      memo.set(id, vis);
      return vis;
    }

    if (!param.dependsOn || !byId.has(param.dependsOn.paramId)) {
      const vis: ParamVisibility = { visible: true, enabled: true };
      memo.set(id, vis);
      return vis;
    }

    const parentVis = resolve(param.dependsOn.paramId);

    // If parent is hidden, child is hidden (propagation)
    if (!parentVis.visible) {
      const vis: ParamVisibility = { visible: false, enabled: false };
      memo.set(id, vis);
      return vis;
    }

    // Check condition against parent's current value
    const parentValue = currentValues.get(param.dependsOn.paramId);
    const conditionMet = matchesCondition(param.dependsOn.condition, parentValue);

    const vis: ParamVisibility = conditionMet
      ? { visible: true, enabled: true }
      : { visible: false, enabled: false };
    memo.set(id, vis);
    return vis;
  }

  for (const param of params) {
    result.set(param.id, resolve(param.id));
  }

  return result;
}
