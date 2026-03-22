import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/engine/core';
import { MatchEngine } from '../mechanic/match-engine';

describe('MatchEngine', () => {
  function setup(params: Record<string, any> = {}) {
    const engine = new Engine();
    const match = new MatchEngine('match-1', params);
    engine.addModule(match);
    return { engine, match };
  }

  it('should generate a grid on start', () => {
    const { match } = setup({ gridCols: 4, gridRows: 4, matchCount: 2 });
    match.start();

    const grid = match.getGrid();
    expect(grid).toHaveLength(16);
    expect(grid.every((c) => !c.revealed && !c.matched)).toBe(true);
  });

  it('should emit match:found when matching cells selected', () => {
    const { engine, match } = setup({ gridCols: 2, gridRows: 2, matchCount: 2 });
    const foundHandler = vi.fn();
    engine.eventBus.on('match:found', foundHandler);

    match.start();

    // Find two cells with the same value
    const grid = match.getGrid();
    const firstValue = grid[0].value;
    const pairIndex = grid.findIndex((c, i) => i > 0 && c.value === firstValue);

    match.selectCell(0);
    match.selectCell(pairIndex);

    expect(foundHandler).toHaveBeenCalledWith(
      expect.objectContaining({ value: firstValue }),
    );
  });

  it('should emit match:fail when non-matching cells selected', () => {
    const { engine, match } = setup({ gridCols: 2, gridRows: 2, matchCount: 2 });
    const failHandler = vi.fn();
    engine.eventBus.on('match:fail', failHandler);

    match.start();

    // Find two cells with different values
    const grid = match.getGrid();
    const firstValue = grid[0].value;
    const diffIndex = grid.findIndex((c, i) => i > 0 && c.value !== firstValue);

    if (diffIndex !== -1) {
      match.selectCell(0);
      match.selectCell(diffIndex);
      expect(failHandler).toHaveBeenCalled();
    }
  });

  it('should emit match:complete when all pairs found', () => {
    const { engine, match } = setup({ gridCols: 2, gridRows: 2, matchCount: 2 });
    const completeHandler = vi.fn();
    engine.eventBus.on('match:complete', completeHandler);

    match.start();

    const grid = match.getGrid();
    // Group cells by value
    const groups = new Map<number, number[]>();
    for (const cell of grid) {
      const arr = groups.get(cell.value) ?? [];
      arr.push(cell.id);
      groups.set(cell.value, arr);
    }

    // Match all pairs
    for (const [, indices] of groups) {
      for (const idx of indices) {
        match.selectCell(idx);
      }
    }

    expect(completeHandler).toHaveBeenCalled();
  });
});
