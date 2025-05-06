import 'dotenv/config';
import { z } from 'zod';

export const env = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    USER_NAME: z.string(),
    AI_NAME: z.string(),

    CHAT_MODEL: z.string(),
    OPENAI_API_KEY: z.string(),
  })
  .parse(process.env);
