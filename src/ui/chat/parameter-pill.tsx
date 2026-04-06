export type PillColorVariant = 'blue' | 'amber' | 'sky' | 'fuchsia' | 'emerald';

const COLOR_CLASSES: Record<PillColorVariant, { bg: string; text: string; border: string; value: string; hover: string }> = {
  blue:    { bg: 'bg-blue-500/10',    text: 'text-blue-300',    border: 'border-blue-500/20',    value: 'text-blue-400/70',    hover: 'hover:bg-blue-500/20 hover:text-blue-100' },
  amber:   { bg: 'bg-amber-500/20',   text: 'text-amber-300',   border: 'border-amber-500/30',   value: 'text-amber-400/70',   hover: 'hover:bg-amber-500/30 hover:text-amber-100' },
  sky:     { bg: 'bg-sky-500/20',     text: 'text-sky-300',     border: 'border-sky-500/30',     value: 'text-sky-400/70',     hover: 'hover:bg-sky-500/30 hover:text-sky-100' },
  fuchsia: { bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-300', border: 'border-fuchsia-500/30', value: 'text-fuchsia-400/70', hover: 'hover:bg-fuchsia-500/30 hover:text-fuchsia-100' },
  emerald: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30', value: 'text-emerald-400/70', hover: 'hover:bg-emerald-500/30 hover:text-emerald-100' },
};

interface ParameterPillProps {
  readonly name: string;
  readonly value: string | number;
  readonly colorVariant?: PillColorVariant;
  readonly onClick?: () => void;
}

export function ParameterPill({ name, value, colorVariant = 'blue', onClick }: ParameterPillProps) {
  const interactive = onClick !== undefined;
  const c = COLOR_CLASSES[colorVariant];
  return (
    <span
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
        ${c.bg} ${c.text} border ${c.border}
        ${interactive ? `cursor-pointer ${c.hover} transition-colors` : ''}`}
    >
      <span className="font-medium">{name}</span>
      <span className={c.value}>{String(value)}</span>
    </span>
  );
}
