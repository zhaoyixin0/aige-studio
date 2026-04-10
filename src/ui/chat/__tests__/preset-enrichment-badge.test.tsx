/**
 * P4 task 1.3 — PresetEnrichmentBadge renders preset-enricher hook state.
 *
 * Contract:
 *   - state === 'idle'       → renders nothing
 *   - state === 'running'    → shows running label, spinner, cancel button
 *   - state === 'done'       → shows "已优化 N 项"
 *   - state === 'done' +     → shows "已优化 N 项（K 项保留了你的修改）"
 *     skipped > 0
 *   - state === 'failed'     → shows info-level "深度微调不可用..." message
 *   - state === 'cancelled'  → renders nothing (silent)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PresetEnrichmentBadge } from '../preset-enrichment-badge';

describe('PresetEnrichmentBadge', () => {
  it('renders nothing when state is idle', () => {
    const { container } = render(
      <PresetEnrichmentBadge
        state="idle"
        applied={0}
        skipped={0}
        onCancel={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders running label and cancel button when state is running', () => {
    const onCancel = vi.fn();
    render(
      <PresetEnrichmentBadge
        state="running"
        applied={0}
        skipped={0}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByTestId('preset-enrichment-badge')).toBeTruthy();
    expect(screen.getByTestId('preset-enrichment-badge')).toHaveAttribute(
      'data-state',
      'running',
    );
    expect(screen.getByText(/正在基于 skill 优化/)).toBeTruthy();

    const cancelBtn = screen.getByRole('button', { name: /跳过|cancel/i });
    expect(cancelBtn).toBeTruthy();
  });

  it('invokes onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <PresetEnrichmentBadge
        state="running"
        applied={0}
        skipped={0}
        onCancel={onCancel}
      />,
    );
    const cancelBtn = screen.getByRole('button', { name: /跳过|cancel/i });
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders done state with applied count (no skipped)', () => {
    render(
      <PresetEnrichmentBadge
        state="done"
        applied={5}
        skipped={0}
        onCancel={() => {}}
      />,
    );
    const badge = screen.getByTestId('preset-enrichment-badge');
    expect(badge).toHaveAttribute('data-state', 'done');
    expect(screen.getByText(/已优化 5 项/)).toBeTruthy();
    // Should NOT show "K 项保留"
    expect(screen.queryByText(/保留了你的修改/)).toBeNull();
  });

  it('renders done state with applied and skipped counts', () => {
    render(
      <PresetEnrichmentBadge
        state="done"
        applied={5}
        skipped={2}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText(/已优化 5 项/)).toBeTruthy();
    expect(screen.getByText(/2 项保留了你的修改/)).toBeTruthy();
  });

  it('renders failed state as info-level message', () => {
    render(
      <PresetEnrichmentBadge
        state="failed"
        applied={0}
        skipped={0}
        onCancel={() => {}}
      />,
    );
    const badge = screen.getByTestId('preset-enrichment-badge');
    expect(badge).toHaveAttribute('data-state', 'failed');
    expect(screen.getByText(/深度微调不可用/)).toBeTruthy();
  });

  it('renders nothing when state is cancelled', () => {
    const { container } = render(
      <PresetEnrichmentBadge
        state="cancelled"
        applied={0}
        skipped={0}
        onCancel={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
