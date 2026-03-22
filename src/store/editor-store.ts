import { create } from 'zustand';

export type PreviewMode = 'edit' | 'play' | 'fullscreen';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: Array<{ moduleType: string; reason: string }>;
  wizardChoices?: Array<{ id: string; label: string; emoji?: string; description?: string }>;
  timestamp: number;
}

interface EditorStore {
  selectedModuleId: string | null;
  previewMode: PreviewMode;
  chatMessages: ChatMessage[];
  isChatLoading: boolean;

  selectModule: (id: string | null) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  addChatMessage: (message: ChatMessage) => void;
  setChatLoading: (loading: boolean) => void;
  clearChat: () => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  selectedModuleId: null,
  previewMode: 'edit',
  chatMessages: [],
  isChatLoading: false,

  selectModule: (id) => set({ selectedModuleId: id }),

  setPreviewMode: (mode) => set({ previewMode: mode }),

  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    })),

  setChatLoading: (loading) => set({ isChatLoading: loading }),

  clearChat: () => set({ chatMessages: [], isChatLoading: false }),
}));
