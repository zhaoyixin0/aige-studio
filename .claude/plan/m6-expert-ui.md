# M6 Expert UI — Implementation Plan

> Synthesized from Codex (architecture/data flow) + Gemini (UI/UX design) dual-model analysis.
> Builds on M5's 60 expert presets loaded as `EXPERT_PRESETS`.

---

## Overview

Add frontend presentation layer for 60 expert presets: browsable gallery, game type badges, featured chip, and metadata display. All data runtime-derived from `EXPERT_PRESETS`, zero hardcoding.

**4 steps, TDD, estimated 2-3 hours sequential.**

---

## Task Type
- [ ] Backend
- [x] Frontend (Gemini authority)
- [ ] Fullstack

---

## Dependency Graph

```
Step 1 (Expert Utils) ──→ Step 2 (PresetSuggestionBlock + Featured Chip)
                     ──→ Step 3 (GameTypeSelector Badges)
                     ──→ Step 4 (Expert Browser Modal)
```

---

## Step 1: Expert Utils — Data Parsing Layer

### Goal
Centralized utility module for parsing expert preset metadata. All UI components import from here instead of directly accessing EXPERT_PRESETS internals.

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `src/ui/experts/expert-utils.ts` | Create | Pure utility functions for expert data |
| `src/ui/experts/__tests__/expert-utils.test.ts` | Create | Unit tests |

### API

```ts
// Parse confidence from tags array (e.g., "confidence:0.75" → 0.75)
parseConfidence(tags: readonly string[]): number | null

// Extract source filename from preset description "[source: X]" or sequence setMeta
extractSource(preset: PresetTemplate): string | null

// Count required modules
countModules(preset: PresetTemplate): number

// Group expert presets by gameType → Map<string, PresetTemplate[]>
groupByGameType(presets: readonly PresetTemplate[]): Map<string, readonly PresetTemplate[]>

// Count expert presets per gameType → Map<string, number>
countByGameType(presets: readonly PresetTemplate[]): Map<string, number>

// Get top N presets by confidence (deterministic: secondary sort by id)
topByConfidence(presets: readonly PresetTemplate[], n: number): readonly PresetTemplate[]

// Pick a random featured preset (confidence-weighted, deterministic per session via seed)
pickFeatured(presets: readonly PresetTemplate[]): PresetTemplate | null

// Confidence tier for color coding
confidenceTier(value: number): 'high' | 'medium' | 'low'
// high >= 0.85 → emerald, medium 0.6-0.84 → blue, low < 0.6 → slate
```

### Test Strategy (8 tests)
- parseConfidence extracts from tags correctly
- parseConfidence returns null for missing tag
- extractSource parses "[source: X]" from description
- countModules uses requiredModules length
- countByGameType produces correct counts
- topByConfidence sorts descending with id tiebreaker
- pickFeatured returns non-null when presets available
- confidenceTier classifies correctly

### Size: S

---

## Step 2: PresetSuggestionBlock Metadata + Featured Chip

### Goal
Enrich the in-chat preset card with expert metadata, and add a featured expert chip on landing page.

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `src/ui/chat/preset-suggestion-block.tsx` | Modify | Add metadata footer for expert presets |
| `src/ui/experts/featured-expert-chip.tsx` | Create | Rotating featured expert chip |
| `src/ui/landing/landing-page.tsx` | Modify | Render FeaturedExpertChip |
| `src/ui/chat/__tests__/preset-suggestion-block.test.tsx` | Modify | Add metadata tests |
| `src/ui/experts/__tests__/featured-expert-chip.test.ts` | Create | Featured chip tests |

### PresetSuggestionBlock Enhancement

```tsx
// When presetId starts with "expert-", show metadata footer:
<div className="text-xs text-blue-400/70 mt-2 flex gap-3">
  <span>来源: {source ?? '未知'}</span>
  <span>置信度: <ConfidenceBadge value={confidence} /></span>
  <span>模块: {moduleCount}</span>
</div>
```

Confidence badge colors (Gemini recommendation):
- high (>= 0.85): `text-emerald-400`
- medium (0.6-0.84): `text-blue-400`
- low (< 0.6): `text-slate-400`

### FeaturedExpertChip

- Renders when no chat messages exist (landing state)
- Picks one high-confidence expert preset on mount (confidence-weighted random)
- Purple chip styling (consistent with preset type)
- Label: "专家精选: {title}"
- Click → submit "使用模板 {presetId}"
- Placed after DEFAULT_CHIPS preset section

### Test Strategy (6 tests)
- PresetSuggestionBlock shows metadata for expert presets
- PresetSuggestionBlock hides metadata for hero presets
- PresetSuggestionBlock handles missing confidence gracefully
- FeaturedExpertChip renders when presets available
- FeaturedExpertChip click triggers correct submit text
- FeaturedExpertChip doesn't render when no expert presets

### Size: M | Depends on: Step 1

---

## Step 3: GameTypeSelector Expert Badges

### Goal
Show expert preset count per game type in the GameTypeSelector card grid.

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `src/ui/chat/game-type-selector.tsx` | Modify | Add expert count badge + browser trigger |
| `src/ui/chat/__tests__/game-type-selector-expert.test.ts` | Create | Badge tests |

### Implementation

```tsx
// Inside GameTypeCard, after "Coming Soon" badge:
{expertCount > 0 && (
  <button
    className="text-xs bg-purple-500/15 border border-purple-400/30 rounded-full px-2 py-0.5 text-purple-300"
    onClick={(e) => { e.stopPropagation(); onBrowseExperts?.(gameTypeId); }}
  >
    {expertCount} 款专家模板
  </button>
)}
```

- Compute counts via `useMemo` + `countByGameType(EXPERT_PRESETS)` inside component
- Badge clickable → opens ExpertBrowser pre-filtered to that gameType (Step 4)
- No props contract change — internal import of expert-utils

### Test Strategy (4 tests)
- Badge shows correct count for game types with expert presets
- Badge hidden for game types without expert presets
- Badge click triggers browse callback
- Counts are accurate against EXPERT_PRESETS

### Size: S | Depends on: Step 1

---

## Step 4: Expert Browser Modal

### Goal
Full-featured browsable gallery for 60 expert presets. Radix Dialog with search, filters, sort, preview.

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `src/ui/experts/expert-preset-card.tsx` | Create | Presentational card component |
| `src/ui/experts/expert-browser.tsx` | Create | Main browser modal (Radix Dialog) |
| `src/ui/experts/__tests__/expert-browser.test.tsx` | Create | Browser integration tests |

### ExpertPresetCard (~120 lines)

```tsx
interface ExpertPresetCardProps {
  readonly preset: PresetTemplate;
  readonly onUse: (presetId: string) => void;
}
// Renders: title, gameType badge (emoji + displayName), description (2-line clamp),
// source, confidence badge (colored tier), module count, "使用此模板" button
```

### ExpertBrowser (~350 lines)

```tsx
interface ExpertBrowserProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onUsePreset: (presetId: string) => void;
  readonly initialGameType?: string; // pre-filter from GameTypeSelector badge
}
```

**Layout:**
```
┌──────────────────────────────────────────────┐
│ 专家模板库                            [×]    │
├──────────────────────────────────────────────┤
│ [🔍 搜索模板...]                              │
│ [游戏类型 ▼] [置信度 >= 0.6 ▼] [排序: 置信度 ▼] │
├──────────────────────────────────────────────┤
│ ┌────────┐ ┌────────┐ ┌────────┐            │
│ │ Card 1 │ │ Card 2 │ │ Card 3 │            │
│ └────────┘ └────────┘ └────────┘            │
│ ┌────────┐ ┌────────┐ ┌────────┐            │
│ │ Card 4 │ │ Card 5 │ │ Card 6 │            │
│ └────────┘ └────────┘ └────────┘            │
│                                              │
│              (ScrollArea)                    │
└──────────────────────────────────────────────┘
```

**Features:**
- Search: filter by title, description, source
- Game type filter: dropdown from available types (only types with presets)
- Confidence filter: min threshold (default 0.6, hides drafts)
- Sort: confidence desc (default), title asc
- Empty state: "未找到符合条件的专家模板" + 重置筛选 button
- Dark glassmorphism: `bg-slate-900/90 backdrop-blur-xl border border-white/10`
- Card hover: `hover:-translate-y-0.5 hover:border-white/10` subtle lift

**Entry points:**
1. Landing page "浏览专家模板" action chip
2. GameTypeSelector badge click (pre-filtered)

### Test Strategy (6 tests)
- Renders all expert presets
- Search filters by title
- GameType filter narrows results
- Confidence filter hides low-confidence presets
- "使用此模板" click triggers onUsePreset
- Empty state shown when no results match

### Size: M-L | Depends on: Steps 1-3

---

## Execution Order (TDD)

```
Step 1: Expert Utils (RED → GREEN) — ~30min
Step 2: PresetSuggestionBlock + Featured Chip (RED → GREEN) — ~45min
Step 3: GameTypeSelector Badges (RED → GREEN) — ~30min
Step 4: Expert Browser Modal (RED → GREEN) — ~60min
Build verification + full test run
```

### Estimated New Tests: ~24

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Purple theme (not amber) | Consistency with existing preset chip styling |
| Confidence tier coloring | Gemini: more intuitive than raw percentage |
| Page-load random (not interval) | Avoid visual distraction from rotating chips |
| Radix Dialog (not drawer) | Encapsulated, no layout churn with editor panel |
| No agent/store schema changes | Self-contained UI layer; metadata derived from EXPERT_PRESETS |
| expert-utils isolation | Prevents UI components from coupling to engine internals |

---

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Metadata parsing fragile | Missing confidence/source | Null-safe with fallback text ("未知", "—") |
| 60 presets in modal | Scroll performance | useMemo + CSS grid; no virtualization needed at this scale |
| Store chip contention | Featured chip conflicts with agent updates | Local render, not store mutation |
| Cross-layer coupling | UI imports engine data | Isolate in expert-utils; single import point |
| Radix Dialog z-index | Overlap with editor panel | Use Dialog portal with proper z-50 |

---

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: 019d60e5-9f4a-7171-957a-a4ea330da5f7
- GEMINI_SESSION: (policy mode, no persistent session)
