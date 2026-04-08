import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiagnosticBadge } from '../diagnostic-badge.tsx';
import { useEditorStore } from '@/store/editor-store.ts';
import type { ValidationReport } from '@/engine/core/config-validator';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReport(overrides: Partial<ValidationReport> = {}): ValidationReport {
  return {
    errors: [],
    warnings: [],
    fixes: [],
    isPlayable: true,
    ...overrides,
  };
}

function makeIssue(category: string, severity: 'error' | 'warning' = 'warning') {
  return {
    severity,
    category: category as ValidationReport['warnings'][0]['category'],
    moduleId: 'mod-1',
    message: `Test issue for ${category}`,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DiagnosticPopover — Quick Fix buttons', () => {
  beforeEach(() => {
    useEditorStore.setState({
      validationReport: null,
      boardModeOpen: false,
    } as any);
  });

  it('shows quick fix button for missing-input warning', () => {
    const report = makeReport({ warnings: [makeIssue('missing-input')] });
    useEditorStore.setState({ validationReport: report } as any);

    render(<DiagnosticBadge />);

    // Click badge to open popover
    const badge = screen.getByRole('button');
    fireEvent.click(badge);

    expect(screen.getByText('快速修复 →')).toBeDefined();
  });

  it('shows quick fix button for event-chain-break warning', () => {
    const report = makeReport({ warnings: [makeIssue('event-chain-break')] });
    useEditorStore.setState({ validationReport: report } as any);

    render(<DiagnosticBadge />);
    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('快速修复 →')).toBeDefined();
  });

  it('shows quick fix button for invalid-param warning', () => {
    const report = makeReport({ warnings: [makeIssue('invalid-param')] });
    useEditorStore.setState({ validationReport: report } as any);

    render(<DiagnosticBadge />);
    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('快速修复 →')).toBeDefined();
  });

  it('shows quick fix button for module-conflict warning', () => {
    const report = makeReport({ warnings: [makeIssue('module-conflict')] });
    useEditorStore.setState({ validationReport: report } as any);

    render(<DiagnosticBadge />);
    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('快速修复 →')).toBeDefined();
  });

  it('shows quick fix button for event-chain-break error', () => {
    const report = makeReport({ errors: [makeIssue('event-chain-break', 'error')] });
    useEditorStore.setState({ validationReport: report } as any);

    render(<DiagnosticBadge />);
    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('快速修复 →')).toBeDefined();
  });

  it('does NOT show quick fix button for unknown-module', () => {
    const report = makeReport({ errors: [makeIssue('unknown-module', 'error')] });
    useEditorStore.setState({ validationReport: report } as any);

    render(<DiagnosticBadge />);
    fireEvent.click(screen.getByRole('button'));

    expect(screen.queryByText('快速修复 →')).toBeNull();
  });

  it('does NOT show quick fix button for empty-rules', () => {
    const report = makeReport({ errors: [makeIssue('empty-rules', 'error')] });
    useEditorStore.setState({ validationReport: report } as any);

    render(<DiagnosticBadge />);
    fireEvent.click(screen.getByRole('button'));

    expect(screen.queryByText('快速修复 →')).toBeNull();
  });

  it('clicking quick fix calls setBoardModeOpen(true) and closes popover', () => {
    const setBoardModeOpen = vi.fn();
    useEditorStore.setState({
      validationReport: makeReport({ warnings: [makeIssue('missing-input')] }),
      setBoardModeOpen,
    } as any);

    render(<DiagnosticBadge />);
    fireEvent.click(screen.getByRole('button'));

    const fixBtn = screen.getByText('快速修复 →');
    fireEvent.click(fixBtn);

    expect(setBoardModeOpen).toHaveBeenCalledWith(true);
    // Popover should close — quick fix button no longer visible
    expect(screen.queryByText('快速修复 →')).toBeNull();
  });

  it('clicking quick fix for event-chain-break opens Board Mode', () => {
    const setBoardModeOpen = vi.fn();
    useEditorStore.setState({
      validationReport: makeReport({ warnings: [makeIssue('event-chain-break')] }),
      setBoardModeOpen,
    } as any);

    render(<DiagnosticBadge />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('快速修复 →'));

    expect(setBoardModeOpen).toHaveBeenCalledWith(true);
  });

  it('clicking quick fix for invalid-param opens Board Mode', () => {
    const setBoardModeOpen = vi.fn();
    useEditorStore.setState({
      validationReport: makeReport({ warnings: [makeIssue('invalid-param')] }),
      setBoardModeOpen,
    } as any);

    render(<DiagnosticBadge />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('快速修复 →'));

    expect(setBoardModeOpen).toHaveBeenCalledWith(true);
  });

  it('clicking quick fix for module-conflict opens Board Mode', () => {
    const setBoardModeOpen = vi.fn();
    useEditorStore.setState({
      validationReport: makeReport({ warnings: [makeIssue('module-conflict')] }),
      setBoardModeOpen,
    } as any);

    render(<DiagnosticBadge />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('快速修复 →'));

    expect(setBoardModeOpen).toHaveBeenCalledWith(true);
  });

  it('shows multiple quick fix buttons when multiple fixable issues exist', () => {
    const report = makeReport({
      warnings: [
        makeIssue('missing-input'),
        makeIssue('event-chain-break'),
      ],
    });
    useEditorStore.setState({ validationReport: report } as any);

    render(<DiagnosticBadge />);
    fireEvent.click(screen.getByRole('button'));

    const buttons = screen.getAllByText('快速修复 →');
    expect(buttons).toHaveLength(2);
  });

  it('shows only fixable quick fix buttons when mixed issues exist', () => {
    const report = makeReport({
      errors: [makeIssue('unknown-module', 'error')],
      warnings: [makeIssue('missing-input')],
    });
    useEditorStore.setState({ validationReport: report } as any);

    render(<DiagnosticBadge />);
    fireEvent.click(screen.getByRole('button'));

    const buttons = screen.getAllByText('快速修复 →');
    expect(buttons).toHaveLength(1);
  });
});
