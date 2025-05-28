import { env } from '@/env';
import { z } from 'zod';
import { Tool } from './tool';

export interface SearchToolInput {
  query_or_url: string;
}

export class SearchTool extends Tool<SearchToolInput> {
  constructor() {
    super({
      name: 'web_search',
      description: 'Search the Internet to get information.',
      inputSchema: z.object({
        query_or_url: z.string().describe('A search query or a URL to retrieve information from.'),
      }),
    });
  }

  async execute(input: SearchToolInput): Promise<string> {
    const { query_or_url: queryOrUrl } = input;

    if (queryOrUrl.startsWith('http://') || queryOrUrl.startsWith('https://')) {
      return await this.getUrlContent(queryOrUrl);
    } else {
      return await this.searchQuery(queryOrUrl, false, true);
    }
  }

  private async searchQuery(query: string, includeDetails: boolean, includeImages: boolean): Promise<string> {
    const requestPayload: SearchRequest = {
      api_key: env.TAVILY_API_KEY,
      query,
      search_depth: 'advanced',
      include_answer: true,
    };
    if (includeDetails) {
      requestPayload.max_results = 1;
      requestPayload.include_raw_content = true;
    } else {
      requestPayload.max_results = 8;
    }
    if (includeImages) {
      requestPayload.include_images = true;
    }

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });
    if (!res.ok) {
      return `HTTP error! Status: ${res.status}`;
    }
    const data: SearchResponse = await res.json();
    if (!data.results?.length) {
      return 'No results found';
    }

    if (includeDetails) {
      const result = data.results[0];
      const imagesStr = data.images?.length ? `\nImages:\n${data.images.map((url) => `- ${url}`).join('\n')}` : '';
      return `Query: ${data.query}
Summary: ${data.answer}
Title: ${result.title}
URL: ${result.url}${imagesStr}${`\nContent:\n${result.raw_content}`.trimEnd()}`;
    } else {
      return JSON.stringify(
        {
          query: data.query,
          summary: data.answer,
          results: data.results.map((result) => ({
            title: result.title,
            url: result.url,
            content: result.content,
          })),
          images: data.images,
        },
        null,
        1,
      );
    }
  }

  private async getUrlContent(url: string): Promise<string> {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${env.JINA_API_KEY}`,
        'X-Timeout': '10',
        'X-Locale': 'ko-KR',
        'X-With-Generated-Alt': 'true',
      },
    });
    if (!res.ok) {
      return `HTTP error! Status: ${res.status}`;
    }

    return await res.text();
  }
}

interface SearchRequest {
  api_key: string;
  query: string;
  search_depth?: string;
  include_images?: boolean;
  include_answer?: boolean;
  include_raw_content?: boolean;
  max_results?: number;
  include_domains?: string[];
  exclude_domains?: string[];
}

interface SearchResponse {
  answer: string;
  query: string;
  response_time: string;
  follow_up_questions: string[];
  images: string[];
  results: {
    title: string;
    url: string;
    content: string;
    raw_content: string;
    score: string;
  }[];
}
