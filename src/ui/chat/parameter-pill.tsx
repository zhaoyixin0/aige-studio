interface ParameterPillProps {
  readonly name: string;
  readonly value: string | number;
  readonly onClick?: () => void;
}

export function ParameterPill({ name, value, onClick }: ParameterPillProps) {
  const interactive = onClick !== undefined;
  return (
    <span
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
        bg-blue-500/10 text-blue-300 border border-blue-500/20
        ${interactive ? 'cursor-pointer hover:bg-blue-500/20 transition-colors' : ''}`}
    >
      <span className="font-medium">{name}</span>
      <span className="text-blue-400/70">{String(value)}</span>
    </span>
  );
}
