import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ParamCategoryGroup } from '../param-category-group';
import type { ParameterMeta } from '@/data/parameter-registry';

const makeMockParam = (overrides: Partial<ParameterMeta> = {}): ParameterMeta => ({
  id: 'test_001',
  name: '测试参数',
  layer: 'L2',
  category: 'game_mechanics',
  mvp: 'P0',
  exposure: 'direct',
  controlType: 'toggle',
  gameTypes: ['ALL'],
  defaultValue: true,
  description: '测试',
  ...overrides,
});

describe('ParamCategoryGroup', () => {
  it('renders category title', () => {
    render(
      <ParamCategoryGroup
        category="game_mechanics"
        params={[makeMockParam()]}
        values={new Map()}
        onParamChange={vi.fn()}
      />
    );
    expect(screen.getByText('游戏机制')).toBeTruthy();
  });

  it('renders params as controls', () => {
    render(
      <ParamCategoryGroup
        category="game_mechanics"
        params={[makeMockParam({ name: '碰撞系统', controlType: 'toggle' })]}
        values={new Map()}
        onParamChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText('碰撞系统')).toBeTruthy();
  });

  it('is collapsible — starts expanded', () => {
    render(
      <ParamCategoryGroup
        category="game_mechanics"
        params={[makeMockParam()]}
        values={new Map()}
        onParamChange={vi.fn()}
      />
    );
    // Controls should be visible
    expect(screen.getByRole('switch')).toBeTruthy();
  });

  it('collapses when header button clicked', () => {
    render(
      <ParamCategoryGroup
        category="game_mechanics"
        params={[makeMockParam()]}
        values={new Map()}
        onParamChange={vi.fn()}
      />
    );
    // Click the collapse button (which contains the category text)
    const collapseBtn = screen.getByRole('button', { name: /游戏机制/i });
    fireEvent.click(collapseBtn);
    // Controls should be hidden
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('calls onParamChange with paramId and value', () => {
    const onChange = vi.fn();
    render(
      <ParamCategoryGroup
        category="game_mechanics"
        params={[makeMockParam({ id: 'gm_001', name: '得分系统' })]}
        values={new Map()}
        onParamChange={onChange}
      />
    );
    screen.getByRole('switch').click();
    expect(onChange).toHaveBeenCalledWith('gm_001', expect.anything());
  });

  it('renders nothing when params array is empty', () => {
    const { container } = render(
      <ParamCategoryGroup
        category="game_mechanics"
        params={[]}
        values={new Map()}
        onParamChange={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe('');
  });
});

describe('ParamCategoryGroup — React.memo', () => {
  it('is wrapped in React.memo (has $$typeof or compare function)', () => {
    // React.memo components have a 'type' with a 'compare' property, or
    // the component itself is a memo exotic element
    // We check that ParamCategoryGroup is a memo component
    expect(
      (ParamCategoryGroup as unknown as { $$typeof: symbol }).$$typeof?.toString(),
    ).toBe('Symbol(react.memo)');
  });

  it('does not re-render when unrelated map values change', () => {
    // Render with initial values
    const param = makeMockParam({ id: 'gm_001', name: '得分系统' });
    const values1 = new Map<string, unknown>([
      ['gm_001', true],
      ['other_param', 10],
    ]);
    const onChange = vi.fn();

    render(
      <ParamCategoryGroup
        category="game_mechanics"
        params={[param]}
        values={values1}
        onParamChange={onChange}
      />,
    );

    // Rerender with a NEW map that has same values for gm_001 but different for other_param
    const values2 = new Map<string, unknown>([
      ['gm_001', true],
      ['other_param', 999],  // changed unrelated value
    ]);

    // The memo areEqual should see that gm_001 value is still the same
    // and skip re-rendering. We verify by checking the memo compare function exists.
    const memoType = ParamCategoryGroup as unknown as { compare: Function };
    expect(typeof memoType.compare).toBe('function');

    // Directly test the compare function
    const prevProps = {
      category: 'game_mechanics',
      params: [param],
      values: values1,
      onParamChange: onChange,
    };
    const nextProps = {
      category: 'game_mechanics',
      params: [param],
      values: values2,
      onParamChange: onChange,
    };

    // areEqual returns true when props are "equal" (should NOT re-render)
    expect(memoType.compare(prevProps, nextProps)).toBe(true);
  });

  it('re-renders when the groups own param values change', () => {
    const param = makeMockParam({ id: 'gm_001', name: '得分系统' });
    const onChange = vi.fn();

    const values1 = new Map<string, unknown>([['gm_001', true]]);
    const values2 = new Map<string, unknown>([['gm_001', false]]);

    const memoType = ParamCategoryGroup as unknown as { compare: Function };
    const prevProps = {
      category: 'game_mechanics',
      params: [param],
      values: values1,
      onParamChange: onChange,
    };
    const nextProps = {
      category: 'game_mechanics',
      params: [param],
      values: values2,
      onParamChange: onChange,
    };

    // areEqual returns false — group's value changed, should re-render
    expect(memoType.compare(prevProps, nextProps)).toBe(false);
  });

  it('re-renders when params list changes', () => {
    const param1 = makeMockParam({ id: 'gm_001' });
    const param2 = makeMockParam({ id: 'gm_002' });
    const onChange = vi.fn();
    const values = new Map<string, unknown>();

    const memoType = ParamCategoryGroup as unknown as { compare: Function };

    expect(
      memoType.compare(
        { category: 'game_mechanics', params: [param1], values, onParamChange: onChange },
        { category: 'game_mechanics', params: [param1, param2], values, onParamChange: onChange },
      ),
    ).toBe(false);
  });

  it('re-renders when onParamChange callback changes', () => {
    const param = makeMockParam({ id: 'gm_001' });
    const values = new Map<string, unknown>();

    const memoType = ParamCategoryGroup as unknown as { compare: Function };

    expect(
      memoType.compare(
        { category: 'game_mechanics', params: [param], values, onParamChange: vi.fn() },
        { category: 'game_mechanics', params: [param], values, onParamChange: vi.fn() },
      ),
    ).toBe(false);
  });
});
