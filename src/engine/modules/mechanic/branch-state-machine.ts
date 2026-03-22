import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export interface BranchChoice {
  label: string;
  target: string;
}

export interface BranchState {
  text: string;
  choices: BranchChoice[];
}

export class BranchStateMachine extends BaseModule {
  readonly type = 'BranchStateMachine';

  private currentState: string | null = null;
  private started = false;

  getSchema(): ModuleSchema {
    return {
      states: {
        type: 'object',
        label: 'State Tree',
        default: {},
      },
      startState: {
        type: 'string',
        label: 'Start State',
        default: 'start',
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on('touch:tap', (data?: any) => {
      if (data?.choiceIndex !== undefined) {
        this.choose(data.choiceIndex);
      }
    });
  }

  start(): void {
    this.started = true;
    const startState = this.params.startState ?? 'start';
    this.goToState(startState);
  }

  goToState(stateId: string): void {
    const states: Record<string, BranchState> = this.params.states ?? {};
    const state = states[stateId];

    if (!state) {
      // State not found — end
      this.started = false;
      this.emit('branch:end', { reason: 'state_not_found', stateId });
      return;
    }

    const prevState = this.currentState;
    this.currentState = stateId;

    this.emit('branch:stateChange', {
      from: prevState,
      to: stateId,
      text: state.text,
      choices: state.choices,
    });

    // If no choices, this is an end state
    if (!state.choices || state.choices.length === 0) {
      this.started = false;
      this.emit('branch:end', { stateId, text: state.text });
    }
  }

  choose(choiceIndex: number): void {
    if (!this.started || !this.currentState) return;

    const states: Record<string, BranchState> = this.params.states ?? {};
    const state = states[this.currentState];
    if (!state) return;

    const choices = state.choices ?? [];
    if (choiceIndex < 0 || choiceIndex >= choices.length) return;

    const choice = choices[choiceIndex];

    this.emit('branch:choice', {
      stateId: this.currentState,
      choiceIndex,
      label: choice.label,
      target: choice.target,
    });

    this.goToState(choice.target);
  }

  getCurrentState(): string | null {
    return this.currentState;
  }

  getCurrentStateData(): BranchState | null {
    if (!this.currentState) return null;
    const states: Record<string, BranchState> = this.params.states ?? {};
    return states[this.currentState] ?? null;
  }

  isStarted(): boolean {
    return this.started;
  }

  update(_dt: number): void {
    // Event-driven — no-op
  }

  reset(): void {
    this.currentState = null;
    this.started = false;
  }
}
