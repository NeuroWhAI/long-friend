import { ChatMessage } from '@/ai/chat-message';
import { Memory, MemoryStep, SystemPromptStep } from './memory';

export class SummaryMemory extends Memory {}

export class SummarySystemPromptStep extends SystemPromptStep {
  constructor() {
    super(
      'Extract and summarize only the key information, facts, and relevant details from the input text. Ignore opinions, filler, and redundant content. Keep the summary clear, short, and structured.',
    );
  }
}

export class SummaryInputStep extends MemoryStep {
  constructor(private readonly content: string) {
    super();
  }

  toMessage(): ChatMessage[] {
    return [new ChatMessage('user', `${this.content}\n\n---\n\nNow please summarize the above content.`)];
  }
}
