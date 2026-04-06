import { useEffect } from 'react';
import { MainLayout } from '@/ui/layout/main-layout.tsx';
import { loadConfigFromHash } from '@/utils/config-codec';
import { useGameStore } from '@/store/game-store';

const selectSetConfig = (s: { setConfig: (c: Parameters<typeof s.setConfig>[0]) => void }) =>
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
