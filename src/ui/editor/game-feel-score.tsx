interface GameFeelScoreProps {
  readonly score: number;
  readonly dimensions: Record<string, number>;
  readonly badge: 'bronze' | 'silver' | 'gold' | 'expert' | null;
}

function getColor(score: number): string {
  if (score >= 80) return '#22c55e'; // green
  if (score >= 50) return '#eab308'; // yellow
  return '#ef4444'; // red
}

const BADGE_LABELS: Record<string, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  expert: 'Expert',
};

export function GameFeelScore({ score, dimensions, badge }: GameFeelScoreProps) {
  const color = getColor(score);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative w-24 h-24"
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Game feel score"
      >
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          {/* Background ring */}
          <circle
            cx="40" cy="40" r={radius}
            fill="none" stroke="currentColor"
            className="text-white/10" strokeWidth="6"
          />
          {/* Score ring */}
          <circle
            cx="40" cy="40" r={radius}
            fill="none" stroke={color}
            strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="score-ring transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-gray-100">{score}</span>
        </div>
      </div>

      {badge && (
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-medium"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {BADGE_LABELS[badge] ?? badge}
        </span>
      )}

      {Object.keys(dimensions).length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-gray-400 mt-1">
          {Object.entries(dimensions).map(([name, val]) => (
            <div key={name} className="flex justify-between gap-1">
              <span className="truncate">{name}</span>
              <span className="text-gray-300">{Math.round(val)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
