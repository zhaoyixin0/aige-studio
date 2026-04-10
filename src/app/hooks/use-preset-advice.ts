// src/app/hooks/use-preset-advice.ts
//
// Subscribes to game-store config changes and, once a preset has been
// enriched (meta.presetEnriched === true), runs detectSignatureDrift against
// the expert card for the current gameType. If drift is detected, a single
// validation-summary chat block is pushed in "advice" mode.

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/game-store';
import { useEditorStore } from '@/store/editor-store';
import type { ChatMessage } from '@/store/editor-store';
import type { GameConfig } from '@/engine/core/types';
import { detectSignatureDrift, type PresetAdvice } from '@/agent/preset-advice';
import { ADVICE_SUMMARY_PREFIX, type ChatBlock } from '@/agent/conversation-defs';

const DEBOUNCE_MS = 500;

function adviceFingerprint(advice: ReadonlyArray<PresetAdvice>): string {
  return advice
    .map(
      (a) =>
        `${a.paramKey}|${a.actualValue.toFixed(2)}|${a.suggestedValue.toFixed(2)}`,
    )
    .sort()
    .join('#');
}

function buildAdviceMessage(
  advice: ReadonlyArray<PresetAdvice>,
): ChatMessage {
  const issues = advice.map((a) => ({
    severity: 'warning' as const,
    title:
      a.level === 'warning'
        ? `参数偏离: ${a.moduleType}.${a.paramKey}`
        : `市场参考: ${a.moduleType}.${a.paramKey}`,
    description: a.message,
  }));

  const block: ChatBlock = {
    kind: 'validation-summary',
    summary: `${ADVICE_SUMMARY_PREFIX} 市场参数建议 ${advice.length} 条`,
    issues,
    fixable: false,
  };

  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: `根据专家游戏数据，发现 ${advice.length} 条参数建议`,
    timestamp: Date.now(),
    blocks: [block],
  };
}

function shouldDetect(config: GameConfig | null): boolean {
  if (!config) return false;
  const gameType = config.meta?.gameType;
  if (typeof gameType !== 'string' || gameType.length === 0) return false;
  return config.meta?.presetEnriched === true;
}

/**
 * Subscribe to game-store config changes and push advice to chat when the
 * current preset parameters drift from expert-calibrated signature params.
 * Debounces rapid updates to a single detection run.
 */
export function usePresetAdvice(): void {
  const config = useGameStore((s) => s.config);

  // Refs hold cross-render state (timer handle, last-seen fingerprint).
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFingerprintRef = useRef<string>('');
  const lastGameTypeRef = useRef<string>('');

  // Reset duplicate-suppression memory when config is cleared so a fresh
  // preset load can surface new advice.
  useEffect(() => {
    if (!config) {
      lastFingerprintRef.current = '';
      lastGameTypeRef.current = '';
    }
  }, [config]);

  useEffect(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!shouldDetect(config)) return;

    const snapshot = config as GameConfig;
    const gameType = snapshot.meta.gameType as string;

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void detectSignatureDrift(snapshot, gameType).then((advice) => {
        if (advice.length === 0) return;

        const fingerprint = adviceFingerprint(advice);
        if (
          gameType === lastGameTypeRef.current &&
          fingerprint === lastFingerprintRef.current
        ) {
          return;
        }
        lastGameTypeRef.current = gameType;
        lastFingerprintRef.current = fingerprint;

        const message = buildAdviceMessage(advice);
        useEditorStore.getState().addChatMessage(message);
      });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [config]);
}
