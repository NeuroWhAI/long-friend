import { ChatMessage } from '@/ai/chat-message';

export abstract class MemoryStep {
  abstract toMessage(): ChatMessage;
}

export class Memory {
  private steps: MemoryStep[] = [];

  addStep(step: MemoryStep) {
    this.steps.push(step);
  }

  getSteps(): MemoryStep[] {
    return this.steps;
  }

  clear() {
    this.steps = [];
  }

  toMessages(): ChatMessage[] {
    return this.steps.map((step) => step.toMessage());
  }
}

export class SystemPromptStep extends MemoryStep {
  constructor(private readonly prompt: string) {
    super();
  }

  toMessage(): ChatMessage {
    return new ChatMessage('system', this.prompt);
  }
}

export class ResponseStep extends MemoryStep {
  constructor(private readonly response: string) {
    super();
  }

  toMessage(): ChatMessage {
    return new ChatMessage('assistant', this.response);
  }
}
