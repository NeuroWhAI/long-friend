import { Agent } from './agent';

export class AgentManager {
  constructor(
    private readonly agentName: string,
    private readonly agentProfile: string,
    private readonly agentLang: string,
  ) {}

  private readonly agents: Map<string, Agent> = new Map();

  async chat(channelId: string, chatHistory: string): Promise<string> {
    let agent = this.agents.get(channelId);
    if (!agent) {
      agent = new Agent(this.agentName);
      await agent.init(this.agentProfile, this.agentLang);
    }
    return await agent.chat(chatHistory);
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
}
