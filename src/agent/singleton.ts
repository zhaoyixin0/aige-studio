import { ConversationAgent } from './conversation-agent';

/** Shared ConversationAgent instance, stored on window to survive HMR. */
export function getConversationAgent(): ConversationAgent {
  const w = window as any;
  if (!w.__conversationAgent) {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
    w.__conversationAgent = new ConversationAgent(apiKey);
  }
  return w.__conversationAgent;
}
