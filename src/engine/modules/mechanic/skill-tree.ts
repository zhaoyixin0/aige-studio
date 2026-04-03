import type { GameEngine, ModuleSchema } from '@/engine/core';
import type { ModuleContracts } from '@/engine/core/contracts';
import { BaseModule } from '../base-module';

export interface SkillDef {
  id: string;
  name: string;
  prerequisites: string[];
  cost: number;
  cooldown: number;
  effect: string;
  effectData: Record<string, any>;
}

interface UnlockedSkill {
  def: SkillDef;
  cooldownRemaining: number;
}

export class SkillTree extends BaseModule {
  readonly type = 'SkillTree';

  private availablePoints = 0;
  private unlockedSkills: Map<string, UnlockedSkill> = new Map();

  getSchema(): ModuleSchema {
    return {
      skills: {
        type: 'object',
        label: 'Skill Definitions',
        default: [],
      },
      pointsPerLevel: {
        type: 'range',
        label: 'Points Per Level',
        default: 1,
        min: 1,
        max: 5,
        step: 1,
      },
      activateEvent: {
        type: 'string',
        label: 'Activate Event',
        default: 'input:touch:doubleTap',
      },
      selectedSkillIndex: {
        type: 'range',
        label: 'Selected Skill Index',
        default: 0,
        min: 0,
        max: 10,
        step: 1,
      },
    };
  }

  getContracts(): ModuleContracts {
    // NOTE: skill effect events (entry.def.effect) are dynamic — not statically declarable
    const activateEvent: string = (this.params.activateEvent as string) ?? 'input:touch:doubleTap';
    return {
      emits: ['skill:unlock', 'skill:activate', 'skill:cooldown'],
      consumes: ['levelup:levelup', activateEvent],
    };
  }

  init(engine: GameEngine): void {
    super.init(engine);

    this.on('levelup:levelup', (data?: any) => {
      if (data && typeof data.skillPoints === 'number') {
        this.availablePoints += data.skillPoints;
      }
    });

    const activateEvent: string = (this.params.activateEvent as string) ?? 'input:touch:doubleTap';
    this.on(activateEvent, () => {
      const skills = this.getSkillDefs();
      const index: number = (this.params.selectedSkillIndex as number) ?? 0;
      const skill = skills[index];
      if (skill) {
        this.activateSkill(skill.id);
      }
    });
  }

  unlockSkill(skillId: string): boolean {
    const def = this.findSkillDef(skillId);
    if (!def) return false;
    if (this.unlockedSkills.has(skillId)) return false;

    for (const prereqId of def.prerequisites) {
      if (!this.unlockedSkills.has(prereqId)) return false;
    }

    if (this.availablePoints < def.cost) return false;

    this.availablePoints -= def.cost;
    this.unlockedSkills = new Map(this.unlockedSkills);
    this.unlockedSkills.set(skillId, { def, cooldownRemaining: 0 });

    this.emit('skill:unlock', { id: def.id, name: def.name });
    return true;
  }

  activateSkill(skillId: string): boolean {
    const entry = this.unlockedSkills.get(skillId);
    if (!entry) return false;

    if (entry.def.cooldown > 0 && entry.cooldownRemaining > 0) {
      this.emit('skill:cooldown', { id: skillId, remaining: entry.cooldownRemaining });
      return false;
    }

    const updated = new Map(this.unlockedSkills);
    updated.set(skillId, {
      ...entry,
      cooldownRemaining: entry.def.cooldown,
    });
    this.unlockedSkills = updated;

    this.emit('skill:activate', {
      id: entry.def.id,
      name: entry.def.name,
      effectData: entry.def.effectData,
    });
    this.emit(entry.def.effect, entry.def.effectData);
    return true;
  }

  getUnlockedSkills(): string[] {
    return Array.from(this.unlockedSkills.keys());
  }

  getAvailablePoints(): number {
    return this.availablePoints;
  }

  isUnlocked(skillId: string): boolean {
    return this.unlockedSkills.has(skillId);
  }

  getCooldownRemaining(skillId: string): number {
    return this.unlockedSkills.get(skillId)?.cooldownRemaining ?? 0;
  }

  reset(): void {
    this.availablePoints = 0;
    this.unlockedSkills = new Map();
  }

  update(dt: number): void {
    if (this.gameflowPaused) return;

    const updated = new Map(this.unlockedSkills);
    let changed = false;

    for (const [id, entry] of updated) {
      if (entry.cooldownRemaining > 0) {
        const next = Math.max(0, entry.cooldownRemaining - dt);
        updated.set(id, { ...entry, cooldownRemaining: next });
        changed = true;
      }
    }

    if (changed) {
      this.unlockedSkills = updated;
    }
  }

  private getSkillDefs(): SkillDef[] {
    const raw = this.params.skills;
    return Array.isArray(raw) ? raw : [];
  }

  private findSkillDef(skillId: string): SkillDef | undefined {
    return this.getSkillDefs().find(s => s.id === skillId);
  }
}
