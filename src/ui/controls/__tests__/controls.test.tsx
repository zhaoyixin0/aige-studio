import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SegmentedControl } from '../segmented-control';
import { StepperControl } from '../stepper-control';
import { AssetPickerGrid } from '../asset-picker-grid';
import { SchemaRenderer } from '@/ui/editor/schema-renderer';
import type { ModuleSchema } from '@/engine/core/types';

/* ================================================================== */
/*  SegmentedControl                                                    */
/* ================================================================== */
describe('SegmentedControl', () => {
  const options = ['small', 'medium', 'large'];

  it('renders all options as buttons', () => {
    render(
      <SegmentedControl
        options={options}
        value="medium"
        onChange={() => {}}
      />,
    );

    for (const opt of options) {
      expect(screen.getByRole('radio', { name: opt })).toBeInTheDocument();
    }
  });

  it('highlights selected option', () => {
    render(
      <SegmentedControl
        options={options}
        value="medium"
        onChange={() => {}}
      />,
    );

    const selected = screen.getByRole('radio', { name: 'medium' });
    expect(selected).toHaveAttribute('aria-checked', 'true');

    const unselected = screen.getByRole('radio', { name: 'small' });
    expect(unselected).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange with new value on click', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        options={options}
        value="medium"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'large' }));
    expect(onChange).toHaveBeenCalledWith('large');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('supports emoji/icon options', () => {
    const emojiOptions = ['🎮', '🎯', '🎲'];
    render(
      <SegmentedControl
        options={emojiOptions}
        value="🎯"
        onChange={() => {}}
      />,
    );

    for (const opt of emojiOptions) {
      expect(screen.getByRole('radio', { name: opt })).toBeInTheDocument();
    }

    expect(screen.getByRole('radio', { name: '🎯' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('supports keyboard navigation with arrow keys', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        options={options}
        value="small"
        onChange={onChange}
      />,
    );

    const group = screen.getByRole('radiogroup');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('medium');
  });

  it('moves DOM focus to next option on ArrowRight', async () => {
    let currentValue = 'small';
    const onChange = vi.fn((v: string) => { currentValue = v; });
    const { rerender } = render(
      <SegmentedControl options={options} value={currentValue} onChange={onChange} />,
    );

    const group = screen.getByRole('radiogroup');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('medium');

    rerender(
      <SegmentedControl options={options} value="medium" onChange={onChange} />,
    );

    await vi.waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole('radio', { name: 'medium' }),
      );
    });
  });
});

/* ================================================================== */
/*  StepperControl                                                      */
/* ================================================================== */
describe('StepperControl', () => {
  it('renders current value with +/- buttons', () => {
    render(
      <StepperControl value={5} min={0} max={10} step={1} onChange={() => {}} />,
    );

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /decrement/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /increment/i }),
    ).toBeInTheDocument();
  });

  it('increments by step value', () => {
    const onChange = vi.fn();
    render(
      <StepperControl value={5} min={0} max={10} step={2} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /increment/i }));
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it('decrements by step value', () => {
    const onChange = vi.fn();
    render(
      <StepperControl value={5} min={0} max={10} step={2} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /decrement/i }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('respects max bound', () => {
    const onChange = vi.fn();
    render(
      <StepperControl value={9} min={0} max={10} step={2} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /increment/i }));
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('respects min bound', () => {
    const onChange = vi.fn();
    render(
      <StepperControl value={1} min={0} max={10} step={2} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /decrement/i }));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('disables decrement button at min', () => {
    render(
      <StepperControl value={0} min={0} max={10} step={1} onChange={() => {}} />,
    );

    expect(screen.getByRole('button', { name: /decrement/i })).toBeDisabled();
  });

  it('disables increment button at max', () => {
    render(
      <StepperControl
        value={10}
        min={0}
        max={10}
        step={1}
        onChange={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /increment/i })).toBeDisabled();
  });
});

/* ================================================================== */
/*  AssetPickerGrid                                                     */
/* ================================================================== */
describe('AssetPickerGrid', () => {
  const assets = [
    { id: 'sprite_1', thumbnail: '/img/sprite1.png', label: 'Sprite 1' },
    { id: 'sprite_2', thumbnail: '/img/sprite2.png', label: 'Sprite 2' },
    { id: 'sprite_3', thumbnail: '/img/sprite3.png' },
  ];

  it('renders grid of thumbnail options', () => {
    render(
      <AssetPickerGrid assets={assets} value="sprite_1" onChange={() => {}} />,
    );

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(3);
    expect(images[0]).toHaveAttribute('src', '/img/sprite1.png');
  });

  it('highlights selected asset', () => {
    render(
      <AssetPickerGrid assets={assets} value="sprite_1" onChange={() => {}} />,
    );

    const selectedButton = screen.getByRole('radio', { name: /sprite 1/i });
    expect(selectedButton).toHaveAttribute('aria-checked', 'true');

    const unselectedButton = screen.getByRole('radio', { name: /sprite 2/i });
    expect(unselectedButton).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange with asset ID on click', () => {
    const onChange = vi.fn();
    render(
      <AssetPickerGrid assets={assets} value="sprite_1" onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole('radio', { name: /sprite 2/i }));
    expect(onChange).toHaveBeenCalledWith('sprite_2');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('renders label when provided', () => {
    render(
      <AssetPickerGrid assets={assets} value="sprite_1" onChange={() => {}} />,
    );

    expect(screen.getByText('Sprite 1')).toBeInTheDocument();
    expect(screen.getByText('Sprite 2')).toBeInTheDocument();
  });

  it('falls back to asset ID when no label provided', () => {
    render(
      <AssetPickerGrid assets={assets} value="sprite_1" onChange={() => {}} />,
    );

    expect(screen.getByText('sprite_3')).toBeInTheDocument();
  });

  it('moves DOM focus to next asset on ArrowDown', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <AssetPickerGrid assets={assets} value="sprite_1" onChange={onChange} />,
    );

    const group = screen.getByRole('radiogroup');
    fireEvent.keyDown(group, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith('sprite_2');

    rerender(
      <AssetPickerGrid assets={assets} value="sprite_2" onChange={onChange} />,
    );

    await vi.waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole('radio', { name: /sprite 2/i }),
      );
    });
  });
});

/* ================================================================== */
/*  SchemaRenderer integration                                          */
/* ================================================================== */
describe('SchemaRenderer integration', () => {
  it('renders SegmentedControl for type=segmented', () => {
    const schema: ModuleSchema = {
      size: {
        type: 'segmented',
        label: 'Size',
        default: 'medium',
        options: ['small', 'medium', 'large'],
      },
    };

    render(
      <SchemaRenderer
        schema={schema}
        values={{ size: 'medium' }}
        onChange={() => {}}
      />,
    );

    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'small' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'medium' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('renders StepperControl for type=stepper', () => {
    const schema: ModuleSchema = {
      count: {
        type: 'stepper',
        label: 'Count',
        default: 3,
        min: 1,
        max: 10,
        step: 1,
      },
    };

    render(
      <SchemaRenderer
        schema={schema}
        values={{ count: 3 }}
        onChange={() => {}}
      />,
    );

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /increment/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /decrement/i }),
    ).toBeInTheDocument();
  });

  it('renders AssetPickerGrid for type=asset_picker', () => {
    const schema: ModuleSchema = {
      character: {
        type: 'asset_picker',
        label: 'Character',
        default: 'hero_1',
        assets: [
          { id: 'hero_1', thumbnail: '/img/hero1.png', label: 'Hero' },
          { id: 'hero_2', thumbnail: '/img/hero2.png', label: 'Villain' },
        ],
      },
    };

    render(
      <SchemaRenderer
        schema={schema}
        values={{ character: 'hero_1' }}
        onChange={() => {}}
      />,
    );

    expect(screen.getByRole('radio', { name: /hero/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: /villain/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('calls onChange through SchemaRenderer for segmented', () => {
    const onChange = vi.fn();
    const schema: ModuleSchema = {
      size: {
        type: 'segmented',
        label: 'Size',
        default: 'medium',
        options: ['small', 'medium', 'large'],
      },
    };

    render(
      <SchemaRenderer
        schema={schema}
        values={{ size: 'medium' }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'large' }));
    expect(onChange).toHaveBeenCalledWith('size', 'large');
  });
});
