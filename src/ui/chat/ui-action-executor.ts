import { AssetAgent } from '@/services/asset-agent';
import { useGameStore } from '@/store/game-store';
import { useEditorStore } from '@/store/editor-store';
import { type UIAction, type ProgressEntry } from '@/agent/conversation-defs';

export function dispatchUIAction(action: UIAction): void {
  window.dispatchEvent(new CustomEvent('ui-action', { detail: action }));
}

export function setupUIActionExecutor() {
  const handleUIAction = async (e: Event) => {
    const action = (e as CustomEvent).detail as UIAction;
    if (!action) return;

    const gameStore = useGameStore.getState();
    const editorStore = useEditorStore.getState();

    switch (action.type) {
      case 'REQUEST_ASSETS_GENERATE': {
        const config = gameStore.config;
        if (!config) return;

        const assetAgent = new AssetAgent();
        let progressEntries: ProgressEntry[] = [];
        const messageId = `gen-${Date.now()}`;

        // Add initial message with progress log block
        editorStore.addChatMessage({
          id: messageId,
          role: 'assistant',
          content: '正在生成素材...',
          blocks: [{ kind: 'progress-log', entries: progressEntries }],
          timestamp: Date.now(),
        });

        try {
          const assets = await assetAgent.fulfillAssets(config, (p) => {
            // Build new entries array immutably
            const existingIdx = progressEntries.findIndex(e => e.key === p.key);
            progressEntries = existingIdx !== -1
              ? progressEntries.map((e, i) => i === existingIdx ? { ...e, status: p.status, message: `${p.key}: ${p.status}` } : e)
              : [...progressEntries, { key: p.key, status: p.status, message: `${p.key}: ${p.status}` }];

            // Update the message in store (this triggers re-render)
            const updatedEntries = progressEntries;
            useEditorStore.setState((state) => ({
              chatMessages: state.chatMessages.map(m =>
                m.id === messageId ? { ...m, blocks: [{ kind: 'progress-log', entries: updatedEntries }] } : m
              )
            }));
          });

          if (Object.keys(assets).length > 0) {
            gameStore.batchUpdateAssets(assets);
            
            if (action.showPreview) {
              const items = Object.entries(assets).map(([key, asset]) => ({
                key,
                label: key,
                src: asset.src,
                source: 'ai' as const
              }));

              editorStore.addChatMessage({
                id: `preview-${Date.now()}`,
                role: 'assistant',
                content: `已成功生成 ${Object.keys(assets).length} 个素材！`,
                blocks: [{ kind: 'asset-preview', items, allowApplyAll: true }],
                timestamp: Date.now(),
              });
            }
          }
        } catch (_err) {
          editorStore.addChatMessage({
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: '素材生成失败，请重试。',
            timestamp: Date.now(),
          });
        }
        break;
      }

      case 'REQUEST_ASSET_REPLACE': {
        // This usually triggers the upload request block in the chat
        // which is already handled by the agent returning that block.
        // But if called via UI action (e.g. RefreshCw), we might want to trigger something else.
        if (action.preferredSource === 'ai') {
          // Trigger generation for this specific key
          dispatchUIAction({ type: 'REQUEST_ASSETS_GENERATE', keys: [action.target], showPreview: true });
        } else {
          // Open asset browser or upload dialog — not yet implemented
          void 0;
        }
        break;
      }
      
      case 'SHOW_ASSET_PREVIEWS': {
        if (action.items) {
          editorStore.addChatMessage({
            id: `show-${Date.now()}`,
            role: 'assistant',
            content: '当前素材预览：',
            blocks: [{ kind: 'asset-preview', items: action.items, allowApplyAll: true }],
            timestamp: Date.now(),
          });
        }
        break;
      }
    }
  };

  window.addEventListener('ui-action', handleUIAction);
  return () => window.removeEventListener('ui-action', handleUIAction);
}
