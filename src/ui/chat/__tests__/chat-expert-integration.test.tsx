import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageList } from '../message-list';
import type { ChatMessage } from '@/store/editor-store';

beforeAll(() => {
  // jsdom doesn't implement scrollIntoView
  Element.prototype.scrollIntoView = () => {};
});

describe('Chat Expert Message Integration', () => {
  it('renders expert_insight message type', () => {
    const messages: ChatMessage[] = [{
      id: 'e1',
      role: 'assistant',
      content: 'Based on expert analysis:',
      timestamp: Date.now(),
      expertInsight: {
        title: 'Physics Tip',
        body: 'Use Box colliders for walls',
      },
    }];
    render(<MessageList messages={messages} isLoading={false} />);
    expect(screen.getByText('Physics Tip')).toBeDefined();
    expect(screen.getByText('Use Box colliders for walls')).toBeDefined();
  });

  it('renders module_tuning message type', () => {
    const messages: ChatMessage[] = [{
      id: 'e2',
      role: 'assistant',
      content: 'Recommended tuning:',
      timestamp: Date.now(),
      moduleTuning: {
        title: 'Dodge Expert',
        modules: [
          { name: 'Spawner', params: [{ name: 'frequency', value: 1.2 }] },
        ],
      },
    }];
    render(<MessageList messages={messages} isLoading={false} />);
    expect(screen.getByText('Dodge Expert')).toBeDefined();
    expect(screen.getByText('Spawner')).toBeDefined();
    expect(screen.getByText('frequency')).toBeDefined();
  });
});
