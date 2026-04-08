import { create } from 'zustand';
import type { ValidationReport } from '@/engine/core/config-validator';
import type { ChatBlock, Attachment } from '@/agent/conversation-defs';

export type PreviewMode = 'edit' | 'play' | 'fullscreen';
export type PreviewPhase = 'tuning' | 'playing' | 'success' | 'fail';

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
  presetUsed?: { presetId: string; title: string; pendingAssets: number };
  timestamp: number;
  blocks?: ChatBlock[];
  attachments?: Attachment[];
}

export type ChipType = 'game_type' | 'param' | 'action' | 'board_mode' | 'preset';

export interface Chip {
  id: string;
  label: string;
  emoji?: string;
  type?: ChipType;
  paramId?: string;
  category?: string;
  action?: string;
  thumbnail?: string; // Optional 28x24px image URL for rich chips
}

/** Extract preset ID from a preset chip, or null if not a preset chip. */
export function getPresetIdFromChip(chip: Chip): string | null {
  return chip.type === 'preset' && chip.id.startsWith('preset:')
    ? chip.id.slice('preset:'.length)
    : null;
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
  { id: 'whack-a-mole', label: '打地鼠', emoji: '🔨', type: 'game_type' as const },
  { id: 'slingshot', label: '弹弓发射', emoji: '🏹', type: 'game_type' as const },
  { id: 'water-pipe', label: '水管连接', emoji: '🚰', type: 'game_type' as const },
  { id: 'cross-road', label: '过马路', emoji: '🚗', type: 'game_type' as const },
  // Preset quick-start chips
  { id: 'preset:hero-catch-fruit', label: '快速开始：接水果', emoji: '\u26A1', type: 'preset' as const },
  { id: 'preset:hero-shooter-wave', label: '快速开始：射击', emoji: '\u26A1', type: 'preset' as const },
  { id: 'preset:hero-platformer-basic', label: '快速开始：平台跳跃', emoji: '\u26A1', type: 'preset' as const },
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
  previewPhase: PreviewPhase;
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  validationReport: ValidationReport | null;

  layoutPhase: 'landing' | 'studio';
  suggestionChips: Chip[];
  editorExpanded: boolean;

  l1State: L1State;
  boardModeOpen: boolean;

  expertBrowserOpen: boolean;
  expertBrowserGameType: string | null;

  gameFeel: GameFeelState;

  pendingAttachments: Attachment[];

  showFpsOverlay: boolean;

  selectModule: (id: string | null) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  setPreviewPhase: (phase: PreviewPhase) => void;
  addChatMessage: (message: ChatMessage) => void;
  updateChatMessage: (id: string, updater: (msg: ChatMessage) => ChatMessage) => void;
  truncateChatAfter: (messageId: string) => void;
  setChatLoading: (loading: boolean) => void;
  clearChat: () => void;
  setLayoutPhase: (phase: 'landing' | 'studio') => void;
  setSuggestionChips: (chips: Chip[]) => void;
  toggleEditor: () => void;
  setValidationReport: (report: ValidationReport | null) => void;
  setL1State: (partial: Partial<L1State>) => void;
  setBoardModeOpen: (open: boolean) => void;
  setExpertBrowserOpen: (open: boolean, gameType?: string | null) => void;
  setGameFeel: (partial: Partial<GameFeelState>) => void;
  addPendingAttachment: (attachment: Attachment) => void;
  clearPendingAttachments: () => void;

  setShowFpsOverlay: (v: boolean) => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  selectedModuleId: null,
  previewMode: 'edit',
  previewPhase: 'tuning',
  chatMessages: [],
  isChatLoading: false,
  validationReport: null,
  layoutPhase: 'landing',
  suggestionChips: DEFAULT_CHIPS,
  editorExpanded: false,
  l1State: { difficulty: 'normal', pacing: 50, emotion: 'cartoon' },
  boardModeOpen: false,
  expertBrowserOpen: false,
  expertBrowserGameType: null,
  gameFeel: { score: 0, dimensions: {}, suggestions: [], badge: null },
  pendingAttachments: [],
  showFpsOverlay: false,

  selectModule: (id) => set({ selectedModuleId: id }),

  setPreviewMode: (mode) => set({ previewMode: mode }),
  setPreviewPhase: (phase) => set({ previewPhase: phase }),

  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    })),

  updateChatMessage: (id, updater) =>
    set((state) => {
      const idx = state.chatMessages.findIndex((m) => m.id === id);
      if (idx === -1) return state;
      const next = state.chatMessages.slice();
      next[idx] = updater(state.chatMessages[idx]);
      return { chatMessages: next };
    }),

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
  setExpertBrowserOpen: (open, gameType) =>
    set({
      expertBrowserOpen: open,
      expertBrowserGameType: open ? (gameType ?? null) : null,
    }),
  setGameFeel: (partial) =>
    set((state) => ({ gameFeel: { ...state.gameFeel, ...partial } })),

  addPendingAttachment: (attachment) =>
    set((state) => ({
      pendingAttachments: [...state.pendingAttachments, attachment],
    })),

  clearPendingAttachments: () =>
    set((state) => {
      // Revoke blob URLs to prevent memory leak
      for (const att of state.pendingAttachments) {
        if (att.src.startsWith('blob:')) {
          URL.revokeObjectURL(att.src);
        }
      }
      return { pendingAttachments: [] };
    }),

  setShowFpsOverlay: (v) => set({ showFpsOverlay: v }),
}));
