import { logger } from '@/logger';
import type { Client, Message } from 'discord.js';
import ogs from 'open-graph-scraper';

export class ChatBufferItem {
  constructor({
    authorId,
    author,
    content,
    date,
    imageUrls,
    fileUrls,
  }: {
    authorId: string;
    author: string;
    content: string;
    date: Date;
    imageUrls: string[];
    fileUrls: string[];
  }) {
    this.authorId = authorId;
    this.author = author;
    this.content = content;
    this.date = date;
    this.imageUrls = imageUrls;
    this.fileUrls = fileUrls;
  }

  authorId: string;
  author: string;
  content: string;
  date: Date;
  imageUrls: string[];
  fileUrls: string[];

  refMessage: ChatBufferItem | null = null;

  toPrompt(): string {
    let prompt = `${this.author} — ${localeDate(this.date)}\n${this.content}`;
    if (this.imageUrls.length > 0) {
      prompt +=
        this.imageUrls.length === 1 ? '\n\n*(1 image attached)*' : `\n\n*(${this.imageUrls.length} images attached)*`;
    }

    if (this.refMessage) {
      const ref = this.refMessage;

      let refPrompt = `${ref.author} — past\n${ref.content}`;
      if (ref.imageUrls.length > 0) {
        refPrompt +=
          ref.imageUrls.length === 1 ? '\n\n*(1 image attached)*' : `\n\n*(${ref.imageUrls.length} images attached)*`;
      }

      prompt = `${refPrompt}\n\n*Referred to by the following message:*\n${prompt}`;
    }
    return prompt;
  }

  static async createFrom(client: Client, msg: Message): Promise<ChatBufferItem> {
    const maxImageSize = 20 * 1024 * 1024 - 100;

    const emojiUrls: Set<string> = new Set();
    const emojiMatches = msg.content.matchAll(/<a?:\w+:(\d+)>/g);
    for (const match of emojiMatches) {
      const emojiId = match[1];
      const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.webp`;
      emojiUrls.add(emojiUrl);
      if (emojiUrls.size >= 3) {
        break;
      }
    }

    const imageTypes = /\.(png|jpeg|jpg|gif|webp)$/g;
    const fileTypes = /\.(txt|md|csv|json|xml)$/g;

    const imageUrls = msg.attachments
      .map((attachment) => attachment.url)
      .filter((url) => imageTypes.test(new URL(url).pathname))
      .slice(0, 4);

    const stickerUrls = msg.stickers
      .map((s) => s.url)
      .filter((url) => imageTypes.test(new URL(url).pathname))
      .slice(0, 1);

    const fileUrls = msg.attachments
      .map((attachment) => attachment.url)
      .filter((url) => fileTypes.test(new URL(url).pathname));

    const httpImageUrls: string[] = [];
    let msgContent = msg.cleanContent;

    const httpUrls = msg.content.matchAll(/\bhttps?:\/\/\S+/g);
    for (const [url] of httpUrls) {
      const pathname = new URL(url).pathname;
      if (imageTypes.test(pathname)) {
        if (httpImageUrls.length < 2) {
          httpImageUrls.push(url);
        }
      } else if (url.startsWith('https://discord.com/channels/')) {
        const match = url.match(/^https:\/\/discord.com\/channels\/(\d+)\/(\d+)\/(\d+)/);
        if (match) {
          const [_, guildId, channelId, messageId] = match;
          const guild = client.guilds.cache.get(guildId);
          const channel = guild?.channels.cache.get(channelId);
          if (channel?.isTextBased()) {
            try {
              const linkMsg = await channel.messages.fetch(messageId);

              const author = linkMsg.member ? linkMsg.member.displayName : linkMsg.author.displayName;

              const linkText = `${author} — past\n${linkMsg.cleanContent}`;
              msgContent = `${linkText}\n--- Referred to by the following message ---\n${msgContent}`;

              if (imageUrls.length === 0) {
                const linkImgs = linkMsg.attachments
                  .map((attachment) => attachment.url)
                  .filter((url) => imageTypes.test(new URL(url).pathname))
                  .slice(0, 4);
                imageUrls.push(...linkImgs);
              }
            } catch (err) {
              logger.error(err, `Failed to get link message from ${url}`);
            }
          }
        }
      } else {
        try {
          const headRes = await fetch(url, { method: 'HEAD' });
          const contentType = headRes.headers.get('content-type');
          if (!contentType || !contentType.includes('text/html')) {
            continue;
          }

          const ogRes = await ogs({ url });
          if (ogRes.result.success) {
            const og = ogRes.result;
            let ogContent = `(URL Metadata) [${og.ogTitle}]`;
            if (og.ogDescription) {
              ogContent += ` ${og.ogDescription}`;
            }

            if (og.ogImage) {
              const ogImage = og.ogImage ? og.ogImage[0].url : null;
              if (ogImage && imageTypes.test(new URL(ogImage).pathname)) {
                httpImageUrls.push(ogImage);
              }
            }

            if (msgContent) {
              msgContent += `\n\n${ogContent}`;
            } else {
              msgContent = ogContent;
            }
          }
        } catch (err) {
          logger.error(err, `Failed to get og tags from ${url}`);
        }
      }
    }

    let bigImageRemoved = false;
    const sizeCheckTargets = [imageUrls, httpImageUrls];
    for (const urls of sizeCheckTargets) {
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        let imgSize = 0;

        try {
          const headRes = await fetch(url, { method: 'HEAD' });
          imgSize = Number.parseInt(headRes.headers.get('content-length') ?? '0');
          if (imgSize < maxImageSize) {
            continue;
          }
        } catch (err) {
          logger.error(err, `Failed to fetch image ${url}`);
        }

        urls.splice(i, 1);
        i -= 1;

        bigImageRemoved = true;
      }
    }

    if (bigImageRemoved) {
      if (msgContent) {
        msgContent += '\n\n' + '(image too large)';
      } else {
        msgContent = '(image too large)';
      }
    }

    return new ChatBufferItem({
      authorId: msg.author.tag,
      author: msg.member ? msg.member.displayName : msg.author.displayName,
      content: msgContent,
      date: msg.createdAt,
      imageUrls: [...emojiUrls, ...imageUrls, ...stickerUrls, ...httpImageUrls],
      fileUrls,
    });
  }
}

function localeDate(date: Date) {
  return date.toLocaleString(undefined, {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  });
}
