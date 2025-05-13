export class ChatMessage {
  constructor(
    public role: 'user' | 'assistant' | 'system',
    public content: string,
    public images: string[] = [],
  ) {}
}
