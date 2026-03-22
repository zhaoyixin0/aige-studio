import { useState, useRef, useEffect } from 'react';
import { SendHorizontal, Loader2, MessageSquare } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store.ts';
import type { ChatMessage } from '@/store/editor-store.ts';
import { useGameStore } from '@/store/game-store.ts';
import { Agent } from '@/agent/index.ts';

const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;

let agentInstance: Agent | null = null;
function getAgent(): Agent | null {
  if (agentInstance) return agentInstance;
  if (apiKey) {
    agentInstance = new Agent(apiKey);
  }
  return agentInstance;
}

export function ChatPanel() {
  const chatMessages = useEditorStore((s) => s.chatMessages);
  const isChatLoading = useEditorStore((s) => s.isChatLoading);
  const addChatMessage = useEditorStore((s) => s.addChatMessage);
  const setChatLoading = useEditorStore((s) => s.setChatLoading);
  const config = useGameStore((s) => s.config);
  const setConfig = useGameStore((s) => s.setConfig);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    addChatMessage(userMessage);
    setInput('');

    const agent = getAgent();
    if (!agent) {
      addChatMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'API key not configured. Set VITE_ANTHROPIC_API_KEY in your .env file.',
        timestamp: Date.now(),
      });
      return;
    }

    setChatLoading(true);
    try {
      const response = await agent.process(text, config);

      if (response.config) {
        setConfig(response.config);
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
        suggestions:
          response.suggestions.length > 0 ? response.suggestions : undefined,
        timestamp: Date.now(),
      };

      addChatMessage(assistantMessage);
    } catch (err) {
      const errorText =
        err instanceof Error ? err.message : 'Unknown error occurred';
      addChatMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${errorText}`,
        timestamp: Date.now(),
      });
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-white/5">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
        <MessageSquare size={14} className="text-gray-400" />
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Chat
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 text-gray-500 text-sm">
            <MessageSquare size={24} className="mb-2 opacity-50" />
            Start a conversation
          </div>
        )}

        {chatMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isChatLoading && (
          <div className="flex items-center gap-2 text-gray-400 text-sm px-3 py-2">
            <Loader2 size={14} className="animate-spin" />
            Thinking...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/5">
        <div className="flex items-end gap-2 bg-white/5 rounded-lg border border-white/10 px-3 py-2">
          <textarea
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 resize-none focus:outline-none max-h-24"
            placeholder="Describe your game idea..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            onClick={() => void handleSend()}
            disabled={!input.trim() || isChatLoading}
            className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-1"
          >
            <SendHorizontal size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

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

        {message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-2 flex flex-col gap-1 border-t border-white/10 pt-2">
            {message.suggestions.map((s, i) => (
              <div key={i} className="text-xs text-gray-400">
                <span className="font-medium text-gray-300">{s.moduleType}</span>
                {' — '}
                {s.reason}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
