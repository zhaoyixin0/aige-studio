import { type ChatBlock } from '@/agent/conversation-defs';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface ProgressLogBlockProps {
  block: Extract<ChatBlock, { kind: 'progress-log' }>;
}

export function ProgressLogBlock({ block }: ProgressLogBlockProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">执行进度</div>
      <div className="space-y-1.5">
        {block.entries.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <StatusIcon status={entry.status} />
            <span className={`flex-1 ${entry.status === 'done' ? 'text-white/60' : 'text-white/90'}`}>
              {entry.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: 'pending' | 'generating' | 'removing-bg' | 'done' | 'skipped' | 'error' }) {
  switch (status) {
    case 'pending':
      return <Clock size={14} className="text-white/20" />;
    case 'generating':
    case 'removing-bg':
      return <Loader2 size={14} className="text-blue-400 animate-spin" />;
    case 'done':
      return <CheckCircle2 size={14} className="text-green-500" />;
    case 'error':
      return <XCircle size={14} className="text-red-500" />;
    case 'skipped':
      return <Clock size={14} className="text-white/30" />;
    default:
      return null;
  }
}
