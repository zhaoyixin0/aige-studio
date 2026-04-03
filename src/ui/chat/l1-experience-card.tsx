import { SegmentedControl } from '@/ui/controls/segmented-control';

const DIFFICULTY_OPTIONS = ['简单', '普通', '困难'] as const;
const PACING_OPTIONS = ['慢', '中', '快'] as const;
const EMOTION_OPTIONS = ['沉静', '热血', '欢乐'] as const;

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
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-4">
      <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
        Game Experience
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs text-gray-400">游戏难度</label>
          <SegmentedControl
            options={DIFFICULTY_OPTIONS}
            value={difficulty}
            onChange={onDifficultyChange}
            label="游戏难度"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-gray-400">游戏节奏</label>
          <SegmentedControl
            options={PACING_OPTIONS}
            value={pacing}
            onChange={onPacingChange}
            label="游戏节奏"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-gray-400">游戏情绪</label>
          <SegmentedControl
            options={EMOTION_OPTIONS}
            value={emotion}
            onChange={onEmotionChange}
            label="游戏情绪"
          />
        </div>
      </div>
    </div>
  );
}
