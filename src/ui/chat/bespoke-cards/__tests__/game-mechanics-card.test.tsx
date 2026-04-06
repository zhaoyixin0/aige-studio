import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameMechanicsCard } from '../game-mechanics-card';
import type { ParameterMeta } from '@/data/parameter-registry';

const MOCK_PARAMS: Record<string, ParameterMeta> = {
  'game_mechanics_001': {
    id: 'game_mechanics_001',
    name: '得分系统',
    layer: 'L2',
    category: 'game_mechanics',
    mvp: 'P0',
    exposure: 'direct',
    controlType: 'toggle',
    gameTypes: ['ALL'],
    defaultValue: true,
    options: ['开启', '关闭'],
    description: '是否开启分数统计模块',
  },
  'game_mechanics_002': {
    id: 'game_mechanics_002',
    name: '碰撞系统',
    layer: 'L2',
    category: 'game_mechanics',
    mvp: 'P0',
    exposure: 'direct',
    controlType: 'toggle',
    gameTypes: ['ALL'],
    defaultValue: true,
    options: ['开启', '关闭'],
    description: '对象间物理接触与触发侦听',
  },
  'game_mechanics_008': {
    id: 'game_mechanics_008',
    name: '跳跃',
    layer: 'L2',
    category: 'game_mechanics',
    mvp: 'P1',
    exposure: 'direct',
    controlType: 'toggle',
    gameTypes: ['runner', 'platformer'],
    defaultValue: true,
    options: ['开启', '关闭'],
    description: '处理纵向位移的系统模块',
  },
  'game_mechanics_099': {
    id: 'game_mechanics_099',
    name: '自定义规则',
    layer: 'L2',
    category: 'game_mechanics',
    mvp: 'P2',
    exposure: 'direct',
    controlType: 'toggle',
    gameTypes: ['ALL'],
    defaultValue: false,
    description: '测试用的未分组参数',
  },
};

vi.mock('@/data/parameter-registry', () => ({
  getParamById: (id: string) => MOCK_PARAMS[id],
}));

describe('GameMechanicsCard', () => {
  const onChange = vi.fn();

  it('renders section titles for known groups', () => {
    render(
      <GameMechanicsCard
        category="game_mechanics"
        paramIds={['game_mechanics_001', 'game_mechanics_002', 'game_mechanics_008']}
        isActive={true}
        onParamChange={onChange}
      />,
    );

    expect(screen.getByText('核心规则')).toBeInTheDocument();
    expect(screen.getByText('移动与物理')).toBeInTheDocument();
    expect(screen.getByText('得分系统')).toBeInTheDocument();
    expect(screen.getByText('碰撞系统')).toBeInTheDocument();
    expect(screen.getByText('跳跃')).toBeInTheDocument();
  });

  it('puts ungrouped params in "其他" section', () => {
    render(
      <GameMechanicsCard
        category="game_mechanics"
        paramIds={['game_mechanics_099']}
        isActive={true}
        onParamChange={onChange}
      />,
    );

    expect(screen.getByText('其他')).toBeInTheDocument();
    expect(screen.getByText('自定义规则')).toBeInTheDocument();
  });

  it('calls onParamChange when a toggle is clicked', () => {
    onChange.mockClear();
    render(
      <GameMechanicsCard
        category="game_mechanics"
        paramIds={['game_mechanics_001']}
        isActive={true}
        onParamChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith('game_mechanics_001', false);
  });

  it('renders tombstone when isActive=false', () => {
    render(
      <GameMechanicsCard
        category="game_mechanics"
        paramIds={['game_mechanics_001']}
        isActive={false}
        onParamChange={onChange}
      />,
    );

    // No interactive controls
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    // Tombstone shows param name
    expect(screen.getByTestId('gui-param-card').textContent).toContain('得分系统');
  });
});
