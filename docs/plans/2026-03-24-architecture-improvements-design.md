# Engine Architecture Improvements Design

> **Date:** 2026-03-24
> **Goal:** Fix module coordination bugs at the architectural level, add debugging tools, improve type safety

## 7 Improvements

### 1. BaseModule Auto-Track Event Listeners (P0)
- `on()` records listeners to `_trackedListeners` array
- `destroy()` auto-unsubscribes all tracked listeners
- 1 file change, all 46 modules benefit automatically

### 2. Module Dependency Declaration (P0)
- `getDependencies()` returns `{ requires: string[], optional: string[] }`
- ConfigLoader validates after loading, warns on missing requires
- Non-blocking: warn only, don't prevent loading

### 3. Event Constants Registry (P1)
- `src/engine/core/events.ts` — centralized event name constants + payload interfaces
- Gradual migration: modules can use constants or raw strings
- IDE autocomplete + refactor safety

### 4. EventBus Debug Mode (P1)
- `setDebug(true)` enables console logging of all events
- Shows: event name, listener count, payload
- Warns on events with 0 listeners
- Expose via `window.__engine` for browser console access

### 5. PixiRenderer destroy() Event Leak Fix (P1)
- Clean up engineEventHandlers in destroy()
- 3 lines of code

### 6. Event Naming Normalization (P2)
- `gravity:landed` → `gravity:land`
- `gravity:falling` → `gravity:fall`
- Update all emitters + listeners

### 7. Integration Test Matrix (P2)
- Loop ALL_GAME_TYPES × 6 lifecycle tests
- Tests: load, start, score, damage, finish, restart
- ~90 test cases
