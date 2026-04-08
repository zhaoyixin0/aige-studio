import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ProgressLogBlock } from '../progress-log-block';
import type { ChatBlock, ProgressEntry } from '@/agent/conversation-defs';

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function makeBlock(entries: ProgressEntry[]): Extract<ChatBlock, { kind: 'progress-log' }> {
  return { kind: 'progress-log', entries };
}

/* ------------------------------------------------------------------ */
/*  C2 — active highlighting + aria-live                                */
/* ------------------------------------------------------------------ */

describe('ProgressLogBlock — streaming highlights + aria', () => {
  it('renders one row per entry', () => {
    const block = makeBlock([
      { key: 'background', status: 'done', message: '背景 background' },
      { key: 'good_1', status: 'generating', message: '生成中 good_1' },
      { key: 'good_2', status: 'pending', message: '等待中 good_2' },
    ]);
    render(<ProgressLogBlock block={block} />);

    expect(screen.getByText('背景 background')).toBeTruthy();
    expect(screen.getByText('生成中 good_1')).toBeTruthy();
    expect(screen.getByText('等待中 good_2')).toBeTruthy();
  });

  it('active entry (generating) has highlight class text-white font-medium', () => {
    const block = makeBlock([
      { key: 'good_1', status: 'generating', message: '生成中 good_1' },
    ]);
    render(<ProgressLogBlock block={block} />);

    const span = screen.getByText('生成中 good_1');
    expect(span.className).toContain('text-white');
    expect(span.className).toContain('font-medium');
    expect(span.className).toContain('drop-shadow');
  });

  it('active entry (removing-bg) is highlighted too', () => {
    const block = makeBlock([
      { key: 'good_1', status: 'removing-bg', message: '去背景 good_1' },
    ]);
    render(<ProgressLogBlock block={block} />);

    const span = screen.getByText('去背景 good_1');
    expect(span.className).toContain('text-white');
    expect(span.className).toContain('font-medium');
  });

  it('done entry has dimmed class text-white/40', () => {
    const block = makeBlock([
      { key: 'background', status: 'done', message: 'done background' },
    ]);
    render(<ProgressLogBlock block={block} />);

    const span = screen.getByText('done background');
    expect(span.className).toContain('text-white/40');
  });

  it('error entry has red class text-red-400', () => {
    const block = makeBlock([
      { key: 'bad_1', status: 'error', message: 'failed bad_1' },
    ]);
    render(<ProgressLogBlock block={block} />);

    const span = screen.getByText('failed bad_1');
    expect(span.className).toContain('text-red-400');
  });

  it('skipped entry has line-through class', () => {
    const block = makeBlock([
      { key: 'good_1', status: 'skipped', message: 'skip good_1' },
    ]);
    render(<ProgressLogBlock block={block} />);

    const span = screen.getByText('skip good_1');
    expect(span.className).toContain('line-through');
  });

  it('aria-live region contains active entry label', () => {
    const block = makeBlock([
      { key: 'background', status: 'done', message: 'bg done' },
      { key: 'good_1', status: 'generating', message: '生成中 good_1' },
      { key: 'good_2', status: 'pending', message: '等待中 good_2' },
    ]);
    const { container } = render(<ProgressLogBlock block={block} />);

    const live = container.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(live?.getAttribute('role')).toBe('status');
    expect(live?.className).toContain('sr-only');
    expect(live?.textContent ?? '').toContain('生成中 good_1');
  });

  it('aria-live region is empty when no entry is generating', () => {
    const block = makeBlock([
      { key: 'background', status: 'done', message: 'bg done' },
      { key: 'good_1', status: 'done', message: 'good_1 done' },
    ]);
    const { container } = render(<ProgressLogBlock block={block} />);

    const live = container.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect((live?.textContent ?? '').trim()).toBe('');
  });

  it('StatusIcon renders correct icon for each of 6 statuses', () => {
    const statuses: ProgressEntry['status'][] = [
      'pending',
      'generating',
      'removing-bg',
      'done',
      'error',
      'skipped',
    ];
    for (const status of statuses) {
      const block = makeBlock([
        { key: `k_${status}`, status, message: `msg ${status}` },
      ]);
      const { container, unmount } = render(<ProgressLogBlock block={block} />);
      // every row should render at least one svg (icon)
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThanOrEqual(1);
      unmount();
    }
  });

  it('span has transition-colors class for smooth re-render', () => {
    const block = makeBlock([
      { key: 'good_1', status: 'generating', message: '生成中 good_1' },
    ]);
    render(<ProgressLogBlock block={block} />);
    const span = screen.getByText('生成中 good_1');
    expect(span.className).toContain('transition-colors');
  });

  it('transitioning pending → generating → done updates classes correctly on re-render', () => {
    const block1 = makeBlock([
      { key: 'good_1', status: 'pending', message: 'good_1 msg' },
    ]);
    const { rerender } = render(<ProgressLogBlock block={block1} />);
    let span = screen.getByText('good_1 msg');
    expect(span.className).toContain('text-white/70');

    const block2 = makeBlock([
      { key: 'good_1', status: 'generating', message: 'good_1 msg' },
    ]);
    rerender(<ProgressLogBlock block={block2} />);
    span = screen.getByText('good_1 msg');
    expect(span.className).toContain('text-white');
    expect(span.className).toContain('font-medium');

    const block3 = makeBlock([
      { key: 'good_1', status: 'done', message: 'good_1 msg' },
    ]);
    rerender(<ProgressLogBlock block={block3} />);
    span = screen.getByText('good_1 msg');
    expect(span.className).toContain('text-white/40');
  });
});

// quiet unused import warnings
void within;
