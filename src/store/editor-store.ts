import { create } from 'zustand';
import type { ValidationReport } from '@/engine/core/config-validator';

export type PreviewMode = 'edit' | 'play' | 'fullscreen';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: Array<{ moduleType: string; reason: string }>;
  wizardChoices?: Array<{ id: string; label: string; emoji?: string; description?: string }>;
  wizardStep?: string;
  enhancementSuggestions?: Array<{ id: string; label: string; emoji: string; moduleType?: string; action?: string }>;
  timestamp: number;
}

export interface Chip {
  id: string;
  label: string;
  emoji?: string;
}

export const DEFAULT_CHIPS: Chip[] = [
  { id: 'catch', label: '接住游戏', emoji: '🎯' },
  { id: 'shooting', label: '射击游戏', emoji: '🔫' },
  { id: 'dodge', label: '躲避游戏', emoji: '💨' },
  { id: 'quiz', label: '答题游戏', emoji: '❓' },
  { id: 'runner', label: '跑酷游戏', emoji: '🏃' },
  { id: 'tap', label: '点击游戏', emoji: '👆' },
  { id: 'rhythm', label: '节奏游戏', emoji: '🎵' },
  { id: 'platformer', label: '平台跳跃', emoji: '🎮' },
  { id: 'random-wheel', label: '幸运转盘', emoji: '🎰' },
  { id: 'expression', label: '表情挑战', emoji: '😊' },
];

interface EditorStore {
  selectedModuleId: string | null;
  previewMode: PreviewMode;
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  validationReport: ValidationReport | null;

  layoutPhase: 'landing' | 'studio';
  suggestionChips: Chip[];
  editorExpanded: boolean;

  selectModule: (id: string | null) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  addChatMessage: (message: ChatMessage) => void;
  truncateChatAfter: (messageId: string) => void;
  setChatLoading: (loading: boolean) => void;
  clearChat: () => void;
  setLayoutPhase: (phase: 'landing' | 'studio') => void;
  setSuggestionChips: (chips: Chip[]) => void;
  toggleEditor: () => void;
  setValidationReport: (report: ValidationReport | null) => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  selectedModuleId: null,
  previewMode: 'edit',
  chatMessages: [],
  isChatLoading: false,
  validationReport: null,
  layoutPhase: 'landing',
  suggestionChips: DEFAULT_CHIPS,
  editorExpanded: false,

  selectModule: (id) => set({ selectedModuleId: id }),

  setPreviewMode: (mode) => set({ previewMode: mode }),

  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    })),

  truncateChatAfter: (messageId) =>
    set((state) => {
      const idx = state.chatMessages.findIndex((m) => m.id === messageId);
      if (idx === -1) return state;
      return { chatMessages: state.chatMessages.slice(0, idx) };
    }),

  setChatLoading: (loading) => set({ isChatLoading: loading }),

  clearChat: () => set({ chatMessages: [], isChatLoading: false }),

  setLayoutPhase: (phase) => set({ layoutPhase: phase }),
  setSuggestionChips: (chips) => set({ suggestionChips: chips }),
  toggleEditor: () => set((state) => ({ editorExpanded: !state.editorExpanded })),
  setValidationReport: (report) => set({ validationReport: report }),
}));
