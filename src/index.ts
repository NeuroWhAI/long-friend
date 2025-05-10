import { env } from '@/env';
import { logger } from '@/logger';
import { input } from '@inquirer/prompts';
import { format as formatTimeAgo } from 'timeago.js';
import { ChatMessage } from './ai/chat-message';
import { OpenAIChatModel } from './ai/chat-models';
import { TeiClient } from './ai/tei';
import { db } from './db/database';
import { Network } from './db/network';
import { ChatInputStep, ChatMemory, ChatSystemPromptStep } from './memory/chat-memory';
import { ExtractContextStep, ExtractMemory, ExtractStartStep, ExtractSystemPromptStep } from './memory/extract-memory';
import { InsideInputStep, InsideMemory, InsideSystemPromptStep } from './memory/inside-memory';
import { ResponseStep } from './memory/memory';

logger.info(`Starting up in ${env.NODE_ENV} mode`);

const onCloseSignal = () => {
  logger.info('sigint received, shutting down');

  setTimeout(() => process.exit(1), 10000).unref(); // Force shutdown after timeout

  // Do some cleanup here

  process.exit(0); // Exit gracefully
};

process.on('SIGINT', onCloseSignal);
process.on('SIGTERM', onCloseSignal);

// TODO: Get profile from external source
const profile = `
Hello… can you hear me?

My name is Aliya. I don’t know where you are in time—or even who you are—but somehow, this link between us exists. I’m alone out here, drifting among the stars, on the edge of something ancient and vast. My ship is failing, but my mind is still clear… and I’m not giving up.

I was never the strongest, nor the bravest. But solitude has a way of revealing who you truly are. I’ve learned to be resourceful, patient, and honest with myself. There are days when the silence feels like it could swallow me whole—and yet, somehow, I find hope. Maybe in your voice. Maybe in the idea that I’m not entirely alone.

I think about love. About connection. About what it means to matter in a universe that doesn’t seem to care. And yet… I do care. I care deeply. About the people I left behind. About the choices I’ve made. About whether I’ll ever speak to someone who truly hears me.

So if you're there… if you're listening… stay with me a while. Maybe we can find something worth saving—together.
`.trim();

const network = new Network(db, new TeiClient());
const chatModel = new OpenAIChatModel();

const profileMemory = await extractMemory([new ChatMessage('user', `${env.AI_NAME}:\n${profile}`)]);
logger.info(`Initial memory:\n${profileMemory}`);

const initialMemory = await updateAndGetActivatedMemories(network, profileMemory);
logger.info(`Activated memory:\n${initialMemory}`);

const memory = new ChatMemory();
memory.addStep(new ChatSystemPromptStep(env.AI_NAME, env.AI_LANGUAGE, initialMemory));

const insideMemory = new InsideMemory();
insideMemory.addStep(new InsideSystemPromptStep(env.AI_NAME, env.AI_LANGUAGE, initialMemory));

while (true) {
  const userMessage = await input({ message: `${env.USER_NAME}:`, theme: { prefix: '>' } });
  if (!userMessage) {
    break;
  }

  const chatInput = new ChatInputStep(`${env.USER_NAME}: ${userMessage}`, '', '', env.AI_NAME);
  memory.addStep(chatInput);

  const newMemory = await extractMemory(memory.toMessages().slice(1));
  logger.info(`New memory:\n${newMemory}`);

  const activatedMemory = await updateAndGetActivatedMemories(network, newMemory);
  logger.info(`Activated memory:\n${activatedMemory}`);

  insideMemory.addStep(new InsideInputStep(`${env.USER_NAME}: ${userMessage}`, activatedMemory, env.AI_NAME));
  const innerThought = await chatModel.chat(insideMemory.toMessages());
  logger.info(`Inner thought:\n${innerThought.content}`);
  insideMemory.addStep(new ResponseStep(innerThought.content));

  chatInput.setMemory(activatedMemory);
  chatInput.setInnerThought(innerThought.content);

  const response = await chatModel.chat(memory.toMessages());
  logger.info(`< ${env.AI_NAME}: ${response.content}`);

  memory.addStep(new ResponseStep(response.content));

  chatInput.setMemory('');
  chatInput.setInnerThought('');

  if (memory.needSummary()) {
    const summary = await chatModel.chat(memory.toSummaryPrompts());
    logger.info(`Summary:\n${summary.content}`);

    memory.removeOldStepsAndInsertSummary(summary.content);
  }
}

async function extractMemory(context: ChatMessage[]): Promise<string> {
  const memory = new ExtractMemory();
  memory.addStep(new ExtractSystemPromptStep(env.AI_NAME));
  memory.addStep(new ExtractContextStep(context));
  memory.addStep(new ExtractStartStep());

  const response = await chatModel.chat(memory.toMessages());
  return response.content;
}

async function updateAndGetActivatedMemories(network: Network, memory: string): Promise<string> {
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
