# FPS Counter Overlay - Implementation Plan

## Task
Add an FPS (frames per second) counter overlay to the game preview interface.

## Task Type
- [x] Frontend
- [ ] Backend
- [ ] Full-stack

## Technical Approach

**Chosen: Option A — Loop-Piggyback + Local Hook State** (Codex recommended)

Extend `useGameLoop` to expose a metrics ref; a lightweight `useFps` hook samples it at ~1Hz into local React state. Global store only holds the visibility toggle (`showFpsOverlay`).

**Rationale:**
- Single rAF — no duplicate scheduling, FPS reflects actual render timing
- Ephemeral FPS value stays out of global store (no cross-cutting re-renders)
- React updates only ~1Hz; store remains clean
- Minimal coupling: optional callback, no behavior change if unused

**Rejected alternatives:**
- Option B (separate rAF): extra scheduling, drift risk from main loop
- Option C (Zustand for FPS value): pollutes store with ephemeral metrics
- Option D (PixiJS HUD text): violates separation of concerns

## Implementation Steps

### Step 1: Editor Store — Add toggle state
**File:** `src/store/editor-store.ts`
**Operation:** Modify
- Add `showFpsOverlay: boolean` (default `false`) to store state
- Add `toggleFpsOverlay()` action using immutable set pattern
- Extract stable selectors at module scope: `selectShowFpsOverlay`, `selectToggleFpsOverlay`

### Step 2: Game Loop — Expose metrics ref
**File:** `src/app/hooks/use-game-loop.ts`
**Operation:** Modify
- Add `fpsRef` (MutableRefObject<number>) inside the hook
- Inside the rAF loop: count frames, every ~1000ms write `fpsRef.current = frameCount` and reset
- Return `fpsRef` from the hook alongside `start`/`stop`

### Step 3: FPS Overlay Component
**File:** `src/ui/preview/fps-overlay.tsx`
**Operation:** Create
- Accept `fpsRef: RefObject<number>` prop
- Use `setInterval(1000)` to sample `fpsRef.current` into local state
- Render: `absolute top-3 left-3 z-10 px-2 py-1 rounded text-xs font-mono bg-black/60 text-white/80 backdrop-blur-sm border border-white/10`
- Read `showFpsOverlay` and `previewMode` from editor store
- Visible only when `showFpsOverlay && previewMode === 'edit'`

### Step 4: Mount overlay in PreviewCanvas
**File:** `src/ui/preview/preview-canvas.tsx`
**Operation:** Modify
- Destructure `fpsRef` from `useGameLoop()`
- Render `<FpsOverlay fpsRef={fpsRef} />` inside the preview container

### Step 5: Toolbar toggle button
**File:** `src/ui/preview/preview-toolbar.tsx`
**Operation:** Modify
- Import `Activity` icon from lucide-react (or similar)
- Add a small toggle button after the mode buttons
- Wire to `toggleFpsOverlay()` from editor store
- Visual feedback: highlight when active (same pattern as mode buttons)

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `src/store/editor-store.ts` | Modify | Add showFpsOverlay toggle |
| `src/app/hooks/use-game-loop.ts` | Modify | Expose fpsRef from rAF loop |
| `src/ui/preview/fps-overlay.tsx` | Create | FPS badge component |
| `src/ui/preview/preview-canvas.tsx` | Modify | Mount FpsOverlay |
| `src/ui/preview/preview-toolbar.tsx` | Modify | Add toggle button |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Modifying useGameLoop API could break consumers | fpsRef is internal, returned as additional field — backward compatible |
| setInterval drift vs rAF timing | setInterval only reads the ref, actual measurement is in rAF — no drift |
| Extra re-renders from overlay | Only 1 setState/sec, only when visible — negligible |

## Testing
- Unit test: FPS accumulator logic with synthetic timestamps (1000ms window, N frames = N FPS)
- Unit test: FpsOverlay visibility rules (edit+on → visible, play → hidden, edit+off → hidden)
- Integration: no measurable re-render spikes

## SESSION_ID (for /ccg:execute)
- CODEX_SESSION: 019d4756-0c9e-7652-bec7-415319c3ce68
- GEMINI_SESSION: 25ec1375-1e53-4000-8ab4-4b227adb7a53
