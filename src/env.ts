import 'dotenv/config';
import { z } from 'zod';

export const env = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  })
  .parse(process.env);
