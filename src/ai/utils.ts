import type { ChatMessage } from './chat-message';

export function mergeMessages(messages: ChatMessage[]): ChatMessage[] {
  const mergedMessages: ChatMessage[] = [];

  for (const message of messages) {
    if (mergedMessages.length === 0) {
      mergedMessages.push(message);
    } else {
      const lastMessage = mergedMessages[mergedMessages.length - 1];
      if (lastMessage.role === message.role) {
        lastMessage.content += `\n\n---\n\n${message.content}`;
      } else {
        mergedMessages.push(message);
      }
    }
  }

  return mergedMessages;
}
