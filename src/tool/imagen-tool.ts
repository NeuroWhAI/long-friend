import { env } from '@/env';
import OpenAI from 'openai';
import { z } from 'zod';
import { Tool } from './tool';

export interface ImagenToolInput {
  prompt: string;
}

export class ImagenTool extends Tool<ImagenToolInput> {
  constructor() {
    super({
      name: 'generate_image',
      description: 'Generate an image based on a text prompt.',
      inputSchema: z.object({
        prompt: z.string().describe('An English prompt to generate an image from.'),
      }),
    });

    this.openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  private readonly openai: OpenAI;

  async execute(input: ImagenToolInput): Promise<string> {
    const { prompt } = input;

    const res = await this.openai.images.generate({
      model: 'gpt-image-1',
      prompt,
    });

    if (!res || !res.data || res.data.length === 0 || !res.data[0].b64_json) {
      return 'Failed to generate image.';
    }

    const image = res.data[0].b64_json;
    return `data:image/png;base64,${image}`;
  }
}
