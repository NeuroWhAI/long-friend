import { env } from '@/env';
import OpenAI from 'openai';
import { ChatMessage } from './chat-message';

export abstract class ChatModel {
  abstract chat(messages: ChatMessage[]): Promise<ChatMessage>;
  abstract stream(messages: ChatMessage[]): AsyncGenerator<string, void, unknown>;
}

export class OpenAIChatModel extends ChatModel {
  constructor() {
    super();
    this.openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  private readonly openai: OpenAI;

  async chat(messages: ChatMessage[]): Promise<ChatMessage> {
    const response = await this.openai.chat.completions.create({
      model: env.CHAT_MODEL,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      stream: false,
    });

    return new ChatMessage('assistant', response.choices[0].message.content ?? '');
  }

  async *stream(messages: ChatMessage[]): AsyncGenerator<string, void, unknown> {
    const stream = await this.openai.chat.completions.create({
      model: env.CHAT_MODEL,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.choices[0].delta?.content) {
        yield chunk.choices[0].delta.content;
      }
    }
  }
}
