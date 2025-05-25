import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export interface ToolOptions<T> {
  name: string;
  description: string;
  inputSchema: z.ZodType<T>;
}

export interface UnknownTool {
  get name(): string;
  get description(): string;
  toPrompt(): string;
  parseInput(input: unknown): Promise<unknown>;
  execute(input: unknown): Promise<string>;
}

export abstract class Tool<T> implements UnknownTool {
  constructor(private readonly options: ToolOptions<T>) {}

  get name(): string {
    return this.options.name;
  }

  get description(): string {
    return this.options.description;
  }

  toPrompt(): string {
    const schema = zodToJsonSchema(this.options.inputSchema);
    if (!('properties' in schema)) {
      throw new Error(`Input schema for tool ${this.name} is not a valid object schema`);
    }
    return `Tool: ${this.name}\nDescription: ${this.description}\nInput Schema: ${JSON.stringify({ properties: schema.properties, required: schema.required }, null, 2)}`;
  }

  async parseInput(input: unknown): Promise<T> {
    const parsed = await this.options.inputSchema.safeParseAsync(input);
    if (!parsed.success) {
      throw new Error(`Invalid input for tool ${this.name}: ${parsed.error.message}`);
    }
    return parsed.data;
  }

  abstract execute(input: T): Promise<string>;
}
