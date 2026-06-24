import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Team, TeamMember } from '../team/team.types';
import type { VisionImage, VisionTeamExtractor } from './vision.interface';

const DEFAULT_MODEL = 'gemini-2.0-flash';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** What we ask Gemini to return — only what a team-preview screen can show. */
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    members: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          species: { type: 'STRING' },
          item: { type: 'STRING' },
          ability: { type: 'STRING' },
          teraType: { type: 'STRING' },
          nature: { type: 'STRING' },
          moves: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['species'],
      },
    },
  },
  required: ['members'],
};

const PROMPT = [
  'You are reading a screenshot from the video game Pokémon Champions (a VGC',
  'Doubles, Level 50 competitive game). The image is a team-preview / rental',
  'list showing up to 6 Pokémon.',
  '',
  'Extract every Pokémon you can see and return ONLY JSON matching the schema.',
  'Rules:',
  '- Use official English species names in Pokémon Showdown form, e.g.',
  '  "Goodra-Hisui", "Ogerpon-Wellspring", "Urshifu-Rapid-Strike". For a',
  '  regional form, append the suffix (-Hisui, -Alola, -Galar, -Paldea).',
  '- "item" is the held item name if a held-item icon/label is visible, else omit.',
  '- "teraType" is the Tera type if shown, else omit.',
  '- "moves" are the official English move names if any are visible, else omit.',
  '- Omit "ability" and "nature" unless clearly shown (they usually are not on a',
  '  team-preview screen). Never guess EVs/IVs — they are not visible here.',
  '- If a field is uncertain, omit it rather than guessing.',
].join('\n');

/**
 * Reads a team-preview screenshot with Google's Gemini vision API and returns a
 * structured team. Requires GEMINI_API_KEY in the environment (load it from a
 * local .env). The model is configurable via GEMINI_VISION_MODEL.
 */
@Injectable()
export class GeminiVisionService implements VisionTeamExtractor {
  private readonly logger = new Logger(GeminiVisionService.name);

  async extractTeam(image: VisionImage): Promise<Team> {
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
            { text: PROMPT },
            { inline_data: { mime_type: image.mimeType, data: image.base64 } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
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

    return this.toTeam(text);
  }

  /** Parse the model's JSON text into a sanitized Team. */
  private toTeam(text: string): Team {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new UnprocessableEntityException(
        'The vision model returned malformed data.',
      );
    }

    const root = parsed as { name?: unknown; members?: unknown };
    const rawMembers = Array.isArray(root.members) ? root.members : [];
    const members: TeamMember[] = [];
    for (const raw of rawMembers) {
      const member = this.toMember(raw);
      if (member) {
        members.push(member);
      }
    }

    const name = typeof root.name === 'string' ? root.name : undefined;
    return { name, members };
  }

  private toMember(raw: unknown): TeamMember | undefined {
    if (!raw || typeof raw !== 'object') {
      return undefined;
    }
    const r = raw as Record<string, unknown>;
    const species = typeof r.species === 'string' ? r.species.trim() : '';
    if (!species) {
      return undefined;
    }

    const member: TeamMember = { species };
    if (typeof r.item === 'string' && r.item.trim()) {
      member.item = r.item.trim();
    }
    if (typeof r.ability === 'string' && r.ability.trim()) {
      member.ability = r.ability.trim();
    }
    if (typeof r.teraType === 'string' && r.teraType.trim()) {
      member.teraType = r.teraType.trim();
    }
    if (typeof r.nature === 'string' && r.nature.trim()) {
      member.nature = r.nature.trim();
    }
    if (Array.isArray(r.moves)) {
      const moves = r.moves
        .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
        .map((m) => m.trim());
      if (moves.length > 0) {
        member.moves = moves;
      }
    }
    return member;
  }
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}
