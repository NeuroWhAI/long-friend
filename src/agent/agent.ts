import type { ChatBufferItem } from '@/chat-buffer/chat-buffer-item';
import { SummaryInputStep, SummaryMemory, SummarySystemPromptStep } from '@/memory/summary-memory';
import type { UnknownTool } from '@/tool/tool';
import { ToolParser } from '@/tool/tool-parser';
import { extension } from 'mime-types';
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
  constructor(
    private readonly name: string,
    private readonly tools: UnknownTool[],
  ) {}

  private readonly chatModel = new OpenAIChatModel();
  private readonly network = new Network(db, this.chatModel);
  private readonly chatMemory = new ChatMemory();
  private readonly insideMemory = new InsideMemory();

  public chatting = false;
  private thinking = false;
  private chatHistory: ChatBufferItem[] = [];
  private prevResponse = '';
  private prevToolResults = '';
  private prevToolImage = '';

  async init(profile: string, lang: string): Promise<void> {
    const profileMemory = await this.extractMemory(this.name, [
      new ChatMessage('user', `${this.name} — past\n${profile}`),
    ]);
    logger.info(`Initial memory:\n${profileMemory}`);

    const initialMemory = await this.updateAndGetActivatedMemories(this.network, profileMemory, 50);
    logger.info(`Activated memory:\n${initialMemory}`);

    this.chatMemory.clear();
    this.insideMemory.clear();

    this.chatMemory.addStep(new ChatSystemPromptStep(this.name, lang, initialMemory));
    this.insideMemory.addStep(new InsideSystemPromptStep(this.name, lang, initialMemory, this.tools));
  }

  async chat(
    incomingChatHistory: ChatBufferItem[],
    fileCallback: (file: Buffer, format: string) => Promise<void>,
  ): Promise<string> {
    const chatHistoryLen = this.chatHistory.push(...incomingChatHistory);

    if (this.thinking) {
      return '';
    }
    this.thinking = true;

    try {
      const chatHistory = this.chatHistory.splice(0, chatHistoryLen);

      const chatInput = new ChatInputStep(chatHistory, '', '', '', '', this.name);
      this.chatMemory.addStep(chatInput);

      const newMemory = await this.extractMemory(this.name, this.chatMemory.toMessages().slice(1));
      logger.info(`New memory:\n${newMemory}`);

      const activatedMemory = await this.updateAndGetActivatedMemories(this.network, newMemory, 30);
      logger.info(`Activated memory:\n${activatedMemory}`);

      this.insideMemory.addStep(
        new InsideInputStep(
          this.prevResponse,
          this.prevToolResults,
          this.prevToolImage,
          chatHistory,
          activatedMemory,
          this.name,
        ),
      );
      const innerThought = await this.chatModel.chat(this.insideMemory.toMessages());
      logger.info(`Inner thought:\n${innerThought.content}`);
      this.insideMemory.addStep(new ResponseStep(innerThought.content));

      if (this.insideMemory.needSummary()) {
        const summary = await this.chatModel.chat(this.insideMemory.toSummaryPrompts(this.name));
        logger.info(`Inside summary:\n${summary.content}`);

        this.insideMemory.removeOldStepsAndInsertSummary(summary.content);
      }

      let toolResults = '';
      let toolImage = '';
      const toolParser = new ToolParser();
      const toolCalls = toolParser.parseAll(innerThought.content);

      if (toolCalls.length > 0) {
        logger.info(`Detected functions: ${toolCalls.map((f) => f.function).join(', ')}`);
        for (const func of toolCalls) {
          const tool = this.tools.find((t) => t.name === func.function);
          if (tool) {
            logger.info(`Executing tool: ${tool.name} with inputs: ${JSON.stringify(func.inputs)}`);
            try {
              const input = await tool.parseInput(func.inputs);
              const toolResult = await tool.execute(input);

              if (toolResult.startsWith('data:')) {
                const fileData = toolResult.substring(toolResult.indexOf(',') + 1);
                const fileMime = /data:([\w\/]+);/g.exec(toolResult)?.[1] ?? 'application/octet-stream';
                const fileFormat = extension(fileMime) || 'bin';
                await fileCallback(Buffer.from(fileData, 'base64'), fileFormat);

                if (toolResult.startsWith('data:image/')) {
                  toolImage = toolResult;
                  toolResults += `\n\nTool ${tool.name} result:\nThe image has been shared successfully.\n\n*(1 image attached)*`;
                } else {
                  toolResults += `\n\nTool ${tool.name} result:\nThe file has been shared successfully.`;
                }
              } else {
                toolResults += `\n\nTool ${tool.name} result:\n${toolResult}`;
              }
            } catch (err) {
              logger.error(err, `Failed to execute tool ${tool.name}`);
              toolResults += `\n\nTool ${tool.name} failed: ${(err as Error).message}`;
            }
          } else {
            logger.warn(`Tool ${func.function} not found`);
            toolResults += `\n\nTool ${func.function} not found.`;
          }
        }
      }

      this.prevToolResults = toolResults.trim();
      if (this.prevToolResults) {
        logger.info(`Tool results:\n${this.prevToolResults}`);
      }

      this.prevToolImage = toolImage;
      if (this.prevToolImage) {
        logger.info('Image generated');
      }

      chatInput.setMemory(activatedMemory);
      chatInput.setInnerThought(innerThought.content);
      chatInput.setToolResult(this.prevToolResults, this.prevToolImage);

      const response = await this.chatModel.chat(this.chatMemory.toMessages());
      logger.info(`Response:\n${response.content}`);

      this.chatMemory.addStep(new ResponseStep(response.content));
      this.prevResponse = response.content;

      chatInput.setMemory('');
      chatInput.setInnerThought('');
      if (!this.prevToolImage) {
        chatInput.setToolResult('', '');
      }

      if (this.chatMemory.needSummary()) {
        const summary = await this.chatModel.chat(this.chatMemory.toSummaryPrompts(this.name));
        logger.info(`Chat summary:\n${summary.content}`);

        this.chatMemory.removeOldStepsAndInsertSummary(summary.content);
      }

      if (this.prevToolResults.length > 300) {
        this.prevToolResults = await this.summarize(this.prevToolResults);
        logger.info(`Summarized tool results:\n${this.prevToolResults}`);
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
    return response.content.trim();
  }

  private async summarize(content: string): Promise<string> {
    const memory = new SummaryMemory();
    memory.addStep(new SummarySystemPromptStep());
    memory.addStep(new SummaryInputStep(content));

    const response = await this.chatModel.chat(memory.toMessages());
    return response.content.trim();
  }

  private async updateAndGetActivatedMemories(network: Network, memory: string, topK: number): Promise<string> {
    const memories = memory
      .split('\n')
      .values()
      .filter((mem) => mem.startsWith('-'))
      .map((mem) => mem.substring(1).trim());

    for (const mem of memories) {
      await network.activateNode(mem);
    }

    await network.updateActivation();

    const nodes = await network.getActivatedNodes(topK);
    return nodes.map((n) => `- ${n.memory} (created ${formatTimeAgo(n.createdAt, 'en_US')})`).join('\n');
  }
}
