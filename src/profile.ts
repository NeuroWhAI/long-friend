import fs from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

const schemaFriend = z.object({
  name: z.string(),
  language: z.string(),
  profile: z.string(),
});

const schemaProfile = z.object({
  friends: z.array(schemaFriend),
});

export async function getFriend(name: string): Promise<z.infer<typeof schemaFriend>> {
  const file = await fs.readFile('./profile.yml', 'utf8');
  const yaml = parseYaml(file);
  const profile = await schemaProfile.parseAsync(yaml);
  const friend = profile.friends.find((f) => f.name === name);
  if (friend) {
    return friend;
  }
  throw new Error(`${name} not found`);
}
