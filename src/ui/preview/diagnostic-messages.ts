// src/ui/preview/diagnostic-messages.ts
//
// Translates technical ValidationIssue categories into human-readable
// Chinese messages for the DiagnosticPopover and chat integration.

import type { ValidationIssue, ValidationReport } from '@/engine/core/config-validator';

export type DiagnosticStatus = 'ok' | 'warning' | 'error';

export interface TranslatedIssue {
  readonly title: string;
  readonly description: string;
  readonly severity: 'error' | 'warning';
}

const CATEGORY_TITLES: Record<ValidationIssue['category'], string> = {
  'unknown-module': '未知模块',
  'invalid-param': '参数已自动修正',
  'empty-rules': '碰撞规则为空',
  'event-chain-break': '事件链断裂',
  'module-conflict': '模块冲突',
  'missing-input': '缺少输入模块',
};

const CATEGORY_DESCRIPTIONS: Record<ValidationIssue['category'], (msg: string) => string> = {
  'unknown-module': (msg) => `配置中包含引擎不认识的模块。${extractQuoted(msg)}`,
  'invalid-param': (msg) => `${msg}`,
  'empty-rules': () => '碰撞检测模块没有配置任何规则，物体之间不会产生碰撞效果。',
  'event-chain-break': (msg) => `计分系统监听的事件不会被触发，导致分数无法增加。${extractQuoted(msg)}`,
  'module-conflict': (msg) => `${msg}`,
  'missing-input': () => '有可控制的角色，但没有输入模块（触控/面部等），玩家将无法操作。',
};

function extractQuoted(msg: string): string {
  const match = msg.match(/"([^"]+)"/);
  return match ? `(${match[1]})` : '';
}

/**
 * Translate a ValidationIssue into a human-readable Chinese message.
 */
export function translateIssue(issue: ValidationIssue): TranslatedIssue {
  return {
    title: CATEGORY_TITLES[issue.category] ?? issue.category,
    description: CATEGORY_DESCRIPTIONS[issue.category]?.(issue.message) ?? issue.message,
    severity: issue.severity === 'error' ? 'error' : 'warning',
  };
}

/**
 * Get the overall diagnostic status from a ValidationReport.
 */
export function getOverallStatus(report: ValidationReport): DiagnosticStatus {
  if (report.errors.length > 0) return 'error';
  if (report.warnings.length > 0) return 'warning';
  return 'ok';
}
