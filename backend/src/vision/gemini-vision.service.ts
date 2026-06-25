import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Team } from '../team/team.types';
import type { VisionImage, VisionTeamExtractor } from './vision.interface';
import {
  VISION_PROMPT,
  VISION_RESPONSE_SCHEMA,
  parseTeamFromJson,
} from './vision.prompt';

const DEFAULT_MODEL = 'gemini-2.0-flash';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Reads a team-preview screenshot with Google's Gemini vision API and returns a
 * structured team. Requires GEMINI_API_KEY in the environment (load it from a
 * local .env). The model is configurable via GEMINI_VISION_MODEL.
 */
@Injectable()
export class GeminiVisionService implements VisionTeamExtractor {
  private readonly logger = new Logger(GeminiVisionService.name);

  async extractTeam(images: VisionImage[]): Promise<Team> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Vision is not configured. Set GEMINI_API_KEY in backend/.env to read screenshots.',
      );
    }

    const model = process.env.GEMINI_VISION_MODEL || DEFAULT_MODEL;
    const url = `${API_BASE}/${model}:generateContent?key=${apiKey}`;
    const body = {
      contents: [
        {
          parts: [
            { text: VISION_PROMPT },
            ...images.map((image) => ({
              inline_data: { mime_type: image.mimeType, data: image.base64 },
            })),
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: VISION_RESPONSE_SCHEMA,
      },
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new ServiceUnavailableException(
        `Could not reach the vision API: ${(err as Error).message}`,
      );
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.warn(`Gemini ${response.status}: ${detail.slice(0, 300)}`);
      throw new ServiceUnavailableException(
        `Vision API returned ${response.status}. Check the API key and model.`,
      );
    }

    const payload = (await response.json()) as GeminiResponse;
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new UnprocessableEntityException(
        'The vision model returned no readable team.',
      );
    }

    return parseTeamFromJson(text);
  }
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}
