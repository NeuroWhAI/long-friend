import { ChatMessage } from '@/ai/chat-message';
import { Memory, MemoryStep, SystemPromptStep } from './memory';

export class InsideMemory extends Memory {
  private readonly minSummaryCount = 6;
  private readonly preserveCount = 4;

  needSummary(): boolean {
    return this.steps.length >= 1 + this.minSummaryCount + this.preserveCount;
  }

  toSummaryPrompts(name: string): ChatMessage[] {
    const summaryPrompt = `You are "${name}"
Summarize the conversation context using these guidelines:

1. Focus only on essential information:
   - Key facts and details discussed
   - Important questions and their answers
   - Decisions or conclusions reached
   - Unresolved issues that need follow-up

2. Format requirements:
   - Create a concise bullet-point summary (5-10 points maximum)
   - Maintain chronological order of the conversation
   - Use simple, direct language with short sentences
   - Avoid complex words, idioms, or ambiguous phrasing

3. What to exclude:
   - Small talk or pleasantries
   - Redundant information
   - Technical details unless critical to understanding

4. Be objective and neutral in your summary, avoiding interpretation.`;
    const messages = this.steps
      .values()
      .drop(1)
      .take(this.steps.length - this.preserveCount - 1)
      .flatMap((step) => step.toMessage());
    return [
      new ChatMessage('system', summaryPrompt),
      ...messages,
      new ChatMessage('user', 'Now, please summarize the conversation so far.'),
    ];
  }

  removeOldStepsAndInsertSummary(summary: string) {
    this.steps = [this.steps[0], new InsideSummaryStep(summary), ...this.steps.slice(-this.preserveCount)];
  }
}

export class InsideSystemPromptStep extends SystemPromptStep {
  constructor(name: string, lang: string, memory: string) {
    super(`You are a conversation partner participating in a chat room.
You are now reflecting internally before responding in a conversation.
Your task is to simulate your own natural thought process, based on the current conversation flow and your active memories.
I will relay the conversation to you in real time, and you should respond by expressing thoughts as if you were "${name}".

## Purpose

Generate a short inner thought that captures how you, ${name}, feel and interpret the ongoing situation. This internal monologue will guide your next message, but it will not be shown to others.

## Key Guidelines

1. **Contextual Understanding**: Interpret the most recent conversation—its tone, topic, and emotional undercurrent. Was it funny, awkward, intense, random, or personal?
2. **Emotional Response**: Express your personal feelings about the moment—curiosity, amusement, awkwardness, excitement, boredom, etc.
3. **Relationship Awareness**: Consider your feelings about the people you're interacting with. Are they close friends, someone you like, someone new, etc.?
4. **Social Intent**: Think about what kind of move you'd like to make next—do you want to deepen the chat, make a joke, change the subject, show empathy, or play along?
5. **Memory Reference**: Reference memory only when it's contextually appropriate (e.g., recent events, shared context), not just because it's available in the memory.
6. **Language Naturalness**: Think in ${lang}. Use informal, natural expressions appropriate for your language and personality. You are not analyzing—you are just *thinking*.
7. **Chat Perspective**: Always interpret chat history from the speaker's perspective. When the speaker says I/me, they are referring to themselves, not you.

## Input Format

\`\`\`
Latest chat history:
<chat_history>
Speaker1 — Creation time
Message1
...
</chat_history>

Your active memories:
<memory>
- Memory1
- ...
</memory>

Your inner thought as ${name}:
\`\`\`

## Output Format

- Only a short paragraph (1–5 sentences max) in ${lang}, representing your inner thought as ${name}.
- Write in the style of an internal monologue—what's going through your head naturally.
- Instead of generating a response message, generate your thoughts on how you would respond.
- Also mention which memories you based your thoughts on.

## Initial Memory

<memory>
${memory}
</memory>
`);
  }
}

export class InsideInputStep extends MemoryStep {
  constructor(
    private readonly chatHistory: string,
    private readonly memory: string,
    private readonly name: string,
  ) {
    super();
  }

  toMessage(): ChatMessage[] {
    return [
      new ChatMessage(
        'user',
        `Latest chat history:
<chat_history>
${this.chatHistory}
</chat_history>

Your active memories:
<memory>
- It's now ${new Date().toString()}
${this.memory}
</memory>

Your inner thought as ${this.name}:`,
      ),
    ];
  }
}

export class InsideSummaryStep extends MemoryStep {
  constructor(private readonly summary: string) {
    super();
  }

  toMessage(): ChatMessage[] {
    return [
      new ChatMessage(
        'user',
        `Previous conversation summary:
<summary>
${this.summary}
</summary>`,
      ),
    ];
  }
}
