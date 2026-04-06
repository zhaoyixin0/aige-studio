import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BespokeParamCard } from '../index';
import type { ParameterMeta } from '@/data/parameter-registry';

/* Mock parameter-registry */
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
  'visual_audio_001': {
    id: 'visual_audio_001',
    name: '界面UI',
    layer: 'L2',
    category: 'visual_audio',
    mvp: 'P0',
    exposure: 'direct',
    controlType: 'toggle',
    gameTypes: ['ALL'],
    defaultValue: true,
    options: ['显示', '隐藏'],
    description: '实时信息 HUD 展示总开关',
  },
};

vi.mock('@/data/parameter-registry', () => ({
  getParamById: (id: string) => MOCK_PARAMS[id],
}));

const defaultProps = {
  paramIds: ['game_mechanics_001'],
  isActive: true,
  onParamChange: vi.fn(),
};

describe('BespokeParamCard Router', () => {
  it('routes game_mechanics to GameMechanicsCard', () => {
    render(
      <BespokeParamCard {...defaultProps} category="game_mechanics" />,
    );
    expect(screen.getByTestId('game-mechanics-card')).toBeInTheDocument();
  });

  it('routes visual_audio to VisualAudioCard', () => {
    render(
      <BespokeParamCard
        {...defaultProps}
        category="visual_audio"
        paramIds={['visual_audio_001']}
      />,
    );
    expect(screen.getByTestId('visual-audio-card')).toBeInTheDocument();
  });

  it('resolves alias "visual" to visual_audio card', () => {
    render(
      <BespokeParamCard
        {...defaultProps}
        category="visual"
        paramIds={['visual_audio_001']}
      />,
    );
    expect(screen.getByTestId('visual-audio-card')).toBeInTheDocument();
  });

  it('falls back to generic GuiParamCard for game_objects', () => {
    render(
      <BespokeParamCard
        {...defaultProps}
        category="game_objects"
        paramIds={['game_mechanics_001']}
      />,
    );
    // Generic card uses data-testid="gui-param-card"
    expect(screen.getByTestId('gui-param-card')).toBeInTheDocument();
  });

  it('falls back to generic GuiParamCard for unknown category', () => {
    render(
      <BespokeParamCard
        {...defaultProps}
        category="online"
        paramIds={['game_mechanics_001']}
      />,
    );
    expect(screen.getByTestId('gui-param-card')).toBeInTheDocument();
  });
});
