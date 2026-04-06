import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VisualAudioCard } from '../visual-audio-card';
import type { ParameterMeta } from '@/data/parameter-registry';

const MOCK_PARAMS: Record<string, ParameterMeta> = {
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
  'visual_audio_007': {
    id: 'visual_audio_007',
    name: '声音系统',
    layer: 'L2',
    category: 'visual_audio',
    mvp: 'P1',
    exposure: 'direct',
    controlType: 'toggle',
    gameTypes: ['ALL'],
    defaultValue: true,
    options: ['开启', '关闭'],
    description: 'BGM 与实时音效的输出总闸',
  },
  'visual_audio_099': {
    id: 'visual_audio_099',
    name: '未知特效',
    layer: 'L2',
    category: 'visual_audio',
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

describe('VisualAudioCard', () => {
  const onChange = vi.fn();

  it('renders section titles for known groups', () => {
    render(
      <VisualAudioCard
        category="visual_audio"
        paramIds={['visual_audio_003', 'visual_audio_001', 'visual_audio_007']}
        isActive={true}
        onParamChange={onChange}
      />,
    );

    // '视觉风格' appears as both section title and param name
    expect(screen.getAllByText('视觉风格').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('界面')).toBeInTheDocument();
    expect(screen.getByText('音效')).toBeInTheDocument();
  });

  it('puts ungrouped params in "其他" section', () => {
    render(
      <VisualAudioCard
        category="visual_audio"
        paramIds={['visual_audio_099']}
        isActive={true}
        onParamChange={onChange}
      />,
    );

    expect(screen.getByText('其他')).toBeInTheDocument();
    expect(screen.getByText('未知特效')).toBeInTheDocument();
  });

  it('calls onParamChange when a toggle is clicked', () => {
    onChange.mockClear();
    render(
      <VisualAudioCard
        category="visual_audio"
        paramIds={['visual_audio_001']}
        isActive={true}
        onParamChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith('visual_audio_001', false);
  });

  it('renders tombstone when isActive=false', () => {
    render(
      <VisualAudioCard
        category="visual_audio"
        paramIds={['visual_audio_001']}
        isActive={false}
        onParamChange={onChange}
      />,
    );

    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getByTestId('gui-param-card').textContent).toContain('界面UI');
  });
});
