/**
 * usePresetEnrichment — P2 async "Skill Pass" React hook.
 *
 * Lifecycle:
 *   1. Subscribes to useGameStore.config.
 *   2. Detects a new hero preset load (meta.heroPresetId present AND
 *      meta.presetEnriched undefined).
 *   3. Marks the config as 'pending' and kicks off preset-enricher with a
 *      fresh AbortController.
 *   4. On success, merges the diff via game-store.applyEnricherDiff so any
 *      user edits made during enrichment win field-level conflicts, then
 *      marks presetEnriched = true.
 *   5. On failure or null result, marks presetEnriched = 'failed'.
 *   6. On explicit cancel(), aborts the signal and marks as 'cancelled'.
 *
 * The hook never throws. UI can render `state` and `lastResult.skippedPaths`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/game-store';
import {
  enrichWithSkill,
  type EnrichmentResult,
  type PresetMeta,
} from '@/agent/preset-enricher';
import type { GameConfig } from '@/engine/core';

export type EnrichmentState =
  | 'idle'
  | 'running'
  | 'done'
  | 'failed'
  | 'cancelled';

export interface PresetEnrichmentHook {
  state: EnrichmentState;
  applied: number;
  skipped: number;
  skippedPaths: string[];
  cancelEnrichment: () => void;
}

interface ActiveRun {
  heroPresetId: string;
  controller: AbortController;
}

function extractPresetMeta(config: GameConfig): PresetMeta | null {
  const heroPresetId = config.meta.heroPresetId;
  if (!heroPresetId) return null;
  const gameType = config.meta.gameType ?? 'catch';
  const meta: PresetMeta = {
    heroPresetId,
    gameType,
    concept: config.meta.concept,
    signatureGoods: config.meta.signatureGoods,
    signatureBads: config.meta.signatureBads,
  };
  return meta;
}

function shouldTriggerEnrichment(config: GameConfig | null): boolean {
  if (!config) return false;
  if (!config.meta.heroPresetId) return false;
  // Only trigger on first load — pending / true / failed / cancelled all
  // mean "already handled this preset".
  return config.meta.presetEnriched === undefined;
}

function patchMetaPresetEnriched(
  value: GameConfig['meta']['presetEnriched'],
): void {
  useGameStore.getState().setPresetEnriched(value);
}

export function usePresetEnrichment(): PresetEnrichmentHook {
  const [state, setState] = useState<EnrichmentState>('idle');
  const [applied, setApplied] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [skippedPaths, setSkippedPaths] = useState<string[]>([]);

  const activeRunRef = useRef<ActiveRun | null>(null);

  const runEnrichment = useCallback(async (config: GameConfig) => {
    const presetMeta = extractPresetMeta(config);
    if (!presetMeta) return;

    // Cancel any previous in-flight run (new preset supersedes old).
    if (activeRunRef.current) {
      activeRunRef.current.controller.abort();
    }

    const controller = new AbortController();
    activeRunRef.current = {
      heroPresetId: presetMeta.heroPresetId,
      controller,
    };

    patchMetaPresetEnriched('pending');
    setState('running');
    setApplied(0);
    setSkipped(0);
    setSkippedPaths([]);

    let result: EnrichmentResult | null = null;
    try {
      result = await enrichWithSkill(config, presetMeta, controller.signal);
    } catch {
      result = null;
    }

    // If our signal was aborted meanwhile, the cancel path already handled
    // state updates — bail out.
    if (controller.signal.aborted) {
      if (activeRunRef.current?.controller === controller) {
        activeRunRef.current = null;
      }
      return;
    }

    // If a different run replaced us, do nothing.
    if (activeRunRef.current?.controller !== controller) return;

    if (result === null) {
      patchMetaPresetEnriched('failed');
      setState('failed');
      activeRunRef.current = null;
      return;
    }

    // Apply diff with field-level user-edit protection.
    const store = useGameStore.getState();
    store.applyEnricherDiff(result.changes, result.startedAt);
    const diffResult = useGameStore.getState().lastEnricherResult;

    patchMetaPresetEnriched(true);
    setApplied(diffResult?.applied ?? 0);
    setSkipped(diffResult?.skipped ?? 0);
    setSkippedPaths(diffResult?.skippedPaths ?? []);
    setState('done');
    activeRunRef.current = null;
  }, []);

  // Subscribe to config changes. Using the raw zustand subscribe API so we
  // see every config mutation, not just React re-renders.
  useEffect(() => {
    // Handle the case where a config is already present at mount.
    const initial = useGameStore.getState().config;
    if (shouldTriggerEnrichment(initial)) {
      void runEnrichment(initial!);
    }

    const unsubscribe = useGameStore.subscribe((state, prev) => {
      if (state.config === prev.config) return;
      if (!shouldTriggerEnrichment(state.config)) return;

      const nextId = state.config!.meta.heroPresetId;
      const activeId = activeRunRef.current?.heroPresetId;
      // Same preset already mid-run: skip.
      if (activeId === nextId && state.config!.meta.presetEnriched === 'pending') {
        return;
      }

      void runEnrichment(state.config!);
    });

    return () => {
      unsubscribe();
    };
  }, [runEnrichment]);

  const cancelEnrichment = useCallback(() => {
    const run = activeRunRef.current;
    if (!run) return;
    run.controller.abort();
    activeRunRef.current = null;
    patchMetaPresetEnriched('cancelled');
    setState('cancelled');
  }, []);

  return {
    state,
    applied,
    skipped,
    skippedPaths,
    cancelEnrichment,
  };
}
