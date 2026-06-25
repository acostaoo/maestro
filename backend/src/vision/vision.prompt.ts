import { UnprocessableEntityException } from '@nestjs/common';
import type { Team, TeamMember } from '../team/team.types';

/**
 * Shared prompt + JSON parsing for every vision provider. The provider services
 * (Gemini, OpenAI-compatible, …) differ only in how they call their API; the
 * instructions we give the model and the way we sanitize its JSON are identical,
 * so they live here.
 */

/** The instruction sent to every vision model. */
export const VISION_PROMPT = [
  'You are reading a screenshot from the video game Pokémon Champions (a VGC',
  'Doubles, Level 50 competitive game). The image is a team-preview / rental',
  'list showing up to 6 Pokémon.',
  '',
  'Extract every Pokémon you can see and return ONLY JSON matching this shape:',
  '{ "name"?: string, "members": [ { "species": string, "item"?: string,',
  '  "ability"?: string, "teraType"?: string, "nature"?: string,',
  '  "moves"?: string[] } ] }',
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
  '- Output raw JSON only — no markdown fences, no commentary.',
].join('\n');

/**
 * Gemini-style response schema (used only by the Gemini provider, which accepts
 * a structured-output schema). Other providers rely on the prompt above.
 */
export const VISION_RESPONSE_SCHEMA = {
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

/**
 * Parse a model's JSON text into a sanitized Team. Tolerates a stray ```json
 * fence that some models add despite instructions.
 */
export function parseTeamFromJson(text: string): Team {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(text));
  } catch {
    throw new UnprocessableEntityException(
      'The vision model returned malformed data.',
    );
  }

  const root = parsed as { name?: unknown; members?: unknown };
  const rawMembers = Array.isArray(root.members) ? root.members : [];
  const members: TeamMember[] = [];
  for (const raw of rawMembers) {
    const member = toMember(raw);
    if (member) {
      members.push(member);
    }
  }

  const name = typeof root.name === 'string' ? root.name : undefined;
  return { name, members };
}

/** Remove a surrounding ```json … ``` fence if the model added one. */
function stripFence(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fence ? fence[1] : trimmed;
}

function toMember(raw: unknown): TeamMember | undefined {
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
