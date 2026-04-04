import type { ReactNode } from 'react';

interface ExpertInsightBlockProps {
  readonly title: string;
  readonly children: ReactNode;
}

export function ExpertInsightBlock({ title, children }: ExpertInsightBlockProps) {
  return (
    <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-amber-400 text-xs">&#10024;</span>
        <span className="text-xs font-medium text-amber-300">{title}</span>
      </div>
      <div className="text-sm text-gray-300">{children}</div>
    </div>
  );
}
