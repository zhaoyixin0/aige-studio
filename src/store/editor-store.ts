import { create } from 'zustand';
import type { ValidationReport } from '@/engine/core/config-validator';

export type PreviewMode = 'edit' | 'play' | 'fullscreen';

export interface L1State {
  difficulty: 'easy' | 'normal' | 'hard' | 'very_hard' | 'extreme';
  pacing: number;    // 0-100
  emotion: string;   // style ID
}

export interface ExpertInsightPayload {
  readonly title: string;
  readonly body: string;
}

export interface ModuleTuningPayload {
  readonly title: string;
  readonly modules: ReadonlyArray<{
    readonly name: string;
    readonly params: ReadonlyArray<{ readonly name: string; readonly value: string | number }>;
  }>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: Array<{ moduleType: string; reason: string }>;
  wizardChoices?: Array<{ id: string; label: string; emoji?: string; description?: string }>;
  wizardStep?: string;
  enhancementSuggestions?: Array<{ id: string; label: string; emoji: string; moduleType?: string; action?: string }>;
  gameTypeOptions?: Array<{ id: string; name: string; emoji?: string }>;
  parameterCard?: { category: string; paramIds: string[]; title?: string };
  l1Controls?: boolean;
  expertInsight?: ExpertInsightPayload;
  moduleTuning?: ModuleTuningPayload;
  timestamp: number;
}

export type ChipType = 'game_type' | 'param' | 'action' | 'board_mode';

export interface Chip {
  id: string;
  label: string;
  emoji?: string;
  type?: ChipType;
  paramId?: string;
  category?: string;
  action?: string;
}

export const DEFAULT_CHIPS: Chip[] = [
  { id: 'catch', label: '接住游戏', emoji: '🎯', type: 'game_type' as const },
  { id: 'shooting', label: '射击游戏', emoji: '🔫', type: 'game_type' as const },
  { id: 'dodge', label: '躲避游戏', emoji: '💨', type: 'game_type' as const },
  { id: 'quiz', label: '答题游戏', emoji: '❓', type: 'game_type' as const },
  { id: 'runner', label: '跑酷游戏', emoji: '🏃', type: 'game_type' as const },
  { id: 'tap', label: '点击游戏', emoji: '👆', type: 'game_type' as const },
  { id: 'rhythm', label: '节奏游戏', emoji: '🎵', type: 'game_type' as const },
  { id: 'platformer', label: '平台跳跃', emoji: '🎮', type: 'game_type' as const },
  { id: 'random-wheel', label: '幸运转盘', emoji: '🎰', type: 'game_type' as const },
  { id: 'expression', label: '表情挑战', emoji: '😊', type: 'game_type' as const },
];

export interface GameFeelSuggestion {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly delta: number;
  readonly payload?: ReadonlyArray<{
    moduleType: string;
    params: Record<string, unknown>;
  }>;
}

export interface GameFeelState {
  score: number;
  dimensions: Readonly<Record<string, number>>;
  suggestions: readonly GameFeelSuggestion[];
  badge: 'bronze' | 'silver' | 'gold' | 'expert' | null;
}

interface EditorStore {
  selectedModuleId: string | null;
  previewMode: PreviewMode;
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  validationReport: ValidationReport | null;

  layoutPhase: 'landing' | 'studio';
  suggestionChips: Chip[];
  editorExpanded: boolean;

  l1State: L1State;
  boardModeOpen: boolean;

  gameFeel: GameFeelState;

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
  setL1State: (partial: Partial<L1State>) => void;
  setBoardModeOpen: (open: boolean) => void;
  setGameFeel: (partial: Partial<GameFeelState>) => void;
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
  l1State: { difficulty: 'normal', pacing: 50, emotion: 'cartoon' },
  boardModeOpen: false,
  gameFeel: { score: 0, dimensions: {}, suggestions: [], badge: null },

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
  setL1State: (partial) =>
    set((state) => ({ l1State: { ...state.l1State, ...partial } })),
  setBoardModeOpen: (open) => set({ boardModeOpen: open }),
  setGameFeel: (partial) =>
    set((state) => ({ gameFeel: { ...state.gameFeel, ...partial } })),
}));
