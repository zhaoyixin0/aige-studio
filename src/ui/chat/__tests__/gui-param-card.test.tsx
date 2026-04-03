import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GuiParamCard } from '../gui-param-card';
import type { ParameterMeta } from '@/data/parameter-registry';

/* ------------------------------------------------------------------ */
/*  Mock parameter-registry                                            */
/* ------------------------------------------------------------------ */

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
  'game_mechanics_004': {
    id: 'game_mechanics_004',
    name: '触控输入',
    layer: 'L3',
    category: 'game_mechanics',
    mvp: 'P0',
    exposure: 'direct',
    controlType: 'segmented',
    gameTypes: ['ALL'],
    defaultValue: '单击',
    options: ['单击', '滑动', '倾斜'],
    description: '滑动、点击或重力感应的映射',
  },
  'game_mechanics_011': {
    id: 'game_mechanics_011',
    name: '车速',
    layer: 'L3',
    category: 'game_mechanics',
    mvp: 'P1',
    exposure: 'direct',
    controlType: 'slider',
    gameTypes: ['racing', 'runner'],
    defaultValue: '中',
    options: ['慢', '中', '快'],
    description: '载体在航道上的位移速率',
  },
  'visual_audio_003': {
    id: 'visual_audio_003',
    name: '视觉风格',
    layer: 'L2',
    category: 'visual_audio',
    mvp: 'P0',
    exposure: 'composite',
    controlType: 'asset_picker',
    gameTypes: ['ALL'],
    defaultValue: '经典',
    options: ['经典', '赛博', '清新'],
    description: '全美术资源风格切换总闸',
  },
  'stepper_param': {
    id: 'stepper_param',
    name: '生命数量',
    layer: 'L3',
    category: 'game_mechanics',
    mvp: 'P1',
    exposure: 'direct',
    controlType: 'stepper',
    gameTypes: ['ALL'],
    defaultValue: 3,
    description: '玩家初始生命数',
  },
  'input_param': {
    id: 'input_param',
    name: '玩家名称',
    layer: 'L3',
    category: 'game_mechanics',
    mvp: 'P2',
    exposure: 'direct',
    controlType: 'input_field',
    gameTypes: ['ALL'],
    defaultValue: 'Player',
    description: '玩家显示名称',
  },
};

vi.mock('@/data/parameter-registry', () => ({
  getParamById: (id: string) => MOCK_PARAMS[id],
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('GuiParamCard', () => {
  const defaultOnChange = vi.fn();

  beforeEach(() => {
    defaultOnChange.mockClear();
  });

  /* 1. Renders card with category title */
  it('renders card with category title', () => {
    render(
      <GuiParamCard
        category="game_mechanics"
        paramIds={['game_mechanics_001']}
        title="游戏机制"
        isActive={true}
        onParamChange={defaultOnChange}
      />,
    );

    expect(screen.getByText('游戏机制')).toBeInTheDocument();
  });

  /* 2. Renders controls based on controlType */
  describe('renders parameter controls based on controlType', () => {
    it('renders toggle control for toggle type', () => {
      render(
        <GuiParamCard
          category="game_mechanics"
          paramIds={['game_mechanics_001']}
          isActive={true}
          onParamChange={defaultOnChange}
        />,
      );

      // Toggle should render a switch/checkbox
      const toggle = screen.getByRole('switch');
      expect(toggle).toBeInTheDocument();
      expect(screen.getByText('得分系统')).toBeInTheDocument();
    });

    it('renders segmented control for segmented type', () => {
      render(
        <GuiParamCard
          category="game_mechanics"
          paramIds={['game_mechanics_004']}
          isActive={true}
          onParamChange={defaultOnChange}
        />,
      );

      const radiogroup = screen.getByRole('radiogroup');
      expect(radiogroup).toBeInTheDocument();
      expect(screen.getByText('单击')).toBeInTheDocument();
      expect(screen.getByText('滑动')).toBeInTheDocument();
      expect(screen.getByText('倾斜')).toBeInTheDocument();
    });

    it('renders slider control for slider type', () => {
      render(
        <GuiParamCard
          category="game_mechanics"
          paramIds={['game_mechanics_011']}
          isActive={true}
          onParamChange={defaultOnChange}
        />,
      );

      const slider = screen.getByRole('slider');
      expect(slider).toBeInTheDocument();
      expect(screen.getByText('车速')).toBeInTheDocument();
    });

    it('renders stepper control for stepper type', () => {
      render(
        <GuiParamCard
          category="game_mechanics"
          paramIds={['stepper_param']}
          isActive={true}
          onParamChange={defaultOnChange}
        />,
      );

      // StepperControl renders a group with +/- buttons
      const group = screen.getByRole('group');
      expect(group).toBeInTheDocument();
      expect(screen.getByText('生命数量')).toBeInTheDocument();
    });

    it('renders input field for input_field type', () => {
      render(
        <GuiParamCard
          category="game_mechanics"
          paramIds={['input_param']}
          isActive={true}
          onParamChange={defaultOnChange}
        />,
      );

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(screen.getByText('玩家名称')).toBeInTheDocument();
    });
  });

  /* 3. Calls onChange callback when a control value changes */
  it('calls onChange callback when a toggle is clicked', () => {
    render(
      <GuiParamCard
        category="game_mechanics"
        paramIds={['game_mechanics_001']}
        isActive={true}
        onParamChange={defaultOnChange}
      />,
    );

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    expect(defaultOnChange).toHaveBeenCalledWith('game_mechanics_001', false);
  });

  it('calls onChange callback when segmented option is clicked', () => {
    render(
      <GuiParamCard
        category="game_mechanics"
        paramIds={['game_mechanics_004']}
        isActive={true}
        onParamChange={defaultOnChange}
      />,
    );

    fireEvent.click(screen.getByText('滑动'));

    expect(defaultOnChange).toHaveBeenCalledWith('game_mechanics_004', '滑动');
  });

  it('calls onChange callback when input field changes', () => {
    render(
      <GuiParamCard
        category="game_mechanics"
        paramIds={['input_param']}
        isActive={true}
        onParamChange={defaultOnChange}
      />,
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'NewName' } });

    expect(defaultOnChange).toHaveBeenCalledWith('input_param', 'NewName');
  });

  /* 4. Groups params by category */
  it('groups multiple params together in the card', () => {
    render(
      <GuiParamCard
        category="game_mechanics"
        paramIds={['game_mechanics_001', 'game_mechanics_002', 'game_mechanics_004']}
        isActive={true}
        onParamChange={defaultOnChange}
      />,
    );

    expect(screen.getByText('得分系统')).toBeInTheDocument();
    expect(screen.getByText('碰撞系统')).toBeInTheDocument();
    expect(screen.getByText('触控输入')).toBeInTheDocument();
  });

  /* 5. Active mode — full interactive controls */
  it('renders interactive controls in active mode', () => {
    render(
      <GuiParamCard
        category="game_mechanics"
        paramIds={['game_mechanics_001', 'game_mechanics_004']}
        isActive={true}
        onParamChange={defaultOnChange}
      />,
    );

    // Interactive controls are present
    expect(screen.getByRole('switch')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });

  /* 6. Tombstone mode — collapsed read-only summary */
  it('renders tombstone mode as a collapsed read-only summary', () => {
    render(
      <GuiParamCard
        category="game_mechanics"
        paramIds={['game_mechanics_001', 'game_mechanics_002']}
        title="游戏机制"
        isActive={false}
        onParamChange={defaultOnChange}
      />,
    );

    // Should NOT have interactive controls
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();

    // Should show summary text with param names and default values
    const card = screen.getByTestId('gui-param-card');
    expect(card.textContent).toContain('得分系统');
    expect(card.textContent).toContain('碰撞系统');
  });

  it('does not call onChange in tombstone mode (no controls to interact with)', () => {
    render(
      <GuiParamCard
        category="game_mechanics"
        paramIds={['game_mechanics_001']}
        isActive={false}
        onParamChange={defaultOnChange}
      />,
    );

    // No interactive controls should exist
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(defaultOnChange).not.toHaveBeenCalled();
  });

  /* 6b. Tombstone mode — uses live values, not defaults */
  it('tombstone displays live values when provided', () => {
    render(
      <GuiParamCard
        category="game_mechanics"
        paramIds={['game_mechanics_001']}
        isActive={false}
        values={{ game_mechanics_001: false }}
        onParamChange={defaultOnChange}
      />,
    );

    const card = screen.getByTestId('gui-param-card');
    // Should show the live value (false → '关闭' or 'false'), not default (true → '开启')
    expect(card.textContent).toContain('得分系统');
    expect(card.textContent).not.toContain('开启');
  });

  /* 7. Empty paramIds — renders nothing */
  it('handles empty paramIds gracefully', () => {
    const { container } = render(
      <GuiParamCard
        category="game_mechanics"
        paramIds={[]}
        isActive={true}
        onParamChange={defaultOnChange}
      />,
    );

    // Should render nothing (null)
    expect(container.innerHTML).toBe('');
  });

  /* 8. Filters out invalid/unknown paramIds */
  it('filters out invalid paramIds where getParamById returns undefined', () => {
    render(
      <GuiParamCard
        category="game_mechanics"
        paramIds={['nonexistent_001', 'game_mechanics_001', 'nonexistent_002']}
        isActive={true}
        onParamChange={defaultOnChange}
      />,
    );

    // Only the valid param should render
    expect(screen.getByText('得分系统')).toBeInTheDocument();
    // Only one toggle
    expect(screen.getAllByRole('switch')).toHaveLength(1);
  });

  it('renders nothing when all paramIds are invalid', () => {
    const { container } = render(
      <GuiParamCard
        category="game_mechanics"
        paramIds={['nonexistent_001', 'nonexistent_002']}
        isActive={true}
        onParamChange={defaultOnChange}
      />,
    );

    expect(container.innerHTML).toBe('');
  });
});
