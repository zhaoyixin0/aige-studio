import type { ChatBlock } from '@/agent/conversation-defs';
import { AssetPreviewBlock } from './asset-preview-block';
import { ParamCard } from './param-card';
import { ProgressLogBlock } from './progress-log-block';
import { UploadRequestBlock } from './upload-request-block';

interface ChatBlockRendererProps {
  blocks: ChatBlock[];
  isLatestAssistant: boolean;
}

export function ChatBlockRenderer({ blocks, isLatestAssistant }: ChatBlockRendererProps) {
  return (
    <div className="flex flex-col gap-2 mt-2">
      {blocks.map((block, i) => (
        <ChatBlockItem key={i} block={block} interactive={isLatestAssistant} />
      ))}
    </div>
  );
}

function ChatBlockItem({ block, interactive }: { block: ChatBlock; interactive: boolean }) {
  switch (block.kind) {
    case 'asset-preview':
      return <AssetPreviewBlock block={block} />;
    case 'param-card':
      return interactive
        ? <ParamCard block={block} />
        : <ParamCard block={block} disabled />;
    case 'progress-log':
      return <ProgressLogBlock block={block} />;
    case 'upload-request':
      return interactive
        ? <UploadRequestBlock block={block} />
        : null;
    default: {
      const _exhaustive: never = block;
      return (
        <div className="text-xs text-white/30 p-2">
          Unsupported block: {(block as { kind: string }).kind}
        </div>
      );
    }
  }
}
