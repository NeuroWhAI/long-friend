export interface ToolCall {
  function: string;
  inputs: Record<string, string>;
}

export class ToolParser {
  private readonly deviceRegex = /\[Device:\s*(\w+)\(((?:[^()"\\]|"(?:\\.|[^"\\])*")*)\)\]/g;
  private readonly paramRegex = /(\w+)="((?:\\.|[^"\\])*)"/g;

  parseAll(text: string): ToolCall[] {
    const results: ToolCall[] = [];
    const globalRegex = new RegExp(this.deviceRegex.source, this.deviceRegex.flags);
    let match = globalRegex.exec(text);

    while (match !== null) {
      const functionName = match[1];
      const paramsString = match[2];
      const inputs = this.parseParameters(paramsString);

      results.push({
        function: functionName,
        inputs: inputs,
      });

      match = globalRegex.exec(text);
    }

    return results;
  }

  private parseParameters(paramsString: string): Record<string, string> {
    const inputs: Record<string, string> = {};

    if (!paramsString.trim()) {
      return inputs;
    }

    const paramRegex = new RegExp(this.paramRegex.source, this.paramRegex.flags);
    let paramMatch = paramRegex.exec(paramsString);

    while (paramMatch !== null) {
      const key = paramMatch[1];
      const value = paramMatch[2];
      inputs[key] = value;
      paramMatch = paramRegex.exec(paramsString);
    }

    return inputs;
  }
}
