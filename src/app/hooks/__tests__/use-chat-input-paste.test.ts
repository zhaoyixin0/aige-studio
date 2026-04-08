import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatInputPaste } from '../use-chat-input-paste';
import { useEditorStore } from '@/store/editor-store';

// Mock URL.createObjectURL
beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  useEditorStore.setState({ pendingAttachments: [] });
});

describe('useChatInputPaste', () => {
  it('handles paste of image file', () => {
    const { result } = renderHook(() => useChatInputPaste());

    const file = new File(['fake'], 'screenshot.png', { type: 'image/png' });
    const clipboardEvent = {
      clipboardData: {
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => file,
          },
        ],
      },
    } as unknown as React.ClipboardEvent;

    act(() => {
      result.current.handlePaste(clipboardEvent);
    });

    const attachments = useEditorStore.getState().pendingAttachments;
    expect(attachments.length).toBe(1);
    expect(attachments[0].type).toBe('image');
    expect(attachments[0].name).toBe('screenshot.png');
  });

  it('handles drop of image file', () => {
    const { result } = renderHook(() => useChatInputPaste());

    const file = new File(['fake'], 'dropped.png', { type: 'image/png' });
    const dragEvent = {
      preventDefault: vi.fn(),
      dataTransfer: {
        files: [file] as unknown as FileList,
      },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.handleDrop(dragEvent);
    });

    const attachments = useEditorStore.getState().pendingAttachments;
    expect(attachments.length).toBe(1);
    expect(attachments[0].name).toBe('dropped.png');
  });

  it('rejects non-image/audio files', () => {
    const { result } = renderHook(() => useChatInputPaste());

    const file = new File(['fake'], 'doc.pdf', { type: 'application/pdf' });
    const dragEvent = {
      preventDefault: vi.fn(),
      dataTransfer: { files: [file] as unknown as FileList },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.handleDrop(dragEvent);
    });

    expect(useEditorStore.getState().pendingAttachments.length).toBe(0);
  });

  it('rejects files over 10MB', () => {
    const { result } = renderHook(() => useChatInputPaste());

    // Create a file with size > 10MB
    const bigFile = new File(['x'.repeat(11 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 });

    const dragEvent = {
      preventDefault: vi.fn(),
      dataTransfer: { files: [bigFile] as unknown as FileList },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.handleDrop(dragEvent);
    });

    expect(useEditorStore.getState().pendingAttachments.length).toBe(0);
  });

  it('handleDragOver sets isDragging true and prevents default', () => {
    const { result } = renderHook(() => useChatInputPaste());
    const preventDefault = vi.fn();

    act(() => {
      result.current.handleDragOver({ preventDefault } as unknown as React.DragEvent);
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(result.current.isDragging).toBe(true);
  });

  it('handleDragLeave sets isDragging false', () => {
    const { result } = renderHook(() => useChatInputPaste());

    act(() => {
      result.current.handleDragOver({ preventDefault: vi.fn() } as unknown as React.DragEvent);
    });
    act(() => {
      result.current.handleDragLeave();
    });

    expect(result.current.isDragging).toBe(false);
  });
});
