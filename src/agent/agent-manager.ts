import type { ChatBufferItem } from '@/chat-buffer/chat-buffer-item';
import { ImagenTool } from '@/tool/imagen-tool';
import { SearchTool } from '@/tool/search-tool';
import type { UnknownTool } from '@/tool/tool';
import { WeatherTool } from '@/tool/weather-tool';
import { Agent } from './agent';

export class AgentManager {
  constructor(
    private readonly agentName: string,
    private readonly agentProfile: string,
    private readonly agentLang: string,
  ) {}

  private readonly agents: Map<string, Agent> = new Map();

  async chat(
    channelId: string,
    chatHistory: ChatBufferItem[],
    fileCallback: (file: Buffer, format: string) => Promise<void>,
  ): Promise<string> {
    let agent = this.agents.get(channelId);
    if (!agent) {
      const tools = this.makeTools();
      agent = new Agent(this.agentName, tools);
      this.agents.set(channelId, agent);
      await agent.init(this.agentProfile, this.agentLang);
    }
    return await agent.chat(chatHistory, fileCallback);
  }

  checkChatting(channelId: string): boolean {
    const agent = this.agents.get(channelId);
    if (!agent) return false;
    return agent.chatting;
  }

  stopChatting(channelId: string) {
    const agent = this.agents.get(channelId);
    if (!agent) return;
    agent.chatting = false;
  }

  private makeTools(): UnknownTool[] {
    const weather = new WeatherTool();
    const search = new SearchTool();
    const imagen = new ImagenTool();
    return [weather, search, imagen];
  }
}
