import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ChatBlock } from '@/agent/conversation-defs';

/* ------------------------------------------------------------------ */
/*  Mock stores                                                         */
/* ------------------------------------------------------------------ */

vi.mock('@/store/game-store', () => ({
  useGameStore: (selector: (s: unknown) => unknown) =>
    selector({
      updateModuleParamLive: vi.fn(),
      config: null,
    }),
}));

vi.mock('@/store/editor-store', () => ({
  useEditorStore: (selector: (s: unknown) => unknown) =>
    selector({
      addPendingAttachment: vi.fn(),
    }),
}));

/* ------------------------------------------------------------------ */
/*  Tests: ParamCard disabled prop                                      */
/* ------------------------------------------------------------------ */

describe('ParamCard', () => {
  it('renders with disabled class when disabled=true', async () => {
    const { ParamCard } = await import('../param-card');

    const block: Extract<ChatBlock, { kind: 'param-card' }> = {
      kind: 'param-card',
      title: 'Settings',
      fields: [{ kind: 'toggle', key: 'enable', label: 'Enable', value: false }],
    };

    const { container } = render(<ParamCard block={block} disabled={true} />);
    const root = container.firstChild as HTMLElement;

    expect(root.className).toContain('pointer-events-none');
    expect(root.className).toContain('opacity-50');
  });

  it('renders without disabled class when disabled=false', async () => {
    const { ParamCard } = await import('../param-card');

    const block: Extract<ChatBlock, { kind: 'param-card' }> = {
      kind: 'param-card',
      title: 'Settings',
      fields: [{ kind: 'toggle', key: 'enable', label: 'Enable', value: true }],
    };

    const { container } = render(<ParamCard block={block} disabled={false} />);
    const root = container.firstChild as HTMLElement;

    expect(root.className).not.toContain('opacity-50');
    expect(root.className).not.toContain('pointer-events-none');
  });

  it('renders without disabled class when disabled is omitted', async () => {
    const { ParamCard } = await import('../param-card');

    const block: Extract<ChatBlock, { kind: 'param-card' }> = {
      kind: 'param-card',
      fields: [{ kind: 'slider', key: 'speed', label: 'Speed', min: 0, max: 100, value: 50 }],
    };

    const { container } = render(<ParamCard block={block} />);
    const root = container.firstChild as HTMLElement;

    expect(root.className).not.toContain('opacity-50');
  });
});

/* ------------------------------------------------------------------ */
/*  Tests: ProgressLogBlock skipped status                             */
/* ------------------------------------------------------------------ */

describe('ProgressLogBlock', () => {
  it('renders skipped status without crashing', async () => {
    const { ProgressLogBlock } = await import('../progress-log-block');

    const block: Extract<ChatBlock, { kind: 'progress-log' }> = {
      kind: 'progress-log',
      entries: [
        { key: 'item1', status: 'skipped', message: 'Skipped this item' },
        { key: 'item2', status: 'done', message: 'Done' },
      ],
    };

    render(<ProgressLogBlock block={block} />);

    expect(screen.getByText('Skipped this item')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('renders all status types correctly', async () => {
    const { ProgressLogBlock } = await import('../progress-log-block');

    const block: Extract<ChatBlock, { kind: 'progress-log' }> = {
      kind: 'progress-log',
      entries: [
        { key: 'a', status: 'pending', message: 'Pending' },
        { key: 'b', status: 'generating', message: 'Generating' },
        { key: 'c', status: 'done', message: 'Done' },
        { key: 'd', status: 'error', message: 'Error' },
        { key: 'e', status: 'skipped', message: 'Skipped' },
      ],
    };

    render(<ProgressLogBlock block={block} />);

    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Generating')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Skipped')).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/*  Tests: dispatchUIAction                                             */
/* ------------------------------------------------------------------ */

describe('dispatchUIAction', () => {
  let receivedEvents: CustomEvent[] = [];
  let listener: (e: Event) => void;

  beforeEach(() => {
    receivedEvents = [];
    listener = (e: Event) => {
      receivedEvents.push(e as CustomEvent);
    };
    window.addEventListener('ui-action', listener);
  });

  afterEach(() => {
    window.removeEventListener('ui-action', listener);
  });

  it('dispatches CustomEvent with correct detail', async () => {
    const { dispatchUIAction } = await import('../ui-action-executor');

    dispatchUIAction({ type: 'REQUEST_ASSETS_GENERATE', keys: ['good_1'], showPreview: true });

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].type).toBe('ui-action');
    expect(receivedEvents[0].detail).toEqual({
      type: 'REQUEST_ASSETS_GENERATE',
      keys: ['good_1'],
      showPreview: true,
    });
  });

  it('dispatches REQUEST_ASSET_REPLACE action', async () => {
    const { dispatchUIAction } = await import('../ui-action-executor');

    dispatchUIAction({ type: 'REQUEST_ASSET_REPLACE', target: 'player', accept: ['image'] });

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].detail).toMatchObject({
      type: 'REQUEST_ASSET_REPLACE',
      target: 'player',
    });
  });

  it('dispatches SHOW_ASSET_PREVIEWS action', async () => {
    const { dispatchUIAction } = await import('../ui-action-executor');

    const items = [{ key: 'a', label: 'A', src: '/a.png', source: 'ai' as const }];
    dispatchUIAction({ type: 'SHOW_ASSET_PREVIEWS', items });

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].detail.items).toEqual(items);
  });
});
