// Sync hook: recomputes Game Feel score whenever GameConfig changes.
// Uses requestIdleCallback for non-blocking updates.

import { useEffect } from 'react';
import { useGameStore } from '@/store/game-store';
import { useEditorStore } from '@/store/editor-store';
import { computeFeelScore } from '@/engine/diagnostics/game-feel-scorer';

export function useGameFeelSync(): void {
  const config = useGameStore((s) => s.config);
  const setGameFeel = useEditorStore((s) => s.setGameFeel);

  useEffect(() => {
    if (!config) return;

    const id = requestIdleCallback(() => {
      const result = computeFeelScore(config);
      setGameFeel({
        score: result.total,
        dimensions: result.dimensions,
        suggestions: result.suggestions,
        badge: result.badge,
      });
    });

    return () => cancelIdleCallback(id);
  }, [config, setGameFeel]);
}
