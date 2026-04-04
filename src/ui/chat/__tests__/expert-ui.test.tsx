import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ParameterPill } from '../parameter-pill';
import { ExpertInsightBlock } from '../expert-insight-block';

describe('ParameterPill', () => {
  it('renders param name and value', () => {
    render(<ParameterPill name="gravity" value={9.8} />);
    expect(screen.getByText('gravity')).toBeDefined();
    expect(screen.getByText('9.8')).toBeDefined();
  });

  it('renders as inline element', () => {
    const { container } = render(<ParameterPill name="speed" value={200} />);
    const pill = container.firstChild as HTMLElement;
    expect(pill.className).toContain('inline-flex');
  });

  it('applies clickable styles when onClick provided', () => {
    const { container } = render(
      <ParameterPill name="test" value={1} onClick={() => {}} />,
    );
    const pill = container.firstChild as HTMLElement;
    expect(pill.className).toContain('cursor-pointer');
  });
});

describe('ExpertInsightBlock', () => {
  it('renders children', () => {
    render(
      <ExpertInsightBlock title="Expert Tip">
        <span>Expert content here</span>
      </ExpertInsightBlock>,
    );
    expect(screen.getByText('Expert content here')).toBeDefined();
  });

  it('renders title', () => {
    render(
      <ExpertInsightBlock title="Physics Tuning">
        <span>Content</span>
      </ExpertInsightBlock>,
    );
    expect(screen.getByText('Physics Tuning')).toBeDefined();
  });

  it('has distinct styling (border + background)', () => {
    const { container } = render(
      <ExpertInsightBlock title="Test">
        <span>C</span>
      </ExpertInsightBlock>,
    );
    const block = container.firstChild as HTMLElement;
    expect(block.className).toContain('border');
    expect(block.className).toContain('rounded');
  });
});
