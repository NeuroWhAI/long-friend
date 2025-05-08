import { env } from '@/env';
import { logger } from '@/logger';
import { input } from '@inquirer/prompts';
import { ChatMessage } from './ai/chat-message';
import { OpenAIChatModel } from './ai/chat-models';
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

const chatModel = new OpenAIChatModel();

const initialMemory = await extractMemory([new ChatMessage('user', `${env.AI_NAME}:\n${profile}`)]);
console.log(`Initial memory:\n${initialMemory}`);

const memory = new ChatMemory();
memory.addStep(new ChatSystemPromptStep(env.AI_NAME, env.AI_LANGUAGE, initialMemory));

const insideMemory = new InsideMemory();
insideMemory.addStep(new InsideSystemPromptStep(env.AI_NAME, env.AI_LANGUAGE, initialMemory));

while (true) {
  const userMessage = await input({ message: `${env.USER_NAME}:`, theme: { prefix: '>' } });
  if (!userMessage) {
    break;
  }

  const chatInput = new ChatInputStep(`${env.USER_NAME}: ${userMessage}`, '', env.AI_NAME);
  memory.addStep(chatInput);

  const newMemory = await extractMemory(memory.toMessages().slice(1));
  console.log(`New memory:\n${newMemory}`);

  insideMemory.addStep(new InsideInputStep(`${env.USER_NAME}: ${userMessage}`, newMemory, env.AI_NAME));
  const innerThought = await chatModel.chat(insideMemory.toMessages());
  console.log(`Inner thought:\n${innerThought.content}`);
  insideMemory.addStep(new ResponseStep(innerThought.content));

  chatInput.setInnerThought(innerThought.content);

  const responseBuffer: string[] = [];
  process.stdout.write(`< ${env.AI_NAME}: `);
  const stream = chatModel.stream(memory.toMessages());
  for await (const chunk of stream) {
    process.stdout.write(chunk);
    responseBuffer.push(chunk);
  }
  console.log();

  memory.removeThoughts();
  memory.addStep(new ResponseStep(responseBuffer.join('')));
}

async function extractMemory(context: ChatMessage[]): Promise<string> {
  const memory = new ExtractMemory();
  memory.addStep(new ExtractSystemPromptStep(env.AI_NAME));
  memory.addStep(new ExtractContextStep(context));
  memory.addStep(new ExtractStartStep());

  const response = await chatModel.chat(memory.toMessages());
  return response.content;
}
