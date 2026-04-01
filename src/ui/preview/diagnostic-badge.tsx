import { useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { ValidationReport } from '@/engine/core/config-validator';
import { getOverallStatus, translateIssue } from './diagnostic-messages';

const selectValidationReport = (s: { validationReport: ValidationReport | null }) =>
  s.validationReport;

const STATUS_COLORS = {
  ok: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
} as const;

const STATUS_LABELS = {
  ok: '正常',
  warning: '有警告',
  error: '有问题',
} as const;

export function DiagnosticBadge() {
  const report = useEditorStore(selectValidationReport);
  const [popoverOpen, setPopoverOpen] = useState(false);

  if (!report) return null;

  const status = getOverallStatus(report);
  const allIssues = [...report.errors, ...report.warnings];
  const issueCount = allIssues.length;

  return (
    <div className="relative">
      <button
        onClick={() => setPopoverOpen(!popoverOpen)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        title={`游戏健康: ${STATUS_LABELS[status]}`}
      >
        <span className={`inline-block w-2 h-2 rounded-full ${STATUS_COLORS[status]}`} />
        {issueCount > 0 && (
          <span className="text-gray-500">{issueCount}</span>
        )}
      </button>

      {popoverOpen && issueCount > 0 && (
        <DiagnosticPopover
          report={report}
          onClose={() => setPopoverOpen(false)}
        />
      )}
    </div>
  );
}

function DiagnosticPopover({
  report,
  onClose,
}: {
  report: ValidationReport;
  onClose: () => void;
}) {
  const allIssues = [...report.errors, ...report.warnings];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      {/* Popover */}
      <div className="absolute right-0 top-full mt-1 z-50 w-72 max-h-80 overflow-y-auto rounded-lg border border-white/10 bg-gray-900 shadow-xl">
        <div className="px-3 py-2 border-b border-white/5">
          <span className="text-xs font-semibold text-gray-300">
            游戏配置诊断
          </span>
          {report.fixes.length > 0 && (
            <span className="ml-2 text-xs text-blue-400">
              ({report.fixes.length} 项已自动修复)
            </span>
          )}
        </div>

        <div className="divide-y divide-white/5">
          {allIssues.map((issue) => {
            const translated = translateIssue(issue);
            const isError = translated.severity === 'error';

            return (
              <div key={`${issue.moduleId}-${issue.category}`} className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full ${
                      isError ? 'bg-red-500' : 'bg-yellow-500'
                    }`}
                  />
                  <span className={`text-xs font-medium ${
                    isError ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {translated.title}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  {translated.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
