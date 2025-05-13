import type { ChatBufferItem } from '@/chat-buffer/chat-buffer-item';
import { format as formatTimeAgo } from 'timeago.js';
import { ChatMessage } from '../ai/chat-message';
import { OpenAIChatModel } from '../ai/chat-models';
import { db } from '../db/database';
import { Network } from '../db/network';
import { logger } from '../logger';
import { ChatInputStep, ChatMemory, ChatSystemPromptStep } from '../memory/chat-memory';
import { ExtractContextStep, ExtractMemory, ExtractStartStep, ExtractSystemPromptStep } from '../memory/extract-memory';
import { InsideInputStep, InsideMemory, InsideSystemPromptStep } from '../memory/inside-memory';
import { ResponseStep } from '../memory/memory';

export class Agent {
  constructor(private readonly name: string) {}

  private readonly chatModel = new OpenAIChatModel();
  private readonly network = new Network(db, this.chatModel);
  private readonly chatMemory = new ChatMemory();
  private readonly insideMemory = new InsideMemory();

  public chatting = false;
  private thinking = false;
  private chatHistory: ChatBufferItem[] = [];
  private prevResponse = '';

  async init(profile: string, lang: string): Promise<void> {
    const profileMemory = await this.extractMemory(this.name, [
      new ChatMessage('user', `${this.name} — past\n${profile}`),
    ]);
    logger.info(`Initial memory:\n${profileMemory}`);

    const initialMemory = await this.updateAndGetActivatedMemories(this.network, profileMemory);
    logger.info(`Activated memory:\n${initialMemory}`);

    this.chatMemory.clear();
    this.insideMemory.clear();

    this.chatMemory.addStep(new ChatSystemPromptStep(this.name, lang, initialMemory));
    this.insideMemory.addStep(new InsideSystemPromptStep(this.name, lang, initialMemory));
  }

  async chat(incomingChatHistory: ChatBufferItem[]): Promise<string> {
    const chatHistoryLen = this.chatHistory.push(...incomingChatHistory);

    if (this.thinking) {
      return '';
    }
    this.thinking = true;

    try {
      const chatHistory = this.chatHistory.splice(0, chatHistoryLen);

      const chatInput = new ChatInputStep(chatHistory, '', '', this.name);
      this.chatMemory.addStep(chatInput);

      const newMemory = await this.extractMemory(this.name, this.chatMemory.toMessages().slice(1));
      logger.info(`New memory:\n${newMemory}`);

      const activatedMemory = await this.updateAndGetActivatedMemories(this.network, newMemory);
      logger.info(`Activated memory:\n${activatedMemory}`);

      this.insideMemory.addStep(new InsideInputStep(this.prevResponse, chatHistory, activatedMemory, this.name));
      const innerThought = await this.chatModel.chat(this.insideMemory.toMessages());
      logger.info(`Inner thought:\n${innerThought.content}`);
      this.insideMemory.addStep(new ResponseStep(innerThought.content));

      if (this.insideMemory.needSummary()) {
        const summary = await this.chatModel.chat(this.insideMemory.toSummaryPrompts(this.name));
        logger.info(`Inside summary:\n${summary.content}`);

        this.insideMemory.removeOldStepsAndInsertSummary(summary.content);
      }

      chatInput.setMemory(activatedMemory);
      chatInput.setInnerThought(innerThought.content);

      const response = await this.chatModel.chat(this.chatMemory.toMessages());
      logger.info(`Response:\n${response.content}`);

      this.chatMemory.addStep(new ResponseStep(response.content));
      this.prevResponse = response.content;

      chatInput.setMemory('');
      chatInput.setInnerThought('');

      if (this.chatMemory.needSummary()) {
        const summary = await this.chatModel.chat(this.chatMemory.toSummaryPrompts(this.name));
        logger.info(`Chat summary:\n${summary.content}`);

        this.chatMemory.removeOldStepsAndInsertSummary(summary.content);
      }

      this.chatting = true;

      return response.content;
    } catch (err) {
      logger.error(err, 'Failed to generate response');
      return `Failed to generate response.\n${(err as Error).message}`;
    } finally {
      this.thinking = false;
    }
  }

  private async extractMemory(name: string, context: ChatMessage[]): Promise<string> {
    const memory = new ExtractMemory();
    memory.addStep(new ExtractSystemPromptStep(name));
    memory.addStep(new ExtractContextStep(context));
    memory.addStep(new ExtractStartStep());

    const response = await this.chatModel.chat(memory.toMessages());
    return response.content;
  }

  private async updateAndGetActivatedMemories(network: Network, memory: string): Promise<string> {
    const memories = memory
      .split('\n')
      .values()
      .filter((mem) => mem.startsWith('-'))
      .map((mem) => mem.substring(1).trim());

    for (const mem of memories) {
      await network.activateNode(mem);
    }

    await network.updateActivation();

    const nodes = await network.getActivatedNodes(30);
    return nodes.map((n) => `- ${n.memory} (created ${formatTimeAgo(n.createdAt, 'en_US')})`).join('\n');
  }
}
