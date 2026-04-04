import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModuleCombinationCard, type ModuleTuning } from '../module-combination-card';

const mockTuning: ModuleTuning = {
  title: 'Shooting Combo',
  modules: [
    { name: 'Projectile', params: [{ name: 'speed', value: 800 }, { name: 'damage', value: 25 }] },
    { name: 'EnemyAI', params: [{ name: 'chaseRange', value: 300 }] },
  ],
};

describe('ModuleCombinationCard', () => {
  it('renders title', () => {
    render(<ModuleCombinationCard tuning={mockTuning} onApply={() => {}} />);
    expect(screen.getByText('Shooting Combo')).toBeDefined();
  });

  it('renders module names', () => {
    render(<ModuleCombinationCard tuning={mockTuning} onApply={() => {}} />);
    expect(screen.getByText('Projectile')).toBeDefined();
    expect(screen.getByText('EnemyAI')).toBeDefined();
  });

  it('renders parameter pills', () => {
    render(<ModuleCombinationCard tuning={mockTuning} onApply={() => {}} />);
    expect(screen.getByText('speed')).toBeDefined();
    expect(screen.getByText('800')).toBeDefined();
  });

  it('renders Apply button', () => {
    render(<ModuleCombinationCard tuning={mockTuning} onApply={() => {}} />);
    expect(screen.getByText(/应用专家调参/)).toBeDefined();
  });

  it('calls onApply when clicked', () => {
    let called = false;
    render(<ModuleCombinationCard tuning={mockTuning} onApply={() => { called = true; }} />);
    fireEvent.click(screen.getByText(/应用专家调参/));
    expect(called).toBe(true);
  });
});
