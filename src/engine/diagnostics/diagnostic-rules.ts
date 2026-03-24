import type { Engine } from '@/engine/core/engine';
import type { EventRecorder } from './event-recorder';
import type { GameConfig } from '@/engine/core';
import type { GameFlow } from '@/engine/modules/feedback/game-flow';
import type { Scorer } from '@/engine/modules/mechanic/scorer';
import type { Lives } from '@/engine/modules/mechanic/lives';
import type { Timer } from '@/engine/modules/mechanic/timer';
import {
  GAMEFLOW_STATE, GAMEFLOW_RESUME, GAMEFLOW_PAUSE,
  COLLISION_HIT, COLLISION_DAMAGE, SCORER_UPDATE,
  TIMER_END, LIVES_CHANGE, LIVES_ZERO,
} from '@/engine/core/events';

export interface DiagnosticIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'crash' | 'orphan-event' | 'broken-chain' | 'state-anomaly' | 'performance' | 'dependency';
  module?: string;
  message: string;
  detail?: any;
}

export interface DiagnosticReport {
  issues: DiagnosticIssue[];
  errors: DiagnosticIssue[];
  warnings: DiagnosticIssue[];
  infos: DiagnosticIssue[];
  eventCount: number;
  durationMs: number;
  topEvents: Array<{ event: string; count: number }>;
}

type DiagnosticRule = (engine: Engine, recorder: EventRecorder, config: GameConfig) => DiagnosticIssue[];

// ── Rule 1: Orphan Event Detector ──────────────────────────
const orphanEventRule: DiagnosticRule = (_engine, recorder) => {
  const issues: DiagnosticIssue[] = [];
  const orphans = recorder.getOrphaned();

  // Ignore gameflow events (always emitted even if no custom listeners)
  const ignore = new Set([GAMEFLOW_STATE, GAMEFLOW_RESUME, GAMEFLOW_PAUSE]);

  for (const [event, count] of orphans) {
    if (ignore.has(event)) continue;
    issues.push({
      severity: count > 20 ? 'warning' : 'info',
      category: 'orphan-event',
      message: `"${event}" emitted ${count} times with 0 listeners`,
    });
  }
  return issues;
};

// ── Rule 2: Event Chain Break Detector ─────────────────────
const chainBreakRule: DiagnosticRule = (engine, recorder, config) => {
  const issues: DiagnosticIssue[] = [];
  const moduleTypes = new Set(config.modules.filter((m) => m.enabled).map((m) => m.type));

  // Expected chains: if A module exists and emits event X, B module should respond with Y
  const chains: Array<{ needs: string[]; from: string; to: string; label: string }> = [
    { needs: ['Collision', 'Scorer'], from: COLLISION_HIT, to: SCORER_UPDATE, label: 'Collision → Scorer' },
    { needs: ['Collision', 'Lives'], from: COLLISION_DAMAGE, to: LIVES_CHANGE, label: 'Collision → Lives' },
    { needs: ['Timer', 'GameFlow'], from: TIMER_END, to: GAMEFLOW_STATE, label: 'Timer → GameFlow' },
    { needs: ['Lives', 'GameFlow'], from: LIVES_ZERO, to: GAMEFLOW_STATE, label: 'Lives → GameFlow' },
  ];

  for (const chain of chains) {
    if (!chain.needs.every((t) => moduleTypes.has(t))) continue;

    const fromCount = recorder.countEvent(chain.from);
    const toCount = recorder.countEvent(chain.to);

    if (fromCount > 0 && toCount === 0) {
      issues.push({
        severity: 'error',
        category: 'broken-chain',
        message: `${chain.label}: "${chain.from}" fired ${fromCount}x but "${chain.to}" never fired`,
      });
    }
  }
  return issues;
};

// ── Rule 3: GameFlow Stuck Detector ────────────────────────
const gameFlowStuckRule: DiagnosticRule = (engine, recorder) => {
  const issues: DiagnosticIssue[] = [];
  const gf = engine.getModulesByType('GameFlow')[0] as GameFlow | undefined;
  if (!gf) return issues;

  const state = gf.getState();
  const duration = recorder.getDurationMs();

  if (state === 'countdown' && duration > 10000) {
    issues.push({
      severity: 'error',
      category: 'state-anomaly',
      module: 'GameFlow',
      message: `GameFlow stuck in "countdown" for ${(duration / 1000).toFixed(1)}s (expected <5s)`,
    });
  }

  if (state === 'ready' && duration > 1000) {
    issues.push({
      severity: 'warning',
      category: 'state-anomaly',
      module: 'GameFlow',
      message: `GameFlow still in "ready" after ${(duration / 1000).toFixed(1)}s — game never started`,
    });
  }

  return issues;
};

// ── Rule 4: Score Anomaly Detector ─────────────────────────
const scoreAnomalyRule: DiagnosticRule = (engine) => {
  const issues: DiagnosticIssue[] = [];

  const scorers = engine.getModulesByType('Scorer') as Scorer[];
  for (const scorer of scorers) {
    const score = (scorer as any).getScore?.(); // getScore not on interface
    if (typeof score === 'number' && score < 0) {
      issues.push({
        severity: 'error',
        category: 'state-anomaly',
        module: 'Scorer',
        message: `Score is negative: ${score}`,
      });
    }
  }

  const lives = engine.getModulesByType('Lives') as Lives[];
  for (const life of lives) {
    const current = (life as any).getCurrent?.(); // getCurrent not on interface
    if (typeof current === 'number' && current < 0) {
      issues.push({
        severity: 'error',
        category: 'state-anomaly',
        module: 'Lives',
        message: `Lives is negative: ${current}`,
      });
    }
  }

  return issues;
};

// ── Rule 5: Timer Anomaly Detector ─────────────────────────
const timerAnomalyRule: DiagnosticRule = (engine) => {
  const issues: DiagnosticIssue[] = [];

  const timers = engine.getModulesByType('Timer');
  for (const timer of timers) {
    const remaining = (timer as any).getRemaining?.();
    if (typeof remaining === 'number' && remaining < -1) {
      issues.push({
        severity: 'error',
        category: 'state-anomaly',
        module: 'Timer',
        message: `Timer remaining is deeply negative: ${remaining.toFixed(2)}s`,
      });
    }
  }

  return issues;
};

// ── Rule 6: Event Storm Detector ───────────────────────────
const eventStormRule: DiagnosticRule = (_engine, recorder) => {
  const issues: DiagnosticIssue[] = [];
  const perFrame = recorder.getEventsPerFrame();

  for (const [frame, count] of perFrame) {
    if (count > 50) {
      issues.push({
        severity: 'warning',
        category: 'performance',
        message: `Event storm: ${count} events in frame ${frame} (threshold: 50)`,
      });
      break; // Report only first occurrence
    }
  }

  return issues;
};

// ── Rule 7+8: Crash + Performance Detector (merged to avoid double update) ──
const crashAndPerfRule: DiagnosticRule = (engine) => {
  const issues: DiagnosticIssue[] = [];

  for (const mod of engine.getAllModules()) {
    const start = performance.now();
    try {
      mod.update(16);
    } catch (err) {
      issues.push({
        severity: 'error',
        category: 'crash',
        module: mod.type,
        message: `${mod.type}.update() threw: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
    const elapsed = performance.now() - start;
    if (elapsed > 5) {
      issues.push({
        severity: 'warning',
        category: 'performance',
        module: mod.type,
        message: `${mod.type}.update() took ${elapsed.toFixed(1)}ms (threshold: 5ms)`,
      });
    }
  }

  return issues;
};

// ── Rule 9: Dependency Missing Detector ────────────────────
const dependencyRule: DiagnosticRule = (engine) => {
  const issues: DiagnosticIssue[] = [];
  const moduleTypes = new Set(engine.getAllModules().map((m) => m.type));

  for (const mod of engine.getAllModules()) {
    const deps = mod.getDependencies();
    for (const req of deps.requires) {
      if (!moduleTypes.has(req)) {
        issues.push({
          severity: 'error',
          category: 'dependency',
          module: mod.type,
          message: `"${mod.type}" requires "${req}" but it is not loaded`,
        });
      }
    }
  }

  return issues;
};

// ── All rules ──────────────────────────────────────────────
const ALL_RULES: DiagnosticRule[] = [
  crashAndPerfRule,
  dependencyRule,
  orphanEventRule,
  chainBreakRule,
  gameFlowStuckRule,
  scoreAnomalyRule,
  timerAnomalyRule,
  eventStormRule,
];

// ── Main diagnostics runner ────────────────────────────────
export class ModuleDiagnostics {
  static diagnose(engine: Engine, recorder: EventRecorder, config: GameConfig): DiagnosticReport {
    const issues: DiagnosticIssue[] = [];

    for (const rule of ALL_RULES) {
      try {
        issues.push(...rule(engine, recorder, config));
      } catch (err) {
        issues.push({
          severity: 'error',
          category: 'crash',
          message: `Diagnostic rule threw: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    const freq = recorder.getEventFrequency();
    const topEvents = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([event, count]) => ({ event, count }));

    return {
      issues,
      errors: issues.filter((i) => i.severity === 'error'),
      warnings: issues.filter((i) => i.severity === 'warning'),
      infos: issues.filter((i) => i.severity === 'info'),
      eventCount: recorder.getEvents().length,
      durationMs: recorder.getDurationMs(),
      topEvents,
    };
  }

  static formatReport(report: DiagnosticReport): string {
    const lines: string[] = [];
    lines.push('');
    lines.push('🔍 Module Diagnostics Report');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (report.errors.length > 0) {
      lines.push(`\n❌ ERRORS (${report.errors.length})`);
      for (const e of report.errors) {
        lines.push(`  [${e.category}]${e.module ? ` ${e.module}:` : ''} ${e.message}`);
      }
    }

    if (report.warnings.length > 0) {
      lines.push(`\n⚠️  WARNINGS (${report.warnings.length})`);
      for (const w of report.warnings) {
        lines.push(`  [${w.category}]${w.module ? ` ${w.module}:` : ''} ${w.message}`);
      }
    }

    if (report.infos.length > 0) {
      lines.push(`\nℹ️  INFO (${report.infos.length})`);
      for (const i of report.infos) {
        lines.push(`  [${i.category}]${i.module ? ` ${i.module}:` : ''} ${i.message}`);
      }
    }

    if (report.errors.length === 0 && report.warnings.length === 0) {
      lines.push('\n✅ No issues found!');
    }

    const rate = report.durationMs > 0 ? (report.eventCount / (report.durationMs / 1000)).toFixed(1) : '0';
    lines.push(`\n📊 Event Flow: ${report.eventCount} events in ${(report.durationMs / 1000).toFixed(1)}s (${rate}/s)`);
    if (report.topEvents.length > 0) {
      const top = report.topEvents.map((t) => `${t.event}(${t.count})`).join(', ');
      lines.push(`   Top: ${top}`);
    }

    return lines.join('\n');
  }
}
