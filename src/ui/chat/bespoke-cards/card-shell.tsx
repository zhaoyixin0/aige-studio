import type { ReactNode } from 'react';

/* ------------------------------------------------------------------ */
/*  CardShell — shared wrapper for bespoke L2 cards                    */
/* ------------------------------------------------------------------ */

interface CardShellProps {
  readonly icon: string;
  readonly title: string;
  readonly children: ReactNode;
}

export function CardShell({ icon, title, children }: CardShellProps) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-5 shadow-[0px_6px_32px_0px_rgba(0,0,0,0.16)]">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
        <span className="text-base" aria-hidden="true">{icon}</span>
        {title}
      </div>
      <div className="flex flex-col gap-4">
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section — logical sub-group within a bespoke card                  */
/* ------------------------------------------------------------------ */

interface SectionProps {
  readonly title: string;
  readonly children: ReactNode;
}

export function Section({ title, children }: SectionProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-[11px] uppercase text-gray-500 font-semibold tracking-wide">
        {title}
      </div>
      <div className="flex flex-col gap-2">
        {children}
      </div>
    </div>
  );
}
