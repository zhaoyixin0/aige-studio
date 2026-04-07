import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatBlockRenderer } from '../chat-block-renderer';
import type { ChatBlock } from '@/agent/conversation-defs';

/* ------------------------------------------------------------------ */
/*  Mock child components                                               */
/* ------------------------------------------------------------------ */

vi.mock('../asset-preview-block', () => ({
  AssetPreviewBlock: ({ block }: { block: Extract<ChatBlock, { kind: 'asset-preview' }> }) => (
    <div data-testid="asset-preview">{block.items.length} items</div>
  ),
}));

vi.mock('../param-card', () => ({
  ParamCard: ({ block, disabled }: { block: Extract<ChatBlock, { kind: 'param-card' }>; disabled?: boolean }) => (
    <div
      data-testid="param-card"
      className={disabled ? 'pointer-events-none opacity-50' : ''}
    >
      {block.title ?? 'param-card'}
    </div>
  ),
}));

vi.mock('../progress-log-block', () => ({
  ProgressLogBlock: ({ block }: { block: Extract<ChatBlock, { kind: 'progress-log' }> }) => (
    <div data-testid="progress-log">{block.entries.length} entries</div>
  ),
}));

vi.mock('../upload-request-block', () => ({
  UploadRequestBlock: ({ block }: { block: Extract<ChatBlock, { kind: 'upload-request' }> }) => (
    <div data-testid="upload-request">{block.target}</div>
  ),
}));

/* ------------------------------------------------------------------ */
/*  Test fixtures                                                       */
/* ------------------------------------------------------------------ */

const assetPreviewBlock: ChatBlock = {
  kind: 'asset-preview',
  items: [{ key: 'a', label: 'A', src: '/a.png', source: 'ai' }],
};

const paramCardBlock: ChatBlock = {
  kind: 'param-card',
  title: 'Test Params',
  fields: [{ kind: 'toggle', key: 'foo', label: 'Foo', value: true }],
};

const progressLogBlock: ChatBlock = {
  kind: 'progress-log',
  entries: [{ key: 'item1', status: 'done', message: 'Done' }],
};

const uploadRequestBlock: ChatBlock = {
  kind: 'upload-request',
  target: 'player',
  accept: ['image'],
  hint: '上传角色图片',
};

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe('ChatBlockRenderer', () => {
  it('renders asset-preview block', () => {
    render(
      <ChatBlockRenderer
        blocks={[assetPreviewBlock]}
        isLatestAssistant={true}
      />,
    );

    expect(screen.getByTestId('asset-preview')).toBeInTheDocument();
    expect(screen.getByTestId('asset-preview').textContent).toBe('1 items');
  });

  it('renders param-card as interactive when isLatestAssistant=true', () => {
    render(
      <ChatBlockRenderer
        blocks={[paramCardBlock]}
        isLatestAssistant={true}
      />,
    );

    const card = screen.getByTestId('param-card');
    expect(card).toBeInTheDocument();
    expect(card.className).not.toContain('opacity-50');
    expect(card.className).not.toContain('pointer-events-none');
  });

  it('renders param-card as disabled when isLatestAssistant=false', () => {
    render(
      <ChatBlockRenderer
        blocks={[paramCardBlock]}
        isLatestAssistant={false}
      />,
    );

    const card = screen.getByTestId('param-card');
    expect(card).toBeInTheDocument();
    expect(card.className).toContain('opacity-50');
  });

  it('renders progress-log block', () => {
    render(
      <ChatBlockRenderer
        blocks={[progressLogBlock]}
        isLatestAssistant={true}
      />,
    );

    expect(screen.getByTestId('progress-log')).toBeInTheDocument();
    expect(screen.getByTestId('progress-log').textContent).toBe('1 entries');
  });

  it('hides upload-request when not latest assistant', () => {
    render(
      <ChatBlockRenderer
        blocks={[uploadRequestBlock]}
        isLatestAssistant={false}
      />,
    );

    expect(screen.queryByTestId('upload-request')).not.toBeInTheDocument();
  });

  it('renders upload-request when latest assistant', () => {
    render(
      <ChatBlockRenderer
        blocks={[uploadRequestBlock]}
        isLatestAssistant={true}
      />,
    );

    expect(screen.getByTestId('upload-request')).toBeInTheDocument();
    expect(screen.getByTestId('upload-request').textContent).toBe('player');
  });

  it('renders multiple blocks in order', () => {
    render(
      <ChatBlockRenderer
        blocks={[assetPreviewBlock, progressLogBlock]}
        isLatestAssistant={true}
      />,
    );

    expect(screen.getByTestId('asset-preview')).toBeInTheDocument();
    expect(screen.getByTestId('progress-log')).toBeInTheDocument();
  });

  it('renders empty blocks array without error', () => {
    const { container } = render(
      <ChatBlockRenderer blocks={[]} isLatestAssistant={true} />,
    );

    expect(container.firstChild).toBeInTheDocument();
  });
});
