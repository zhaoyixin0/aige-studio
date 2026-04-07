import { ConversationAgent } from './conversation-agent';

/** Shared ConversationAgent instance, stored on window to survive HMR. */
export function getConversationAgent(): ConversationAgent {
  const w = window as Record<string, unknown>;
  if (!w.__conversationAgent) {
    w.__conversationAgent = new ConversationAgent();
  }
  return w.__conversationAgent as ConversationAgent;
}
