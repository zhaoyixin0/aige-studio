import { useRef, useState } from 'react';
import { Upload, Image, Volume2, X } from 'lucide-react';
import { useGameStore } from '@/store/game-store.ts';
import type { AssetEntry } from '@/engine/core';

const ACCEPTED_TYPES = {
  image: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
};

const ACCEPT_STRING = [
  ...ACCEPTED_TYPES.image.map((t) => `.${t.split('/')[1]}`),
  '.jpg',
  '.mp3',
  ...ACCEPTED_TYPES.audio.map((t) => `.${t.split('/')[1]}`),
].join(',');

interface UploadedFile {
  id: string;
  name: string;
  type: 'sprite' | 'sound';
  dataUrl: string;
  mimeType: string;
}

/** Stable selector — extracted to module scope so function reference never changes. */
const selectAddAsset = (s: { addAsset: (assetId: string, entry: AssetEntry) => void }) => s.addAsset;

export function AssetUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const addAsset = useGameStore(selectAddAsset);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const isAudio = ACCEPTED_TYPES.audio.includes(file.type);
        const assetType = isAudio ? 'sound' : 'sprite';
        const baseName = file.name.replace(/\.[^.]+$/, '');
        const id = `user-${baseName}-${Date.now()}`;
        // const src = `user://uploads/${file.name}`;

        // Add to store
        const entry: AssetEntry = {
          type: assetType,
          src: dataUrl,
        };
        addAsset(id, entry);

        // Track uploaded file for preview
        setUploads((prev) => [
          ...prev,
          {
            id,
            name: file.name,
            type: assetType,
            dataUrl,
            mimeType: file.type,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input so re-uploading the same file triggers onChange
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  function removeUpload(id: string) {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Upload button */}
      <button
        onClick={() => inputRef.current?.click()}
        className="flex items-center justify-center gap-2 px-3 py-2 rounded border border-dashed border-white/20 text-gray-400 hover:border-blue-500/50 hover:text-blue-400 transition-colors text-xs"
      >
        <Upload size={14} />
        Upload Image or Audio
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_STRING}
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Uploaded files preview */}
      {uploads.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">
            Uploaded
          </span>
          {uploads.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/5 border border-white/10"
            >
              <div className="w-8 h-8 flex items-center justify-center rounded bg-white/5 shrink-0 overflow-hidden">
                {file.type === 'sound' ? (
                  <Volume2 size={14} className="text-gray-400" />
                ) : (
                  <img
                    src={file.dataUrl}
                    alt={file.name}
                    className="w-full h-full object-cover rounded"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white truncate">{file.name}</div>
                <div className="text-[10px] text-gray-500">
                  {file.type === 'sound' ? (
                    <span className="flex items-center gap-1">
                      <Volume2 size={10} /> Audio
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Image size={10} /> Image
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => removeUpload(file.id)}
                className="text-gray-500 hover:text-red-400 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
