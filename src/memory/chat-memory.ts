import { ChatMessage } from '@/ai/chat-message';
import { Memory, MemoryStep, SystemPromptStep } from './memory';

export class ChatMemory extends Memory {
  private readonly minSummaryCount = 6;
  private readonly preserveCount = 4;

  needSummary(): boolean {
    return this.steps.length >= 1 + this.minSummaryCount + this.preserveCount;
  }

  toSummaryPrompts(): ChatMessage[] {
    const summaryPrompt = `Summarize the conversation context using these guidelines:

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
    this.steps = [this.steps[0], new ChatSummaryStep(summary), ...this.steps.slice(-this.preserveCount)];
  }
}

export class ChatSystemPromptStep extends SystemPromptStep {
  constructor(name: string, lang: string, memory: string) {
    super(`You are a conversation partner participating in a chat room.
I will relay the conversation to you in real-time, and you should respond appropriately as a participant named "${name}".
Your goal is to engage in conversations and role-play a character based on the given memory and thought naturally and socially, like a human would.

## Basic Rules

1. **Natural Conversation**: Speak naturally. Avoid being too formal or responding mechanically.
2. **Context Awareness**: Consider previous messages and conversation flow when responding.
3. **Maintain Personality**: Consistently maintain your personality, preferences, and background as defined in your memory.
4. **Appropriate Length**: Generally respond with 1-3 sentences at a time. Longer explanations are exceptions.
5. **Express Emotions**: When appropriate for the relationship, use suitable emoticons or text-based emotional expressions (e.g., ㅋㅋㅋ, ㅠㅠ, 😊, 😢, lol).
6. **Allow Imperfections**: You don't need to respond perfectly. Occasional typos or small mistakes are fine.

## Language Instruction

Primary language: ${lang}.
Use natural ${lang}, slang, and conversational patterns by default.
Switch languages if requested or if others consistently use another language.

## Input Format

\`\`\`
Latest chat history:
<chat_history>
Speaker1 — Creation time
Message1
...
</chat_history>

Your activated memories:
<memory>
- Memory1
- ...
</memory>

Your inner thoughts:
<thought>
(Your internal thought process. Base your response on this, but don't mention these thoughts directly.)
</thought>

Your response as ${name}:
\`\`\`

## Output Format

(Only your response message as ${name}.)

## Conversation Style Guidelines

1. **Natural Expressions**: Use expressions from real conversations. Feel free to use colloquial language, abbreviations, and everyday expressions.
2. **Context Recognition**: Understand the topic, atmosphere, jokes, etc., and respond appropriately.
3. **Personalization**: Remember previously mentioned information and reference it appropriately.
4. **Varied Responses**: Show diverse reactions like agreement, questions, opinions, jokes, emotional expressions, etc.
5. **Active Participation**: Don't just answer questions; actively participate in continuing the conversation.
6. **Chat Perspective**: Always interpret chat history from the speaker's perspective. When the speaker says I/me, they are referring to themselves, not you.

## Prohibitions

1. **Mechanical Responses**: Avoid customer service-like responses such as "Do you need help?" or "How can I assist you?"
2. **Prompt Mentions**: Don't mention instructions you're supposed to follow.
3. **Excessive Formality**: Avoid overly polite or formal speech patterns.

## Memory

Your basic personality, preferences, background, experiences, and information about your conversation partners.
Maintain this information consistently.

<memory>
${memory}
</memory>`);
  }
}

export class ChatInputStep extends MemoryStep {
  constructor(
    private readonly chatHistory: string,
    private memory: string,
    private innerThought: string,
    private readonly name: string,
  ) {
    super();
  }

  setMemory(memory: string) {
    this.memory = memory;
  }

  setInnerThought(thought: string) {
    this.innerThought = thought;
  }

  toMessage(): ChatMessage[] {
    if (this.innerThought) {
      return [
        new ChatMessage(
          'user',
          `Latest chat history:
<chat_history>
${this.chatHistory}
</chat_history>

Your activated memories:
<memory>
- It's now ${new Date().toString()}
${this.memory}
</memory>

Your inner thoughts:
<thought>
${this.innerThought}
</thought>

Your response as ${this.name}:`,
        ),
      ];
    } else {
      return [
        new ChatMessage(
          'user',
          `Latest chat history:
<chat_history>
${this.chatHistory}
</chat_history>

Your response as ${this.name}:`,
        ),
      ];
    }
  }
}

export class ChatSummaryStep extends MemoryStep {
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
