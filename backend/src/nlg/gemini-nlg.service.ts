import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ParsedQuestion } from '../nlu/nlu.interface';
import type { ScenarioResult } from '../scenario/scenario.types';
import type { NarratedAnswer, Nlg } from './nlg.interface';
import { NLG_PROMPT, NLG_RESPONSE_SCHEMA } from './nlg.prompt';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

@Injectable()
export class GeminiNlgService implements Nlg {
  private readonly logger = new Logger(GeminiNlgService.name);

  async narrate(
    question: ParsedQuestion,
    scenario: ScenarioResult,
    baseline?: ScenarioResult,
  ): Promise<NarratedAnswer> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException('GEMINI_API_KEY is not set');
    }

    const model = process.env.GEMINI_NLG_MODEL;
    const url = `${API_BASE}/${model}:generateContent?key=${apiKey}`;

    const promptContext = {
      question: question.raw,
      parsed: question,
      scenario: {
        defender: scenario.defender,
        attacker: scenario.attacker,
        move: scenario.move,
        summary: scenario.summary,
        outcomes: scenario.outcomes.map((o) => ({
          set: o.attackerSet,
          percent: o.result.maxPercent,
          desc: o.result.description,
        })),
      },
      baseline: baseline
        ? {
          summary: baseline.summary,
        }
        : null,
    };

    const body = {
      contents: [
        {
          parts: [
            { text: `${NLG_PROMPT}\n\nContext:\n${JSON.stringify(promptContext, null, 2)}` },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: NLG_RESPONSE_SCHEMA,
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

      // We keep the rules-based details as backup/supporting info
      const rulesDetails = scenario.outcomes.map((o) =>
        `${o.attackerSet}: ${o.result.description}`
      );

      return {
        answer: parsed.answer,
        details: rulesDetails,
      };
    } catch (err) {
      if (err instanceof Error) {
        this.logger.error(`NLG Error: ${err.message}`, err.stack);
      } else {
        this.logger.error(`NLG Error: ${err}`);
      }
      return {
        answer: 'I calculated the results but had trouble narrating them. Please check the details below.',
        details: scenario.outcomes.map((o) => `${o.attackerSet}: ${o.result.description}`),
      };
    }
  }
}
