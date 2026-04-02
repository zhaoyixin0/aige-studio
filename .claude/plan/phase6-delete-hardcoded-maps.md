# Phase 6: Delete Hardcoded Validator Maps — ContractRegistry-Only Validation

## Summary

Remove `KNOWN_MODULE_TYPES`, `MODULE_DEPENDENCIES`, `SCORER_VALID_HIT_EVENTS` from `config-validator.ts`. All validation logic switches to `ContractRegistry` as single source of truth.

**Multi-Model Validation**: Codex + Gemini analysis confirmed this approach. Key divergence resolved:
- MODULE_DEPENDENCIES → Event fulfillment (Gemini favored capability check, Codex favored getDependencies; chose simplest: event fulfillment only)
- SCORER_VALID_HIT_EVENTS → Loosened to "any emitted event in config" (Gemini approach; Codex wanted scoreEvents field)
- INPUT/SINGLETON → Defer to Phase 7 (Codex approach; limits blast radius)

## Task Type
- [x] Backend (→ Codex authority)

## Technical Solution

### Core Principle
Modules self-declare their event contracts via `getContracts()`. Validator reads these declarations from `ContractRegistry` instead of maintaining parallel hardcoded maps. This eliminates drift risk and scales automatically as modules evolve.

### Three Replacements

| Hardcoded Map | Replacement | Mechanism |
|---------------|-------------|-----------|
| `KNOWN_MODULE_TYPES` | `contracts.getKnownTypes()` | Direct API call |
| `MODULE_DEPENDENCIES` | `checkEventFulfillment()` | consumes vs emits pool of enabled modules |
| `SCORER_VALID_HIT_EVENTS` | Simplified `checkEventChains()` | hitEvent param vs emits pool |

### Severity Semantics
- **Event fulfillment** (missing consumes) → `warning` (AutoWirer may provide dynamically)
- **Scorer hitEvent** (no emitter) → `error` (game breaks without scoring source)
- **Unknown module type** → `error` (unchanged)

## Implementation Steps

### Step 1: Update `validateConfig` Signature

**File:** `src/engine/core/config-validator.ts`

Change from:
```typescript
export function validateConfig(
  config: GameConfig,
  knownModules: ReadonlySet<string> = KNOWN_MODULE_TYPES,
): ValidationReport
```

To:
```typescript
import type { ContractRegistry } from './contract-registry';

export function validateConfig(
  config: GameConfig,
  contracts?: ContractRegistry,
): ValidationReport
```

- `contracts` optional for backward compat during transition
- If not provided, skip contract-based checks (unknown-module, event-fulfillment, event-chains)
- Keep param-validation and conflict checks working without contracts

### Step 2: Rewrite `checkUnknownModules`

Replace KNOWN_MODULE_TYPES usage:
```typescript
function checkUnknownModules(
  modules: readonly ModuleConfig[],
  knownTypes: ReadonlySet<string>,  // now from contracts.getKnownTypes()
): ValidationIssue[]
```

In `validateConfig`:
```typescript
const unknownErrors = contracts
  ? checkUnknownModules(enabledModules, contracts.getKnownTypes())
  : [];
```

### Step 3: New `checkEventFulfillment` (replaces `checkDependencies`)

```typescript
function checkEventFulfillment(
  modules: readonly ModuleConfig[],
  contracts: ContractRegistry,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Build emits pool from enabled modules
  const emitsPool = new Set<string>();
  for (const m of modules) {
    for (const event of contracts.getEmits(m.type)) {
      emitsPool.add(event);
    }
  }

  // Universal events always available (BaseModule handles these)
  const UNIVERSAL_EVENTS = new Set(['gameflow:resume', 'gameflow:pause']);

  for (const m of modules) {
    for (const event of contracts.getConsumes(m.type)) {
      if (UNIVERSAL_EVENTS.has(event)) continue;
      if (emitsPool.has(event)) continue;

      // Wildcard: consumes ending with :* matches prefix
      if (event.endsWith(':*')) {
        const prefix = event.slice(0, -1); // "input:face:" from "input:face:*"
        const hasMatch = [...emitsPool].some(e => e.startsWith(prefix));
        if (hasMatch) continue;
      }

      issues.push({
        severity: 'warning',
        category: 'event-chain-break',
        moduleId: m.id,
        message: `Module "${m.type}" consumes "${event}" but no enabled module emits it.`,
      });
    }
  }

  return issues;
}
```

**Design notes:**
- Returns `warning` not `error` — AutoWirer may dynamically wire events
- Universal events excluded per project rule (BaseModule handles gameflow:resume/pause)
- Wildcard support for input:*:* patterns
- Replaces MODULE_DEPENDENCIES entirely — event fulfillment naturally catches:
  - Scorer→Collision (Scorer consumes collision:hit, Collision emits it)
  - CoyoteTime→Jump (CoyoteTime consumes jump:start, Jump emits it)
  - Shield→damage events (Shield consumes collision:damage, Collision emits it)

### Step 4: Simplify `checkEventChains` (Scorer validation)

Replace hardcoded SCORER_VALID_HIT_EVENTS with dynamic emits pool:

```typescript
function checkEventChains(
  modules: readonly ModuleConfig[],
  contracts: ContractRegistry,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Build emits pool from enabled modules
  const emitsPool = new Set<string>();
  for (const m of modules) {
    for (const event of contracts.getEmits(m.type)) {
      emitsPool.add(event);
    }
  }

  for (const m of modules) {
    if (m.type !== 'Scorer') continue;

    const hitEvent = (m.params.hitEvent as string) ?? 'collision:hit';

    // Check if the hitEvent is emitted by any enabled module
    if (!emitsPool.has(hitEvent)) {
      issues.push({
        severity: 'error',
        category: 'event-chain-break',
        moduleId: m.id,
        message: `Scorer.hitEvent "${hitEvent}" is not emitted by any enabled module. ` +
          `Ensure a module that emits "${hitEvent}" is present.`,
      });
    }
  }

  return issues;
}
```

**What's removed:**
- Hardcoded SCORER_VALID_HIT_EVENTS whitelist
- Individual per-module source checks (BeatMap→beat:hit, QuizEngine→quiz:correct, etc.)
- All replaced by single dynamic "is hitEvent in emits pool?" check

### Step 5: Delete Hardcoded Maps

**File:** `src/engine/core/config-validator.ts`
- Delete `KNOWN_MODULE_TYPES` (lines 44-67)
- Delete `MODULE_DEPENDENCIES` (lines 70-91)
- Delete `SCORER_VALID_HIT_EVENTS` (lines 94-98)
- Delete `checkDependencies()` function (lines 136-166)

### Step 6: Wire Up in `validateConfig`

```typescript
export function validateConfig(
  config: GameConfig,
  contracts?: ContractRegistry,
): ValidationReport {
  const enabledModules = getEnabledModules(config);

  // Contract-based checks (require ContractRegistry)
  const unknownErrors = contracts
    ? checkUnknownModules(enabledModules, contracts.getKnownTypes())
    : [];
  const fulfillmentWarnings = contracts
    ? checkEventFulfillment(enabledModules, contracts)
    : [];
  const chainErrors = contracts
    ? checkEventChains(enabledModules, contracts)
    : [];

  // Non-contract checks (always run)
  const rulesErrors = checkEmptyCollisionRules(enabledModules);
  const conflictWarnings = checkModuleConflicts(enabledModules);
  const inputWarnings = checkMissingInput(enabledModules);
  const { warnings: paramWarnings, fixes } = checkAndFixParams(enabledModules);

  const errors = [...unknownErrors, ...rulesErrors, ...chainErrors];
  const warnings = [...fulfillmentWarnings, ...conflictWarnings, ...inputWarnings, ...paramWarnings];

  return { errors, warnings, fixes, isPlayable: errors.length === 0 };
}
```

### Step 7: Update `index.ts` Export

**File:** `src/engine/core/index.ts`

Remove:
```typescript
export { validateConfig, applyFixes, KNOWN_MODULE_TYPES } from './config-validator';
```
Replace with:
```typescript
export { validateConfig, applyFixes } from './config-validator';
```

### Step 8: Update ConfigLoader Caller

**File:** `src/engine/core/config-loader.ts`

```typescript
import { ContractRegistry } from './contract-registry';
// ...

load(engine: Engine, config: GameConfig): void {
  const contracts = ContractRegistry.fromRegistry(this.registry);
  const report = validateConfig(config, contracts);
  // ... rest unchanged
}
```

### Step 9: Update ConversationAgent Caller

**File:** `src/agent/conversation-agent.ts`

```typescript
import { createModuleRegistry } from '@/engine/module-setup';
import { ContractRegistry } from '@/engine/core/contract-registry';

// Module-level cached registry (static, doesn't change at runtime)
let _cachedContracts: ContractRegistry | null = null;
function getContracts(): ContractRegistry {
  if (!_cachedContracts) {
    _cachedContracts = ContractRegistry.fromRegistry(createModuleRegistry());
  }
  return _cachedContracts;
}

// In _validateAndFix:
const report = validateConfig(config, getContracts());
```

### Step 10: Update Tests

#### 10a: `config-validator-contracts.test.ts`
- Remove `KNOWN_MODULE_TYPES` import
- Remove drift test (no longer needed — there's nothing to drift against)
- Keep/update ContractRegistry-based validation tests
- Add event fulfillment tests:
  - Missing consumes → warning
  - Universal events excluded → no warning
  - Wildcard consumes satisfied → no warning
  - Scorer hitEvent not in pool → error

#### 10b: `config-validator.test.ts` (integration)
- Update all `validateConfig(config)` calls to `validateConfig(config, contracts)` where contracts needed
- Update "event chain breaks" tests to use new error messages
- Update "missing dependency" tests to expect `event-chain-break` warnings instead of `missing-dependency` errors
- Keep param/conflict/input tests unchanged

#### 10c: New tests for edge cases
- Disabled module emits NOT in pool
- Dynamic param events (Scorer with custom hitEvent)
- Module with no consumes → no fulfillment issues
- Module consuming only universal events → no issues

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `src/engine/core/config-validator.ts` | Modify | Delete 3 maps, new validation logic |
| `src/engine/core/index.ts:11` | Modify | Remove KNOWN_MODULE_TYPES export |
| `src/engine/core/config-loader.ts:44` | Modify | Pass ContractRegistry |
| `src/agent/conversation-agent.ts:580` | Modify | Pass ContractRegistry (cached) |
| `src/engine/core/__tests__/config-validator-contracts.test.ts` | Modify | Update/add tests |
| `src/__tests__/integration/config-validator.test.ts` | Modify | Update to new API |

## Risks and Mitigation

| Risk | Severity | Mitigation |
|------|----------|------------|
| MODULE_DEPENDENCIES covered type-level deps that events don't catch (e.g., Dash→PlayerMovement) | LOW | Only 19/59 modules had entries; event fulfillment catches the critical ones (Scorer→Collision). Minor gaps are acceptable — game works, just has useless modules |
| Scorer hitEvent loosened beyond original 8 events | LOW | Event must still be emitted by an enabled module. Prevents truly broken configs. Edge case: scoring on high-frequency events is a design choice, not a bug |
| ConversationAgent import of createModuleRegistry adds weight | LOW | Cached at module level; only instantiated once per session |
| Existing integration tests hardcode MODULE_DEPENDENCIES error messages | MEDIUM | Must update test expectations; use event-chain-break category |
| Contracts with empty emits/consumes produce no fulfillment checks | LOW | Already handled — modules with empty contracts are valid (no dependencies) |

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION (Analysis): 019d4b0d-a67e-7bf1-aa6e-1ee1f58284af
- CODEX_SESSION (Architect): 019d4b13-ff94-7f50-9246-47d54d937f44
- GEMINI_SESSION: (no architect output — read-only policy)
