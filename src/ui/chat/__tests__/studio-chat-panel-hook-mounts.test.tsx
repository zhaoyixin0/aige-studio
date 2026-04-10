/**
 * P4 task 1.2 — verifies StudioChatPanel mounts usePresetAdvice hook
 * so the signature-drift detector actually runs after a preset is
 * loaded. Also re-verifies usePresetEnrichment mount.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useEditorStore } from '@/store/editor-store';
import { useAssetFulfillmentStore } from '@/store/asset-fulfillment-store';

const enrichmentHookSpy = vi.fn();
const adviceHookSpy = vi.fn();

vi.mock('@/app/hooks/use-preset-enrichment', () => ({
  usePresetEnrichment: () => {
    enrichmentHookSpy();
    return {
      state: 'idle' as const,
      applied: 0,
      skipped: 0,
      skippedPaths: [] as string[],
      cancelEnrichment: () => {},
    };
  },
}));

vi.mock('@/app/hooks/use-preset-advice', () => ({
  usePresetAdvice: () => {
    adviceHookSpy();
  },
}));

vi.mock('@/app/hooks/use-conversation-manager', () => ({
  useConversationManager: () => ({ submitMessage: vi.fn() }),
}));

vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
Element.prototype.scrollIntoView = vi.fn();

const { StudioChatPanel } = await import('../studio-chat-panel');

describe('StudioChatPanel — hook mounts', () => {
  beforeEach(() => {
    enrichmentHookSpy.mockClear();
    adviceHookSpy.mockClear();
    useEditorStore.setState({
      chatMessages: [],
      isChatLoading: false,
      suggestionChips: [],
    });
    useAssetFulfillmentStore.setState({ isActive: false, controller: null });
  });

  it('calls usePresetEnrichment on mount', () => {
    render(<StudioChatPanel />);
    expect(enrichmentHookSpy).toHaveBeenCalled();
  });

  it('calls usePresetAdvice on mount (P4 task 1.2)', () => {
    render(<StudioChatPanel />);
    expect(adviceHookSpy).toHaveBeenCalled();
  });
});
