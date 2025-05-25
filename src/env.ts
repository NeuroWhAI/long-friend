import 'dotenv/config';
import { z } from 'zod';

export const env = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    CHAT_MODEL: z.string(),
    EMBEDDING_MODEL: z.string(),
    OPENAI_API_KEY: z.string(),

    POSTGRES_HOST: z.string(),
    POSTGRES_PORT: z.coerce.number(),
    POSTGRES_USER: z.string(),
    POSTGRES_PASSWORD: z.string(),
    POSTGRES_DB: z.string(),

    DISCORD_CLIENT_ID: z.string(),
    DISCORD_TOKEN: z.string(),
    DISCORD_CHANNEL_LIST: z.string(),

    WEATHER_BIT_API_KEY: z.string(),
  })
  .parse(process.env);
