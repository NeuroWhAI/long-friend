import { env } from '@/env';
import { logger } from '@/logger';
import { input } from '@inquirer/prompts';
import { OpenAIChatModel } from './ai/chat-models';
import { ChatInputStep, ChatMemory, ChatSystemPromptStep } from './memory/chat-memory';

logger.info(`Starting up in ${env.NODE_ENV} mode`);

const onCloseSignal = () => {
  logger.info('sigint received, shutting down');

  setTimeout(() => process.exit(1), 10000).unref(); // Force shutdown after timeout

  // Do some cleanup here

  process.exit(0); // Exit gracefully
};

process.on('SIGINT', onCloseSignal);
process.on('SIGTERM', onCloseSignal);

const chatModel = new OpenAIChatModel();
const memory = new ChatMemory();
memory.addStep(new ChatSystemPromptStep(env.AI_NAME, 'Korean', ''));

while (true) {
  const userMessage = await input({ message: `${env.USER_NAME}:`, theme: { prefix: '>' } });
  if (!userMessage) {
    break;
  }

  memory.addStep(new ChatInputStep(`${env.USER_NAME}: ${userMessage}`, '', env.AI_NAME));

  process.stdout.write(`< ${env.AI_NAME}: `);
  const stream = chatModel.stream(memory.toMessages());
  for await (const chunk of stream) {
    process.stdout.write(chunk);
  }
  console.log();
}
