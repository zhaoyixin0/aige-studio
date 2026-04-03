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
