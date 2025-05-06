import { ChatMessage } from '@/ai/chat-message';

export abstract class MemoryStep {
  abstract toMessage(): ChatMessage[];
}

export class Memory {
  protected steps: MemoryStep[] = [];

  addStep(step: MemoryStep) {
    this.steps.push(step);
  }

  addSteps(steps: MemoryStep[]) {
    this.steps.push(...steps);
  }

  getSteps(): MemoryStep[] {
    return this.steps;
  }

  clear() {
    this.steps = [];
  }

  toMessages(): ChatMessage[] {
    return this.steps.flatMap((step) => step.toMessage());
  }
}

export class SystemPromptStep extends MemoryStep {
  constructor(private readonly prompt: string) {
    super();
  }

  toMessage(): ChatMessage[] {
    return [new ChatMessage('system', this.prompt)];
  }
}

export class ResponseStep extends MemoryStep {
  constructor(private readonly response: string) {
    super();
  }

  toMessage(): ChatMessage[] {
    return [new ChatMessage('assistant', this.response)];
  }
}
