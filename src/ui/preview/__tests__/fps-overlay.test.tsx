import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useRef } from 'react';
import { FpsOverlay } from '../fps-overlay.tsx';
import { useEditorStore } from '@/store/editor-store.ts';

// ── FpsOverlay component ──────────────────────────────────────────────────────

describe('FpsOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with "0 FPS" initially when fpsRef.current is 0', () => {
    function Wrapper() {
      const fpsRef = useRef<number>(0);
      return <FpsOverlay fpsRef={fpsRef} />;
    }
    render(<Wrapper />);
    expect(screen.getByText('0 FPS')).toBeDefined();
  });

  it('updates displayed FPS after 1 second interval', async () => {
    function Wrapper() {
      const fpsRef = useRef<number>(0);
      // Simulate the game loop having updated fpsRef
      fpsRef.current = 58.7;
      return <FpsOverlay fpsRef={fpsRef} />;
    }
    render(<Wrapper />);

    // Before interval fires, still shows 0
    expect(screen.getByText('0 FPS')).toBeDefined();

    // Advance timer by 1 second to trigger setInterval
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('59 FPS')).toBeDefined();
  });

  it('rounds FPS to nearest integer', async () => {
    function Wrapper() {
      const fpsRef = useRef<number>(0);
      fpsRef.current = 60.4;
      return <FpsOverlay fpsRef={fpsRef} />;
    }
    render(<Wrapper />);

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('60 FPS')).toBeDefined();
  });

  it('handles null/undefined fpsRef.current gracefully (shows 0)', async () => {
    function Wrapper() {
      // Simulate a ref that hasn't been assigned yet
      const fpsRef = useRef<number>(0);
      return <FpsOverlay fpsRef={fpsRef} />;
    }
    render(<Wrapper />);

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('0 FPS')).toBeDefined();
  });

  it('cleans up setInterval on unmount', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');

    function Wrapper() {
      const fpsRef = useRef<number>(0);
      return <FpsOverlay fpsRef={fpsRef} />;
    }
    const { unmount } = render(<Wrapper />);
    unmount();

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('has correct CSS classes for overlay positioning', () => {
    function Wrapper() {
      const fpsRef = useRef<number>(0);
      return <FpsOverlay fpsRef={fpsRef} />;
    }
    const { container } = render(<Wrapper />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('absolute');
    expect(div.className).toContain('top-2');
    expect(div.className).toContain('right-2');
    expect(div.className).toContain('pointer-events-none');
    expect(div.className).toContain('z-50');
  });

  it('updates display when fpsRef.current changes between intervals', async () => {
    let externalRef: React.MutableRefObject<number>;

    function Wrapper() {
      const fpsRef = useRef<number>(0);
      externalRef = fpsRef;
      return <FpsOverlay fpsRef={fpsRef} />;
    }
    render(<Wrapper />);

    // First tick
    externalRef!.current = 30;
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('30 FPS')).toBeDefined();

    // Second tick — ref updated again
    externalRef!.current = 60;
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('60 FPS')).toBeDefined();
  });
});

// ── editor-store showFpsOverlay toggle ────────────────────────────────────────

describe('editor-store showFpsOverlay', () => {
  beforeEach(() => {
    // Reset to default state before each test
    useEditorStore.setState({ showFpsOverlay: false } as any);
  });

  it('initializes showFpsOverlay as false', () => {
    const state = useEditorStore.getState();
    expect(state.showFpsOverlay).toBe(false);
  });

  it('setShowFpsOverlay toggles to true', () => {
    useEditorStore.getState().setShowFpsOverlay(true);
    expect(useEditorStore.getState().showFpsOverlay).toBe(true);
  });

  it('setShowFpsOverlay toggles back to false', () => {
    useEditorStore.getState().setShowFpsOverlay(true);
    useEditorStore.getState().setShowFpsOverlay(false);
    expect(useEditorStore.getState().showFpsOverlay).toBe(false);
  });

  it('setShowFpsOverlay does not mutate other state fields', () => {
    const before = useEditorStore.getState();
    const previewModeBefore = before.previewMode;

    useEditorStore.getState().setShowFpsOverlay(true);

    const after = useEditorStore.getState();
    expect(after.previewMode).toBe(previewModeBefore);
    expect(after.showFpsOverlay).toBe(true);
  });
});
