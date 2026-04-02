# Fix: PlayerMovement Follow Mode Dual-Listener Conflict

## Summary
Catch/dodge/tap games have uncontrollable characters due to PlayerMovement registering two conflicting event handlers on the same `input:touch:position` event in follow mode, plus a coordinate system mismatch.

**Multi-Model Validation**: Codex + Gemini both confirmed root cause and agreed on fix direction.

## Task Type
- [x] Backend (→ Codex authority)

## Root Cause (2 bugs)

### Bug 1: Dual-listener conflict
- Line 122: Hardcoded `input:touch:position` → `this.touchTarget` (for lerp)
- Line 180: `continuousEvent` (also `input:touch:position`) → `this.x` directly
- `updateFollowMode()` only reads `touchTarget`, ignoring direct `x` writes

### Bug 2: Coordinate mismatch
- TouchInput emits **canvas coordinates** (e.g., x=540)
- FaceInput/HandInput emit **canvas coordinates** (after remap/mirror)
- But continuousEvent handler does `this.x = data.x * canvasWidth` treating ALL as normalized
- Result: x = 540 * 1080 = 583,200 (off-screen!)

## Technical Solution

### Unified continuous handler with mode branching + coordinate mapping

```typescript
// In init(), replace both listeners with:

if (continuousEvent) {
  this.on(continuousEvent, (data?: any) => {
    if (!data) return;
    const target = this.mapEventToCanvas(continuousEvent, data);
    if (!target) return;

    if (this.params.mode === 'follow') {
      this.touchTarget = target;  // Smooth lerp for ALL inputs
    } else {
      this.x = target.x;  // Direct for velocity mode
    }
  });
} else if (this.params.mode === 'follow') {
  // Fallback: hardcoded touch listener when no continuousEvent
  this.on('input:touch:position', (data?: any) => {
    if (data && typeof data.x === 'number' && typeof data.y === 'number') {
      this.touchTarget = { x: data.x, y: data.y };
    }
  });
}
```

### Coordinate mapping helper

```typescript
private mapEventToCanvas(
  eventName: string,
  data: any,
): { x: number; y: number } | null {
  const canvas = this.engine?.getCanvas();
  const cw = canvas?.width ?? 1080;
  const ch = canvas?.height ?? 1920;

  // Touch/Face/Hand/Body: emit canvas-space pixels — passthrough
  if (eventName === 'input:touch:position' ||
      eventName === 'input:face:move' ||
      eventName === 'input:hand:move' ||
      eventName === 'input:body:move') {
    if (typeof data.x === 'number') {
      return {
        x: Math.max(0, Math.min(cw, data.x)),
        y: typeof data.y === 'number' ? Math.max(0, Math.min(ch, data.y)) : this.y,
      };
    }
    return null;
  }

  // Device tilt: -1 to 1 → canvas X
  if (typeof data.tiltX === 'number') {
    return {
      x: Math.max(0, Math.min(cw, (data.tiltX + 1) / 2 * cw)),
      y: this.y,
    };
  }

  // Audio frequency: 200-800 Hz → canvas X
  if (typeof data.frequency === 'number') {
    const normalized = Math.max(0, Math.min(1, (data.frequency - 200) / 600));
    return { x: normalized * cw, y: this.y };
  }

  // Unknown: if x looks normalized (0-1), scale; else passthrough
  if (typeof data.x === 'number') {
    const x = data.x <= 1 ? data.x * cw : data.x;
    return { x: Math.max(0, Math.min(cw, x)), y: this.y };
  }

  return null;
}
```

## Implementation Steps

### Step 1: Add `mapEventToCanvas` helper to PlayerMovement
- Private method, handles all 5 input types
- Clamps to canvas bounds

### Step 2: Consolidate continuous event registration
- Remove hardcoded follow listener (line 122-127)
- Replace with mode-aware branching in continuousEvent block
- Add fallback for when continuousEvent is not set

### Step 3: Update existing tests
- Fix `player-movement.test.ts` test that assumes normalized input

### Step 4: Add new tests
- Follow mode + touch: lerp toward target, not snap
- Follow mode + face: canvas coords, not normalized
- Velocity mode + device tilt: correct mapping
- Velocity mode + audio frequency: correct mapping
- No continuousEvent + follow mode: fallback works

### Step 5: End-to-end test
- ConversationAgent builds catch config → Engine loads → touch input → player moves

### Step 6: Verify all 1691 tests + npm run build

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `src/engine/modules/mechanic/player-movement.ts:111-197` | Modify | Consolidate listeners + add mapEventToCanvas |
| `src/engine/modules/__tests__/player-movement.test.ts` | Modify | Update/add tests |
| `src/engine/modules/__tests__/player-movement-follow.test.ts` | Create | Follow mode + coordinate mapping tests |

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| FaceInput/HandInput coordinate space assumption wrong | Verify actual emit values in FaceInput.ts before mapping |
| Breaking velocity mode for shooting/action-rpg | Keep velocity mode path unchanged; only refactor the handler routing |
| Edge case: data.x between 0-1 misread as normalized | Prefer event-name switch; only use heuristic for unknown events |

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: 019d4b30-ad94-7292-9352-1d9d0c16ea86
- GEMINI_SESSION: (read-only analysis, no session)
