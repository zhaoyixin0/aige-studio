import { useEffect } from 'react';
import { MainLayout } from '@/ui/layout/main-layout.tsx';
import { loadConfigFromHash } from '@/utils/config-codec';
import { useGameStore } from '@/store/game-store';

import type { GameConfig } from '@/engine/core';

const selectSetConfig = (s: { setConfig: (c: GameConfig) => void }) =>
  s.setConfig;

export function App() {
  const setConfig = useGameStore(selectSetConfig);

  useEffect(() => {
    const shared = loadConfigFromHash();
    if (shared) {
      setConfig(shared);
    }
  }, [setConfig]);

  return <MainLayout />;
}
