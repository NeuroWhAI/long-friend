import 'dotenv/config';
import { z } from 'zod';

export const env = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    USER_NAME: z.string(),
    AI_NAME: z.string(),
    AI_LANGUAGE: z.string(),

    CHAT_MODEL: z.string(),
    OPENAI_API_KEY: z.string(),

    POSTGRES_HOST: z.string(),
    POSTGRES_PORT: z.coerce.number(),
    POSTGRES_USER: z.string(),
    POSTGRES_PASSWORD: z.string(),
    POSTGRES_DB: z.string(),

    TEI_EMBED_API_URL: z.string().url(),
  })
  .parse(process.env);
