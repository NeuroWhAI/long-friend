import { env } from '@/env';
import OpenAI from 'openai';
import type {
  ChatCompletionContentPart,
  ChatCompletionContentPartImage,
  ChatCompletionMessageParam,
  ChatCompletionUserMessageParam,
} from 'openai/resources/chat';
import { ChatMessage } from './chat-message';
import { mergeMessages } from './utils';

export abstract class ChatModel {
  abstract chat(messages: ChatMessage[]): Promise<ChatMessage>;
  abstract stream(messages: ChatMessage[]): AsyncGenerator<string, void, unknown>;
  abstract embed(text: string): Promise<number[]>;
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
      messages: this.buildMessages(messages),
      stream: false,
    });

    return new ChatMessage('assistant', response.choices[0].message.content ?? '');
  }

  async *stream(messages: ChatMessage[]): AsyncGenerator<string, void, unknown> {
    const stream = await this.openai.chat.completions.create({
      model: env.CHAT_MODEL,
      messages: this.buildMessages(messages),
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.choices[0].delta?.content) {
        yield chunk.choices[0].delta.content;
      }
    }
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: env.EMBEDDING_MODEL,
      input: text,
    });
    return response.data[0].embedding;
  }

  private buildMessages(messages: ChatMessage[]): ChatCompletionMessageParam[] {
    return mergeMessages(messages).map((m) =>
      m.role === 'user'
        ? ({
            role: m.role,
            content: [
              { type: 'text', text: m.content },
              ...m.images.map(
                (url) => ({ type: 'image_url' as const, image_url: { url } }) satisfies ChatCompletionContentPartImage,
              ),
            ],
          } satisfies ChatCompletionUserMessageParam)
        : ({
            role: m.role,
            content: m.content,
          } satisfies ChatCompletionMessageParam),
    );
  }
}
