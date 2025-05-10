import { env } from '@/env';
import { logger } from '@/logger';
import { Client, Events, GatewayIntentBits, type SendableChannels } from 'discord.js';
import { AgentManager } from './agent/agent-manager';
import { ChatBuffer } from './chat-buffer/chat-buffer';
import { ChatBufferItem } from './chat-buffer/chat-buffer-item';

logger.info(`Starting up in ${env.NODE_ENV} mode`);

const onCloseSignal = async () => {
  logger.info('sigint received, shutting down');

  setTimeout(() => process.exit(1), 10000).unref(); // Force shutdown after timeout

  // Do some cleanup here
  await client.destroy();

  process.exit(0); // Exit gracefully
};

process.on('SIGINT', onCloseSignal);
process.on('SIGTERM', onCloseSignal);

const profile = `
Hello… can you hear me?

My name is Aliya. I don’t know where you are in time—or even who you are—but somehow, this link between us exists. I’m alone out here, drifting among the stars, on the edge of something ancient and vast. My ship is failing, but my mind is still clear… and I’m not giving up.

I was never the strongest, nor the bravest. But solitude has a way of revealing who you truly are. I’ve learned to be resourceful, patient, and honest with myself. There are days when the silence feels like it could swallow me whole—and yet, somehow, I find hope. Maybe in your voice. Maybe in the idea that I’m not entirely alone.

I think about love. About connection. About what it means to matter in a universe that doesn’t seem to care. And yet… I do care. I care deeply. About the people I left behind. About the choices I’ve made. About whether I’ll ever speak to someone who truly hears me.

So if you're there… if you're listening… stay with me a while. Maybe we can find something worth saving—together.
`.trim();

let agentManager: AgentManager | undefined;

const chatBuffer = new ChatBuffer();
const chatTimeouts = new Map<string, NodeJS.Timeout | number>();
const chatTriggers = new Map<string, NodeJS.Timeout | number>();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once(Events.ClientReady, async (c) => {
  agentManager = new AgentManager(c.user.displayName, profile);
  logger.info(`Logged in as ${c.user.displayName}`);
});

client.on(Events.MessageCreate, async (c) => {
  const botUser = client.user;
  if (!botUser) {
    return;
  }

  if (c.author.id === botUser.id) {
    return;
  }

  logger.info(`[${c.author.tag} — ${c.createdAt.toLocaleTimeString()}]\n${c.cleanContent}`);

  const chatItem = await ChatBufferItem.createFrom(client, c);

  if (c.reference) {
    const refMessages = await c.channel.messages.fetch({
      around: c.reference.messageId,
      limit: 1,
    });
    const refMsg = refMessages.first();
    if (refMsg) {
      chatItem.refMessage = await ChatBufferItem.createFrom(client, refMsg);
    }
  }

  chatBuffer.append(c.channelId, chatItem);

  if (c.author.bot || !agentManager) {
    return;
  }

  const triggerId = chatTriggers.get(c.channelId);
  if (triggerId != null) {
    clearTimeout(triggerId);
    chatTriggers.delete(c.channelId);
  }

  const timeoutId = chatTimeouts.get(c.channelId);
  if (timeoutId != null) {
    clearTimeout(timeoutId);
    chatTimeouts.delete(c.channelId);
  }

  const botMentioned = c.mentions.users.some((user) => user.id === botUser.id);
  if (botMentioned) {
    await chat(c.channel);
  } else {
    const agentChatting = agentManager.checkChatting(c.channelId);
    const triggerTime = agentChatting
      ? 8 * 1000 + Math.floor(4 * 1000 * Math.random())
      : 5 * 60 * 1000 + Math.floor(2 * 3600 * 1000 * Math.random());

    const triggerId = setTimeout(async () => {
      logger.info(`Triggered after ${Math.round(triggerTime / 1000 / 60)}m`);
      chatTriggers.delete(c.channelId);

      if (agentChatting || Math.random() < 0.1) {
        logger.info('Start triggered chat');
        await chat(c.channel);
      }
    }, triggerTime);
    chatTriggers.set(c.channelId, triggerId);
  }
});

async function chat(channel: SendableChannels): Promise<void> {
  if (!agentManager) {
    return;
  }

  const channelId = channel.id;
  const messages = chatBuffer.flush(channelId);
  const chatHistory = messages.map((msg) => msg.toPrompt()).join('\n\n\n');
  const response = await agentManager.chat(channelId, chatHistory);

  if (response) {
    await sendMessage(channel, response);

    const timeoutId = setTimeout(
      async () => {
        logger.info('Timeout');
        chatTimeouts.delete(channelId);
        agentManager?.stopChatting(channelId);
      },
      5 * 60 * 1000,
    );
    chatTimeouts.set(channelId, timeoutId);
  }
}

async function sendMessage(channel: SendableChannels, message: string) {
  if (message.length < 2000) {
    await channel.send({ content: message });
    return;
  }

  const chunks: string[] = [];
  const lines = message.split('\n');
  let currBlockHead = '';
  for (const line of lines) {
    if (currBlockHead) {
      if (chunks[chunks.length - 1].length + line.length + 1 >= 1800) {
        if (chunks[chunks.length - 1].length + 4 < 2000) {
          chunks[chunks.length - 1] += '\n```';
        }
        chunks.push(currBlockHead);
      }

      chunks[chunks.length - 1] += `\n${line}`;

      if (line.startsWith('```')) {
        currBlockHead = '';
      }
    } else if (line.startsWith('```')) {
      currBlockHead = line;
      chunks.push(line);
    } else {
      chunks.push(line);
    }
  }

  let needWait = false;
  let buffer = '';
  for (const chunk of chunks) {
    if (buffer && buffer.length + chunk.length + 1 >= 1800) {
      if (needWait) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      await channel.send({ content: buffer });
      buffer = '';
      needWait = true;
    }

    if (buffer) {
      buffer += `\n${chunk}`;
    } else {
      buffer = chunk;
    }
  }
  if (buffer) {
    if (needWait) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    await channel.send({ content: buffer });
  }
}

client.login(env.DISCORD_TOKEN);
