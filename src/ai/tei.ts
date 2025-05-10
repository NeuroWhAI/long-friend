import { env } from '@/env';
import { z } from 'zod';

export class TeiClient {
  async embed(text: string): Promise<number[]> {
    const res = await fetch(env.TEI_EMBED_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text }),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json);
    }

    const embedding = await embedResSchema.parseAsync(json);

    return embedding[0];
  }
}

const embedResSchema = z.array(z.array(z.number()).min(1)).min(1);
