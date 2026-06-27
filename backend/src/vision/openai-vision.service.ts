import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { FormatService } from '../format/format.service';
import type { Team } from '../team/team.types';
import type { VisionImage, VisionTeamExtractor } from './vision.interface';
import { VISION_PROMPT, parseTeamFromJson } from './vision.prompt';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';

/**
 * Reads a team-preview screenshot through any OpenAI-compatible Chat Completions
 * API and returns a structured team. This one service covers several providers,
 * selected purely by environment variables:
 *
 * - OpenAI cloud: set OPENAI_API_KEY (and optionally OPENAI_VISION_MODEL).
 * - Ollama (local, free, offline): run `ollama serve`, pull a vision model
 *   (e.g. `ollama pull llava`), then set OPENAI_BASE_URL=http://localhost:11434/v1,
 *   OPENAI_VISION_MODEL=llava and OPENAI_API_KEY=ollama (any non-empty value).
 * - LM Studio / OpenRouter / others: set OPENAI_BASE_URL to their /v1 endpoint.
 */
@Injectable()
export class OpenAiVisionService implements VisionTeamExtractor {
  private readonly logger = new Logger(OpenAiVisionService.name);

  constructor(private readonly format: FormatService) {}

  async extractTeam(images: VisionImage[]): Promise<Team> {
    const baseUrl = (process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(
      /\/+$/,
      '',
    );
    const apiKey = process.env.OPENAI_API_KEY;
    // Cloud OpenAI requires a key; local servers (Ollama/LM Studio) usually
    // ignore it but the SDK-style endpoints still expect a Bearer header.
    if (!apiKey && baseUrl === DEFAULT_BASE_URL) {
      throw new ServiceUnavailableException(
        'Vision is not configured. Set OPENAI_API_KEY in backend/.env to read screenshots.',
      );
    }

    const legalList = this.format.getRegulation().legal.join(', ');
    const systemPrompt = `${VISION_PROMPT}\n\nLEGAL SPECIES LIST (Only choose from these): ${legalList}`;

    const model = process.env.OPENAI_VISION_MODEL || DEFAULT_MODEL;
    const url = `${baseUrl}/chat/completions`;
    const body = {
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: systemPrompt },
            ...images.map((image) => ({
              type: 'image_url',
              image_url: {
                url: `data:${image.mimeType};base64,${image.base64}`,
              },
            })),
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey || 'not-needed'}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new ServiceUnavailableException(
        `Could not reach the vision API at ${baseUrl}: ${(err as Error).message}`,
      );
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.warn(`OpenAI ${response.status}: ${detail.slice(0, 300)}`);
      throw new ServiceUnavailableException(
        `Vision API returned ${response.status}. Check OPENAI_BASE_URL, the API key and the model.`,
      );
    }

    const payload = (await response.json()) as OpenAiResponse;
    const text = payload.choices?.[0]?.message?.content;
    if (!text) {
      throw new UnprocessableEntityException(
        'The vision model returned no readable team.',
      );
    }

    return parseTeamFromJson(text);
  }
}

interface OpenAiResponse {
  choices?: Array<{ message?: { content?: string } }>;
}
