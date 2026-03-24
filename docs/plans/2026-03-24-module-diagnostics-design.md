# Module Combination Diagnostics System Design

> **Date:** 2026-03-24
> **Goal:** Automated testing of module combinations with event flow analysis and deep problem detection

## Architecture

```
EventRecorder (captures all events) → ModuleDiagnostics (runs rules) → DiagnosticReport
    ↓                                                                        ↓
Vitest (automated CI)                                          Browser console (interactive)
```

## Components

### 1. EventRecorder
- Monkey-patches EventBus.emit() to record all events
- Captures: event name, data, timestamp, listener count
- Methods: attach(), detach(), getEvents(), getOrphaned(), getEventChain(), clear()

### 2. DiagnosticRules (9 rules)
| Rule | Category | Detects |
|------|----------|---------|
| CrashDetector | crash | update() throws |
| OrphanEventDetector | orphan-event | Events with 0 listeners |
| ChainBreakDetector | broken-chain | Expected event chain interrupted |
| GameFlowStuckDetector | state-anomaly | GameFlow stuck in countdown >10s |
| ScoreAnomalyDetector | state-anomaly | Score or lives negative |
| TimerAnomalyDetector | state-anomaly | Timer negative |
| EventStormDetector | performance | >50 same events per frame |
| UpdateSlowDetector | performance | Module update >5ms |
| DependencyMissingDetector | crash | getDependencies().requires unmet |

### 3. CombinationGenerator
- Base: 15 presets as-is
- Variants: remove each optional module (one at a time)
- Variants: add each compatible module (one at a time)
- ~150-200 test cases total

### 4. Vitest Integration
- `all-module-combinations.test.ts`
- Each combination: load → play 5s → diagnose → assert 0 errors

### 5. Browser Console
- `window.__diagnostics.start()` / `.stop()` / `.report()`
- Formatted console output with severity icons

## Issue Format
```ts
interface DiagnosticIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'crash' | 'orphan-event' | 'broken-chain' | 'state-anomaly' | 'performance';
  module?: string;
  message: string;
  detail?: any;
}
```
