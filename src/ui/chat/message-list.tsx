import { useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { ChatMessage } from '@/store/editor-store';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface MessageListProps {
  messages: readonly ChatMessage[];
  isLoading: boolean;
}

/* ------------------------------------------------------------------ */
/*  MessageList — pure rendering of ChatMessage[]                      */
/* ------------------------------------------------------------------ */

export function MessageList({ messages, isLoading }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll to bottom on new messages */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {isLoading && (
        <div className="flex items-center gap-2 text-gray-400 text-sm px-3 py-2">
          <Loader2 size={14} className="animate-spin" />
          <span>思考中...</span>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MessageBubble                                                      */
/* ------------------------------------------------------------------ */

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-white/5 text-gray-200 border border-white/5'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </div>
  );
}
