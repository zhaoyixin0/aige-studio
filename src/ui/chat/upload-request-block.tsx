import React, { useRef, useEffect } from 'react';
import { type ChatBlock } from '@/agent/conversation-defs';
import { Upload } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

interface UploadRequestBlockProps {
  block: Extract<ChatBlock, { kind: 'upload-request' }>;
}

export function UploadRequestBlock({ block }: UploadRequestBlockProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const blobUrlsRef = useRef<string[]>([]);
  const addPendingAttachment = useEditorStore((s) => s.addPendingAttachment);

  // Revoke blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      for (const url of blobUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const handleFile = (file: File) => {
    if (!file || file.size > MAX_FILE_SIZE) return;
    const isImage = file.type.startsWith('image/');
    const isAudio = file.type.startsWith('audio/');

    if ((isImage && block.accept.includes('image')) || (isAudio && block.accept.includes('audio'))) {
      const src = URL.createObjectURL(file);
      blobUrlsRef.current = [...blobUrlsRef.current, src];
      addPendingAttachment({
        id: crypto.randomUUID(),
        type: isImage ? 'image' : 'audio',
        src,
        from: 'user',
        target: block.target,
        name: file.name,
      });
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  return (
    <div 
      className="rounded-xl border-2 border-dashed border-white/10 bg-white/5 p-6 flex flex-col items-center justify-center gap-3 hover:border-white/20 transition-all cursor-pointer group animate-in fade-in slide-in-from-bottom-2 duration-300"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/40 group-hover:text-white/60 transition-colors">
        <Upload size={24} />
      </div>
      <div className="text-center">
        <div className="text-sm font-medium text-white/80">{block.hint || `上传 ${block.target} 的素材`}</div>
        <div className="text-[10px] text-white/40 mt-1">支持拖拽或点击上传 ({block.accept.join('/')})</div>
      </div>
      <input 
        ref={inputRef}
        type="file" 
        className="hidden" 
        accept={block.accept.map(t => `${t}/*`).join(',')}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
