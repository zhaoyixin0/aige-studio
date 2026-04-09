import type { ChatBlock } from '@/agent/conversation-defs';
import { AssetPreviewBlock } from './asset-preview-block';
import { ParamCard } from './param-card';
import { ProgressLogBlock } from './progress-log-block';
import { UploadRequestBlock } from './upload-request-block';
import { ValidationSummaryBlock } from './validation-summary-block';

interface ChatBlockRendererProps {
  blocks: ChatBlock[];
  isLatestAssistant: boolean;
  messageId?: string;
}

export function ChatBlockRenderer({
  blocks,
  isLatestAssistant,
  messageId,
}: ChatBlockRendererProps) {
  return (
    <div className="flex flex-col gap-2 mt-2">
      {blocks.map((block, i) => (
        <ChatBlockItem
          key={i}
          block={block}
          interactive={isLatestAssistant}
          messageId={messageId}
        />
      ))}
    </div>
  );
}

function ChatBlockItem({
  block,
  interactive,
  messageId,
}: {
  block: ChatBlock;
  interactive: boolean;
  messageId?: string;
}) {
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
    case 'validation-summary':
      return <ValidationSummaryBlock block={block} messageId={messageId ?? ''} />;
    default: {
      // Exhaustive check — compile error if a ChatBlock kind is unhandled
      return block satisfies never;
    }
  }
}
