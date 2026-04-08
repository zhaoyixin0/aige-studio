import { type ChatBlock, type ProgressEntry } from '@/agent/conversation-defs';
import { Loader2, CheckCircle2, XCircle, Clock, CircleSlash } from 'lucide-react';

interface ProgressLogBlockProps {
  block: Extract<ChatBlock, { kind: 'progress-log' }>;
}

type EntryStatus = ProgressEntry['status'];

function entryClassName(status: EntryStatus): string {
  switch (status) {
    case 'generating':
    case 'removing-bg':
      return 'text-white font-medium drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]';
    case 'done':
      return 'text-white/40';
    case 'error':
      return 'text-red-400';
    case 'skipped':
      return 'text-white/30 line-through';
    case 'pending':
    default:
      return 'text-white/70';
  }
}

export function ProgressLogBlock({ block }: ProgressLogBlockProps) {
  const activeEntry = block.entries.find(
    (e) => e.status === 'generating' || e.status === 'removing-bg',
  );

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">执行进度</div>

      {/* Screen-reader-only live region — announces only the currently-active entry */}
      <div aria-live="polite" aria-atomic="false" role="status" className="sr-only">
        {activeEntry ? `当前: ${activeEntry.message}` : ''}
      </div>

      <div className="space-y-1.5">
        {block.entries.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <StatusIcon status={entry.status} />
            <span className={`flex-1 transition-colors ${entryClassName(entry.status)}`}>
              {entry.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: EntryStatus }) {
  switch (status) {
    case 'pending':
      return <Clock size={14} className="text-white/30" />;
    case 'generating':
    case 'removing-bg':
      return <Loader2 size={14} className="text-blue-400 animate-spin" />;
    case 'done':
      return <CheckCircle2 size={14} className="text-green-500" />;
    case 'error':
      return <XCircle size={14} className="text-red-500" />;
    case 'skipped':
      return <CircleSlash size={14} className="text-white/30" />;
    default:
      return null;
  }
}
