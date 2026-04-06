import { EmojiIconGroup } from '@/ui/controls/emoji-icon-group.tsx';
import { GradientSlider } from '@/ui/controls/gradient-slider.tsx';
import { StyleCarousel } from '@/ui/controls/style-carousel.tsx';

const DIFFICULTY_ITEMS = [
  { value: 'easy', emoji: '\u{1F60A}' },       // 😊
  { value: 'normal', emoji: '\u{1F604}' },      // 😄
  { value: 'hard', emoji: '\u{1F620}' },        // 😠
  { value: 'very_hard', emoji: '\u{1F631}' },   // 😱
] as const;

const STYLE_ITEMS = [
  { id: 'cartoon', label: '卡通', gradient: 'linear-gradient(135deg, #a776e0, #74bbee, #f1da8f, #f28572)' },
  { id: 'pixel', label: '像素', gradient: 'linear-gradient(135deg, #fcfc9c, #ffa1d6, #01ddf8)' },
  { id: 'realistic', label: '写实', gradient: 'conic-gradient(from 90deg, #e8e8e3, #d8d8bb)' },
] as const;

export interface L1ExperienceCardProps {
  readonly difficulty: string;
  readonly pacing: string;
  readonly emotion: string;
  readonly onDifficultyChange: (value: string) => void;
  readonly onPacingChange: (value: string) => void;
  readonly onEmotionChange: (value: string) => void;
}

export function L1ExperienceCard({
  difficulty,
  pacing,
  emotion,
  onDifficultyChange,
  onPacingChange,
  onEmotionChange,
}: L1ExperienceCardProps) {
  const pacingNum = pacingToNumber(pacing);
  const tooltipText = pacingNum >= 66 ? '快节奏游戏' : pacingNum >= 33 ? '中等节奏' : '慢节奏游戏';

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-5 shadow-[0px_6px_32px_0px_rgba(0,0,0,0.16)]">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
        <span className="text-base" aria-hidden="true">🎮</span>
        Game Experience
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs text-gray-500">Gameplay Difficulty</label>
          <EmojiIconGroup
            items={DIFFICULTY_ITEMS}
            value={difficulty}
            onChange={onDifficultyChange}
            label="游戏难度"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-500">Gameplay Pacing</label>
          <GradientSlider
            value={pacingNum}
            onChange={(v) => onPacingChange(numberToPacing(v))}
            leftIcon="🐱"
            rightIcon="🐇"
            tooltipText={tooltipText}
            label="游戏节奏"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-500">Game Styles</label>
          <StyleCarousel
            items={STYLE_ITEMS}
            value={emotion}
            onChange={onEmotionChange}
            label="画风选择"
          />
        </div>
      </div>
    </div>
  );
}

function pacingToNumber(pacing: string): number {
  switch (pacing) {
    case '慢': return 15;
    case '中': return 50;
    case '快': return 85;
    default: {
      const n = Number(pacing);
      return Number.isFinite(n) ? Math.max(0, Math.min(n, 100)) : 50;
    }
  }
}

function numberToPacing(n: number): string {
  if (n < 33) return '慢';
  if (n < 66) return '中';
  return '快';
}
