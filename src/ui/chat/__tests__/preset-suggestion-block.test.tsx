import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PresetSuggestionBlock } from '../preset-suggestion-block';

describe('PresetSuggestionBlock', () => {
  it('renders title', () => {
    render(
      <PresetSuggestionBlock
        presetId="hero-catch-fruit"
        title="经典接水果"
        pendingAssets={0}
      />,
    );
    expect(screen.getByText('经典接水果')).toBeDefined();
  });

  it('renders pending assets count when > 0', () => {
    render(
      <PresetSuggestionBlock
        presetId="hero-catch-fruit"
        title="经典接水果"
        pendingAssets={3}
      />,
    );
    expect(screen.getByText(/3 个素材待生成/)).toBeDefined();
  });

  it('does not render pending assets line when 0', () => {
    const { container } = render(
      <PresetSuggestionBlock
        presetId="hero-catch-fruit"
        title="经典接水果"
        pendingAssets={0}
      />,
    );
    expect(container.textContent).not.toContain('素材待生成');
  });

  it('renders "基于模板创建" header for hero presets', () => {
    render(
      <PresetSuggestionBlock
        presetId="hero-shooter-wave"
        title="太空射击"
        pendingAssets={0}
      />,
    );
    expect(screen.getByText('基于模板创建')).toBeDefined();
  });

  it('renders "基于专家模板创建" header for expert presets', () => {
    render(
      <PresetSuggestionBlock
        presetId="expert-cardmatching-knowledge"
        title="CardMatching knowledge"
        pendingAssets={0}
      />,
    );
    expect(screen.getByText('基于专家模板创建')).toBeDefined();
  });

  it('shows metadata for expert presets', () => {
    render(
      <PresetSuggestionBlock
        presetId="expert-cardmatching-knowledge"
        title="CardMatching knowledge"
        pendingAssets={0}
      />,
    );
    const meta = screen.queryByTestId('expert-metadata');
    expect(meta).not.toBeNull();
    expect(meta!.textContent).toContain('来源:');
    expect(meta!.textContent).toContain('置信度:');
    expect(meta!.textContent).toContain('模块:');
  });

  it('hides metadata for hero presets', () => {
    render(
      <PresetSuggestionBlock
        presetId="hero-catch-fruit"
        title="经典接水果"
        pendingAssets={0}
      />,
    );
    expect(screen.queryByTestId('expert-metadata')).toBeNull();
  });
});
