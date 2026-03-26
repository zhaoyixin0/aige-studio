import type { GameEngine, ModuleSchema } from '@/engine/core';
import { BaseModule } from '../base-module';

export interface DialogueChoice {
  text: string;
  next: string;
}

export interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  choices?: DialogueChoice[];
  next?: string;
  effects?: { event: string; data: any }[];
}

export interface DialogueTree {
  id: string;
  startNode: string;
  nodes: Record<string, DialogueNode>;
}

export class DialogueSystem extends BaseModule {
  readonly type = 'DialogueSystem';

  private activeDialogueId: string | null = null;
  private currentNodeId: string | null = null;
  private dialoguePaused = false;

  getSchema(): ModuleSchema {
    return {
      dialogues: {
        type: 'object',
        label: 'Dialogue Trees',
        default: {},
      },
      triggerEvent: {
        type: 'string',
        label: 'Trigger Event',
        default: 'collision:hit',
      },
      advanceEvent: {
        type: 'string',
        label: 'Advance Event',
        default: 'input:touch:tap',
      },
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    const triggerEvent: string = this.params.triggerEvent ?? 'collision:hit';
    this.on(triggerEvent, (data?: any) => {
      if (data && typeof data.dialogueId === 'string') {
        this.startDialogue(data.dialogueId);
      }
    });

    const advanceEvent: string = this.params.advanceEvent ?? 'input:touch:tap';
    this.on(advanceEvent, () => {
      if (this.activeDialogueId !== null) {
        this.advanceNode();
      }
    });
  }

  startDialogue(dialogueId: string): boolean {
    const tree = this.getTree(dialogueId);
    if (!tree) return false;

    this.activeDialogueId = dialogueId;
    this.currentNodeId = tree.startNode;
    this.dialoguePaused = true;

    this.emit('gameflow:pause');
    this.emit('dialogue:start', {
      dialogueId,
      speaker: tree.nodes[tree.startNode]?.speaker ?? '',
    });

    this.showCurrentNode(tree);
    return true;
  }

  advanceNode(): void {
    if (!this.activeDialogueId || !this.currentNodeId) return;

    const tree = this.getTree(this.activeDialogueId);
    if (!tree) return;

    const node = tree.nodes[this.currentNodeId];
    if (!node) return;

    if (node.choices && node.choices.length > 0) {
      return;
    }

    if (node.next) {
      this.currentNodeId = node.next;
      this.showCurrentNode(tree);
    } else {
      this.endDialogue();
    }
  }

  selectChoice(index: number): void {
    if (!this.activeDialogueId || !this.currentNodeId) return;

    const tree = this.getTree(this.activeDialogueId);
    if (!tree) return;

    const node = tree.nodes[this.currentNodeId];
    if (!node || !node.choices) return;

    const choice = node.choices[index];
    if (!choice) return;

    this.emit('dialogue:choice', { nodeId: this.currentNodeId, choiceIndex: index });

    this.currentNodeId = choice.next;
    this.showCurrentNode(tree);
  }

  endDialogue(): void {
    const dialogueId = this.activeDialogueId;
    this.activeDialogueId = null;
    this.currentNodeId = null;

    if (this.dialoguePaused) {
      this.dialoguePaused = false;
      this.emit('gameflow:resume');
    }

    if (dialogueId) {
      this.emit('dialogue:end', { dialogueId });
    }
  }

  getCurrentNode(): DialogueNode | null {
    if (!this.activeDialogueId || !this.currentNodeId) return null;
    const tree = this.getTree(this.activeDialogueId);
    return tree?.nodes[this.currentNodeId] ?? null;
  }

  isActive(): boolean {
    return this.activeDialogueId !== null;
  }

  reset(): void {
    if (this.dialoguePaused) {
      this.dialoguePaused = false;
      this.emit('gameflow:resume');
    }
    this.activeDialogueId = null;
    this.currentNodeId = null;
  }

  update(_dt: number): void {
    // Dialogue is event-driven; no per-frame logic needed
  }

  private getTree(dialogueId: string): DialogueTree | undefined {
    const dialogues = this.params.dialogues ?? {};
    return dialogues[dialogueId];
  }

  private showCurrentNode(tree: DialogueTree): void {
    if (!this.currentNodeId) return;
    const node = tree.nodes[this.currentNodeId];
    if (!node) return;

    this.emit('dialogue:node', {
      nodeId: node.id,
      speaker: node.speaker,
      text: node.text,
      choices: node.choices ?? [],
    });

    if (node.effects) {
      for (const effect of node.effects) {
        this.emit(effect.event, effect.data);
      }
    }
  }
}
