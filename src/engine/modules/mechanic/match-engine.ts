import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export interface MatchCell {
  id: number;
  value: number;
  revealed: boolean;
  matched: boolean;
}

export class MatchEngine extends BaseModule {
  readonly type = 'MatchEngine';

  private grid: MatchCell[] = [];
  private selected: number[] = [];
  private matchesFound = 0;
  private totalPairs = 0;
  private started = false;

  getSchema(): ModuleSchema {
    return {
      gridCols: {
        type: 'range',
        label: 'Grid Columns',
        default: 4,
        min: 2,
        max: 6,
        step: 1,
      },
      gridRows: {
        type: 'range',
        label: 'Grid Rows',
        default: 4,
        min: 2,
        max: 6,
        step: 1,
      },
      matchCount: {
        type: 'range',
        label: 'Match Count',
        default: 2,
        min: 2,
        max: 3,
        step: 1,
      },
      shuffleOnFail: {
        type: 'boolean',
        label: 'Shuffle on Fail',
        default: false,
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on('input:touch:tap', (data?: any) => {
      if (data?.cellIndex !== undefined) {
        this.selectCell(data.cellIndex);
      }
    });
  }

  start(): void {
    this.started = true;
    this.matchesFound = 0;
    this.selected = [];
    this.generateGrid();
  }

  private generateGrid(): void {
    const cols = this.params.gridCols ?? 4;
    const rows = this.params.gridRows ?? 4;
    const matchCount = this.params.matchCount ?? 2;
    const totalCells = cols * rows;
    const numValues = Math.floor(totalCells / matchCount);
    this.totalPairs = numValues;

    // Create cells with paired values
    const values: number[] = [];
    for (let v = 0; v < numValues; v++) {
      for (let m = 0; m < matchCount; m++) {
        values.push(v);
      }
    }

    // Fill any remaining slots with extra values
    while (values.length < totalCells) {
      values.push(values.length % numValues);
    }

    // Shuffle
    this.shuffleArray(values);

    this.grid = values.map((value, index) => ({
      id: index,
      value,
      revealed: false,
      matched: false,
    }));
  }

  private shuffleArray(arr: number[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  selectCell(index: number): void {
    if (!this.started) return;

    const cell = this.grid[index];
    if (!cell || cell.revealed || cell.matched) return;

    const matchCount = this.params.matchCount ?? 2;

    cell.revealed = true;
    this.selected.push(index);

    if (this.selected.length >= matchCount) {
      this.checkMatch();
    }
  }

  private checkMatch(): void {
    const matchCount = this.params.matchCount ?? 2;
    const selectedCells = this.selected.map((i) => this.grid[i]);

    // Check if all selected have the same value
    const firstValue = selectedCells[0].value;
    const isMatch = selectedCells.every((c) => c.value === firstValue);

    if (isMatch) {
      for (const cell of selectedCells) {
        cell.matched = true;
      }
      this.matchesFound++;

      this.emit('match:found', {
        value: firstValue,
        cells: this.selected.slice(),
        matchesFound: this.matchesFound,
        totalPairs: this.totalPairs,
      });

      this.selected = [];

      // Check if game is complete
      if (this.matchesFound >= this.totalPairs) {
        this.emit('match:complete', {
          totalPairs: this.totalPairs,
        });
        this.started = false;
      }
    } else {
      this.emit('match:fail', {
        cells: this.selected.slice(),
      });

      // Hide unmatched cells
      for (const cell of selectedCells) {
        if (!cell.matched) {
          cell.revealed = false;
        }
      }
      this.selected = [];

      if (this.params.shuffleOnFail) {
        this.shuffleUnmatched();
      }
    }
  }

  private shuffleUnmatched(): void {
    const unmatched = this.grid.filter((c) => !c.matched);
    const values = unmatched.map((c) => c.value);
    this.shuffleArray(values);
    unmatched.forEach((c, i) => {
      c.value = values[i];
    });
  }

  getGrid(): MatchCell[] {
    return this.grid.map((c) => ({ ...c }));
  }

  getGridCols(): number {
    return (this.params.gridCols as number) ?? 4;
  }

  getGridRows(): number {
    return (this.params.gridRows as number) ?? 4;
  }

  getSelectedCells(): number[] {
    return [...this.selected];
  }

  getMatchesFound(): number {
    return this.matchesFound;
  }

  getTotalPairs(): number {
    return this.totalPairs;
  }

  update(_dt: number): void {
    // Event-driven — no-op
  }

  reset(): void {
    this.grid = [];
    this.selected = [];
    this.matchesFound = 0;
    this.totalPairs = 0;
    this.started = false;
  }
}
