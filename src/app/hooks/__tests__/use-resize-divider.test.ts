import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResizeDivider } from '../use-resize-divider';

describe('useResizeDivider', () => {
  afterEach(() => {
    // Ensure no lingering listeners after each test
    document.body.style.cursor = '';
  });

  it('should return initial width and onMouseDown handler', () => {
    const { result } = renderHook(() => useResizeDivider(480));

    expect(result.current.width).toBe(480);
    expect(typeof result.current.onMouseDown).toBe('function');
  });

  it('should update width on mouse move during drag', () => {
    const { result } = renderHook(() => useResizeDivider(480));

    // Start drag
    act(() => {
      result.current.onMouseDown({
        preventDefault: vi.fn(),
      } as unknown as React.MouseEvent);
    });

    // Move mouse to x=600
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 600 }));
    });

    expect(result.current.width).toBe(600);
  });

  it('should clamp width to minimum 320', () => {
    const { result } = renderHook(() => useResizeDivider(480));

    act(() => {
      result.current.onMouseDown({
        preventDefault: vi.fn(),
      } as unknown as React.MouseEvent);
    });

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100 }));
    });

    expect(result.current.width).toBe(320);
  });

  it('should stop tracking on mouseup', () => {
    const { result } = renderHook(() => useResizeDivider(480));

    // Start drag
    act(() => {
      result.current.onMouseDown({
        preventDefault: vi.fn(),
      } as unknown as React.MouseEvent);
    });

    // Move to 600
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 600 }));
    });
    expect(result.current.width).toBe(600);

    // Release mouse
    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup'));
    });

    // Further moves should NOT change width
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 400 }));
    });
    expect(result.current.width).toBe(600);
  });

  it('should set cursor to col-resize during drag', () => {
    const { result } = renderHook(() => useResizeDivider(480));

    act(() => {
      result.current.onMouseDown({
        preventDefault: vi.fn(),
      } as unknown as React.MouseEvent);
    });

    expect(document.body.style.cursor).toBe('col-resize');

    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup'));
    });

    expect(document.body.style.cursor).toBe('');
  });

  it('should clean up document listeners on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { result, unmount } = renderHook(() => useResizeDivider(480));

    // Start drag (adds listeners)
    act(() => {
      result.current.onMouseDown({
        preventDefault: vi.fn(),
      } as unknown as React.MouseEvent);
    });

    // Unmount while dragging — must clean up
    unmount();

    const removedEvents = removeSpy.mock.calls.map((c) => c[0]);
    expect(removedEvents).toContain('mousemove');
    expect(removedEvents).toContain('mouseup');

    removeSpy.mockRestore();
  });

  it('should respect custom minWidth', () => {
    const { result } = renderHook(() => useResizeDivider(500, { minWidth: 400 }));

    act(() => {
      result.current.onMouseDown({
        preventDefault: vi.fn(),
      } as unknown as React.MouseEvent);
    });

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 350 }));
    });

    expect(result.current.width).toBe(400);
  });
});
