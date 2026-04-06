import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmojiIconGroup } from '../emoji-icon-group.tsx';
import { GradientSlider } from '../gradient-slider.tsx';
import { StyleCarousel } from '../style-carousel.tsx';

describe('EmojiIconGroup', () => {
  const items = [
    { value: 'easy', emoji: '\u{1F60A}' },
    { value: 'normal', emoji: '\u{1F604}' },
    { value: 'hard', emoji: '\u{1F624}' },
    { value: 'extreme', emoji: '\u{1F631}' },
  ];

  it('renders all emoji buttons', () => {
    render(<EmojiIconGroup items={items} value="normal" onChange={() => {}} />);
    const buttons = screen.getAllByRole('radio');
    expect(buttons).toHaveLength(4);
  });

  it('selected button has white background style', () => {
    render(<EmojiIconGroup items={items} value="normal" onChange={() => {}} />);
    const selected = screen.getAllByRole('radio').find(
      (b) => b.getAttribute('aria-checked') === 'true',
    );
    expect(selected).toBeDefined();
    expect(selected!.className).toContain('bg-white');
  });

  it('unselected buttons have dark background', () => {
    render(<EmojiIconGroup items={items} value="easy" onChange={() => {}} />);
    const unselected = screen.getAllByRole('radio').filter(
      (b) => b.getAttribute('aria-checked') === 'false',
    );
    expect(unselected.length).toBe(3);
    for (const btn of unselected) {
      expect(btn.className).toContain('bg-[#34383c]');
    }
  });

  it('fires onChange on click', () => {
    const onChange = vi.fn();
    render(<EmojiIconGroup items={items} value="easy" onChange={onChange} />);
    const buttons = screen.getAllByRole('radio');
    fireEvent.click(buttons[2]); // click 'hard'
    expect(onChange).toHaveBeenCalledWith('hard');
  });
});

describe('GradientSlider', () => {
  it('renders with left and right icons', () => {
    const { container } = render(
      <GradientSlider value={50} onChange={() => {}} leftIcon="L" rightIcon="R" />,
    );
    expect(container.textContent).toContain('L');
    expect(container.textContent).toContain('R');
  });

  it('renders slider element', () => {
    render(
      <GradientSlider value={50} onChange={() => {}} leftIcon="L" rightIcon="R" />,
    );
    expect(screen.getByRole('slider')).toBeDefined();
  });
});

describe('StyleCarousel', () => {
  const items = [
    { id: 'cartoon', label: 'Cartoon' },
    { id: 'pixel', label: 'Pixel' },
    { id: 'realistic', label: 'Realistic' },
  ];

  it('renders all style cards', () => {
    render(<StyleCarousel items={items} value="pixel" onChange={() => {}} />);
    const cards = screen.getAllByRole('radio');
    expect(cards).toHaveLength(3);
  });

  it('selected card has white border', () => {
    render(<StyleCarousel items={items} value="pixel" onChange={() => {}} />);
    const selected = screen.getAllByRole('radio').find(
      (b) => b.getAttribute('aria-checked') === 'true',
    );
    expect(selected).toBeDefined();
    expect(selected!.className).toContain('border-white');
  });

  it('fires onChange on card click', () => {
    const onChange = vi.fn();
    render(<StyleCarousel items={items} value="cartoon" onChange={onChange} />);
    const cards = screen.getAllByRole('radio');
    fireEvent.click(cards[2]); // click 'realistic'
    expect(onChange).toHaveBeenCalledWith('realistic');
  });
});
