import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssetPreviewBlock } from '../asset-preview-block';
import type { AssetPreviewItem, ChatBlock } from '@/agent/conversation-defs';

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function makeBlock(items: AssetPreviewItem[]): Extract<ChatBlock, { kind: 'asset-preview' }> {
  return { kind: 'asset-preview', items, allowApplyAll: false };
}

const dataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Zy2j/AAAAAASUVORK5CYII=';

/* ------------------------------------------------------------------ */
/*  C1 — Skeleton loading state                                         */
/* ------------------------------------------------------------------ */

describe('AssetPreviewBlock — loading state', () => {
  it('renders skeleton when item.src is empty string', () => {
    const block = makeBlock([
      { key: 'good_1', label: 'good_1', src: '', source: 'ai' },
    ]);
    render(<AssetPreviewBlock block={block} />);

    expect(screen.getByText('生成中')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders skeleton when item.src is undefined', () => {
    const block = makeBlock([
      { key: 'good_1', label: 'good_1', src: undefined as unknown as string, source: 'ai' },
    ]);
    render(<AssetPreviewBlock block={block} />);

    expect(screen.getByText('生成中')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders image element when item.src is a valid data URL', () => {
    const block = makeBlock([
      { key: 'good_1', label: 'good_1', src: dataUrl, source: 'ai' },
    ]);
    render(<AssetPreviewBlock block={block} />);

    const img = screen.getByRole('img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toBe(dataUrl);
    expect(screen.queryByText('生成中')).toBeNull();
  });

  it('skeleton contains spinner and "生成中" text', () => {
    const block = makeBlock([
      { key: 'good_1', label: 'good_1', src: '', source: 'ai' },
    ]);
    const { container } = render(<AssetPreviewBlock block={block} />);

    expect(screen.getByText('生成中')).toBeTruthy();
    // Spinner: lucide Loader2 renders an <svg> with animate-spin
    const spinner = container.querySelector('svg.animate-spin');
    expect(spinner).not.toBeNull();
    // Skeleton container uses animate-pulse
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).not.toBeNull();
  });

  it('image has fade-in animation classes', () => {
    const block = makeBlock([
      { key: 'good_1', label: 'good_1', src: dataUrl, source: 'ai' },
    ]);
    render(<AssetPreviewBlock block={block} />);

    const img = screen.getByRole('img');
    const classes = img.className;
    expect(classes).toContain('animate-in');
    expect(classes).toContain('fade-in');
    expect(classes).toContain('zoom-in-95');
  });

  it('renders multiple items with mixed states correctly', () => {
    const block = makeBlock([
      { key: 'good_1', label: 'good_1', src: dataUrl, source: 'ai' },
      { key: 'good_2', label: 'good_2', src: '', source: 'ai' },
      { key: 'bad_1', label: 'bad_1', src: dataUrl, source: 'ai' },
      { key: 'bad_2', label: 'bad_2', src: '', source: 'ai' },
    ]);
    render(<AssetPreviewBlock block={block} />);

    // Two real images
    const imgs = screen.getAllByRole('img');
    expect(imgs).toHaveLength(2);

    // Two skeletons (两个"生成中")
    const loadingTexts = screen.getAllByText('生成中');
    expect(loadingTexts).toHaveLength(2);
  });
});
