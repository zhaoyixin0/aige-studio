import { AlertTriangle, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { ADVICE_SUMMARY_PREFIX, type ChatBlock } from '@/agent/conversation-defs';
import { useEditorStore } from '@/store/editor-store';
import { useGameStore } from '@/store/game-store';
import { validateConfig, applyFixes } from '@/engine/core/config-validator';
import { ContractRegistry } from '@/engine/core/contract-registry';
import { createModuleRegistry } from '@/engine/module-setup';

type ValidationSummaryChatBlock = Extract<ChatBlock, { kind: 'validation-summary' }>;

function isAdviceBlock(block: ValidationSummaryChatBlock): boolean {
  return typeof block.summary === 'string' &&
    block.summary.startsWith(ADVICE_SUMMARY_PREFIX);
}

function stripAdvicePrefix(summary: string): string {
  return summary.replace(ADVICE_SUMMARY_PREFIX, '').trim();
}

interface ValidationSummaryBlockProps {
  readonly block: ValidationSummaryChatBlock;
  readonly messageId: string;
}

/**
 * Immutably replace the validation-summary block on a ChatMessage.
 * Returns a new message with the updated block, preserving non-matching blocks.
 */
function markBlockResolved(
  blocks: ChatBlock[] | undefined,
): ChatBlock[] | undefined {
  if (!blocks) return blocks;
  return blocks.map((b) =>
    b.kind === 'validation-summary' ? { ...b, resolved: true } : b,
  );
}

export function ValidationSummaryBlock({
  block,
  messageId,
}: ValidationSummaryBlockProps) {
  const updateChatMessage = useEditorStore((s) => s.updateChatMessage);
  const config = useGameStore((s) => s.config);
  const setConfig = useGameStore((s) => s.setConfig);

  const handleDismiss = (): void => {
    updateChatMessage(messageId, (msg) => ({
      ...msg,
      blocks: markBlockResolved(msg.blocks),
    }));
  };

  const handleApplyFix = (): void => {
    if (config) {
      const contracts = ContractRegistry.fromRegistry(createModuleRegistry());
      const report = validateConfig(config, contracts);
      if (report.fixes.length > 0) {
        const fixed = applyFixes(config, report.fixes);
        setConfig(fixed);
      }
    }
    updateChatMessage(messageId, (msg) => ({
      ...msg,
      blocks: markBlockResolved(msg.blocks),
    }));
  };

  if (block.resolved) {
    return (
      <div
        className="rounded-lg border border-green-200 bg-green-50 p-3 mt-2 flex items-center gap-2"
        data-testid="validation-summary-resolved"
      >
        <CheckCircle2 size={16} className="text-green-600" />
        <span className="text-sm text-green-700">
          已修正 {block.issues.length} 项配置问题
        </span>
      </div>
    );
  }

  if (isAdviceBlock(block)) {
    return (
      <div
        className="rounded-lg border border-slate-200 bg-slate-50 p-3 mt-2"
        data-testid="validation-summary-advice"
      >
        <div className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <Info size={16} className="text-slate-500" />
          市场参数建议 — {stripAdvicePrefix(block.summary)}
        </div>

        <ul className="mt-2 space-y-1.5">
          {block.issues.map((issue, i) => (
            <li
              key={i}
              data-testid={`advice-issue-${i}`}
              className="text-xs rounded px-2 py-1 border bg-white border-slate-200 text-slate-700"
            >
              <div className="flex items-center gap-1.5 font-medium">
                <Info size={12} className="text-slate-400" />
                {issue.title}
              </div>
              <div className="mt-0.5 pl-4 text-[11px] opacity-80">
                {issue.description}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="text-xs px-3 py-1.5 rounded-md bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 transition-colors"
          >
            我了解了
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 mt-2"
      data-testid="validation-summary"
    >
      <div className="text-sm font-medium text-amber-900 flex items-center gap-2">
        <AlertTriangle size={16} className="text-amber-600" />
        配置校验反馈 — {block.summary}
      </div>

      <ul className="mt-2 space-y-1.5">
        {block.issues.map((issue, i) => (
          <li
            key={i}
            data-testid={`validation-issue-${i}`}
            data-severity={issue.severity}
            className={`text-xs rounded px-2 py-1 border ${
              issue.severity === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-yellow-50 border-yellow-200 text-yellow-800'
            }`}
          >
            <div className="flex items-center gap-1.5 font-medium">
              {issue.severity === 'error' ? (
                <AlertCircle size={12} className="text-red-500" />
              ) : (
                <AlertTriangle size={12} className="text-yellow-500" />
              )}
              {issue.title}
            </div>
            <div className="mt-0.5 pl-4 text-[11px] opacity-80">
              {issue.description}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex gap-2">
        {block.fixable && (
          <button
            type="button"
            onClick={handleApplyFix}
            className="text-xs px-3 py-1.5 rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors"
          >
            修正这个
          </button>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          className="text-xs px-3 py-1.5 rounded-md bg-white text-amber-800 border border-amber-300 hover:bg-amber-100 transition-colors"
        >
          我了解了
        </button>
      </div>
    </div>
  );
}
