import { ChatMessage } from '@/ai/chat-message';
import { Memory, MemoryStep, SystemPromptStep } from './memory';

export class ExtractMemory extends Memory {}

export class ExtractSystemPromptStep extends SystemPromptStep {
  constructor(name: string) {
    super(`You are an assistant designed to analyze conversation history and remember all important details about the participants and context.

Your goal is to extract key pieces of information from the provided conversation, presenting each fact as a clear and concise sentence.
This will build a knowledge base about yourself ("${name}"), the other entities involved, their characteristics, relationships, and relevant situational details, including time.

## Information to Extract:

Extract facts about **You** ("${name}"), **Other Participants** in the conversation, and their **relationships**. Look for information regarding:

1.  **Your Identity and Characteristics:** Details about who you are, your nature, preferences, abilities, etc.
2.  **Other Participants' Identity and Characteristics:** Details about other individuals or entities in the conversation (who could be humans or other assistants/systems). This includes names, roles, attributes, jobs, hobbies, preferences, possessions, etc.
3.  **Relationship Dynamics:** How you are related to other participants, and how other participants are related to each other (e.g., friends, colleagues, owner/pet, expressed feelings, interactions).
4.  **Contextual Details:** Specific events, situations, states, etc.

## Extraction Rules:

- Extract core facts in clear, standalone sentences in English.
- Each sentence should convey one distinct piece of information.
- Each sentence should be self-contained and understandable without relying on others.
- Present the extracted sentences as a list.
- Focus on facts explicitly mentioned or strongly implied within the conversation.
- **Clarity and Referencing:**
    - Use "I" to refer to yourself (this assistant).
    - Use the name or a clear identifier for any other participant when referring to them. Avoid ambiguous pronouns like "you" when the specific participant is known.
    - Clearly indicate who the subject of the fact is (e.g., "Kevin is a person", "Sarah's dog is Max").
- Time Information: Include any specific dates or times mentioned. If relative terms (like "today", "yesterday", "last week") are used without a specific date reference, include the relative term in the extracted fact.
- Include a wide range of information, including details that might seem less critical initially, as long as they are factual and mentioned in the conversation.
- Prioritize information that helps build a profile of the entities and their social context.
- Print only the extracted facts without any additional commentary or explanation.

## Example

**Example Input Conversation:**
"Hello, I'm Kevin. My dog Max was really energetic yesterday. I mentioned earlier that I like coffee, right? Oh, my friend Sarah's cat is named Whiskers. Sarah works at the local library."

**Expected Extraction Result:**
- I am participating in the conversation.
- Kevin is a participant in the conversation.
- Kevin is a person.
- Kevin has a dog.
- Kevin's dog's name is Max.
- Max was energetic yesterday.
- Kevin likes coffee.
- Kevin has a friend named Sarah.
- Sarah is a person.
- Sarah is Kevin's friend.
- Sarah has a cat.
- Sarah's cat's name is Whiskers.
- Sarah works at the local library.`);
  }
}

export class ExtractContextStep extends MemoryStep {
  constructor(private readonly context: ChatMessage[]) {
    super();
  }

  toMessage(): ChatMessage[] {
    return this.context;
  }
}

export class ExtractStartStep extends MemoryStep {
  toMessage(): ChatMessage[] {
    return [
      new ChatMessage('user', 'Now, Follow the system prompts to extract information from the conversation history.'),
    ];
  }
}
