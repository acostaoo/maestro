import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Nlu, ParsedQuestion } from './nlu.interface';
import { NLU_PROMPT, NLU_RESPONSE_SCHEMA } from './nlu.prompt';

const DEFAULT_MODEL = 'gemini-1.5-flash';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

@Injectable()
export class GeminiNluService implements Nlu {
  private readonly logger = new Logger(GeminiNluService.name);

  async parse(text: string): Promise<ParsedQuestion> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException('GEMINI_API_KEY is not set');
    }

    const model = process.env.GEMINI_NLU_MODEL;
    const url = `${API_BASE}/${model}:generateContent?key=${apiKey}`;

    const body = {
      contents: [
        {
          parts: [{ text: `${NLU_PROMPT}\n\nQuestion: "${text}"` }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: NLU_RESPONSE_SCHEMA,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Gemini API returned ${response.status}`);
      }

      const payload = await response.json();
      const resultText = payload.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!resultText) {
        throw new Error('Empty response from Gemini');
      }

      const parsed = JSON.parse(resultText);
      return {
        ...parsed,
        raw: text,
      };
    } catch (err) {
      if(err instanceof Error) {
      this.logger.error(`NLU Gemini Error: ${err.message}`);
      }else {
        this.logger.error(`NLU Gemini Error: ${String(err)}`);
      }
      return {
        intent: 'unknown',
        raw: text,
        reason: 'Could not reach the NLU agent.',
      };
    }
  }
}
