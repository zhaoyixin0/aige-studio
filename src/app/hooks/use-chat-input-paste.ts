import { useState, useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { Attachment } from '@/agent/conversation-defs';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function isAcceptedFile(file: File): 'image' | 'audio' | null {
  if (file.size > MAX_FILE_SIZE) return null;
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('audio/')) return 'audio';
  return null;
}

function createAttachment(file: File, type: 'image' | 'audio'): Attachment {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    src: URL.createObjectURL(file),
    from: 'user',
    name: file.name,
  };
}

export interface ChatInputPasteHandlers {
  isDragging: boolean;
  handlePaste: (e: React.ClipboardEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: () => void;
  handleDrop: (e: React.DragEvent) => void;
}

export function useChatInputPaste(): ChatInputPasteHandlers {
  const [isDragging, setIsDragging] = useState(false);
  const addPendingAttachment = useEditorStore((s) => s.addPendingAttachment);

  const handleFile = useCallback(
    (file: File) => {
      const type = isAcceptedFile(file);
      if (!type) return;
      addPendingAttachment(createAttachment(file, type));
    },
    [addPendingAttachment],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) handleFile(file);
        }
      }
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = e.dataTransfer?.files;
      if (!files) return;
      for (const file of Array.from(files)) {
        handleFile(file);
      }
    },
    [handleFile],
  );

  return { isDragging, handlePaste, handleDragOver, handleDragLeave, handleDrop };
}
