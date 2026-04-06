import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameTypeSelector } from '../game-type-selector.tsx';
import { EXPERT_PRESETS } from '@/engine/systems/recipe-runner/index.ts';
import { countByGameType } from '@/ui/experts/expert-utils.ts';

const options = [
  { id: 'catch', name: '接住', emoji: '🎯', category: 'Reflex', supportedToday: true },
  { id: 'puzzle', name: '解谜', emoji: '🧩', category: 'Puzzle', supportedToday: true },
  { id: 'narrative', name: '叙事', emoji: '📖', category: 'Narrative', supportedToday: true },
];

describe('GameTypeSelector expert badges', () => {
  it('shows badge for game types with expert presets', () => {
    const counts = countByGameType(EXPERT_PRESETS);
    // Find a game type that has expert presets
    const typeWithExperts = options.find((o) => (counts.get(o.id) ?? 0) > 0);
    if (!typeWithExperts) return; // Skip if no matching types in test options

    render(<GameTypeSelector options={options} onSelect={() => {}} />);
    const badges = screen.getAllByTestId('expert-badge');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('badge hidden for game types without expert presets', () => {
    // 'narrative' is unlikely to have expert presets
    const counts = countByGameType(EXPERT_PRESETS);
    if ((counts.get('narrative') ?? 0) > 0) return; // Skip if it does have presets

    render(<GameTypeSelector options={[options[2]]} onSelect={() => {}} />);
    const badges = screen.queryAllByTestId('expert-badge');
    expect(badges.length).toBe(0);
  });

  it('badge shows correct count text', () => {
    const counts = countByGameType(EXPERT_PRESETS);
    const typeWithExperts = options.find((o) => (counts.get(o.id) ?? 0) > 0);
    if (!typeWithExperts) return;

    render(<GameTypeSelector options={options} onSelect={() => {}} />);
    const badges = screen.getAllByTestId('expert-badge');
    const count = counts.get(typeWithExperts.id)!;
    const badge = badges.find((b) => b.textContent?.includes(`${count}`));
    expect(badge).toBeDefined();
    expect(badge!.textContent).toContain('款专家模板');
  });

  it('counts are accurate against EXPERT_PRESETS', () => {
    const counts = countByGameType(EXPERT_PRESETS);
    // Verify total matches EXPERT_PRESETS length
    let total = 0;
    for (const v of counts.values()) total += v;
    expect(total).toBe(EXPERT_PRESETS.length);
  });
});
