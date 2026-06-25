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
  'You are reading screenshots from a Pokémon game (VGC Doubles, Level 50',
  'competitive, Regulation M-B). This format uses MEGA EVOLUTION.',
  '',
  'You may receive ONE or TWO screenshots of the SAME team. The team preview is',
  'split across two slides; merge them BY SPECIES into a single team:',
  '  • SPREADS slide: a stats / summary screen ("Características" in Spanish)',
  '    showing the team as a grid of stat tables with EVs and natures.',
  '  • DETAILS slide: shows each Pokémon\'s held item, ability and moves (and any',
  '    other text details).',
  'A plain team-preview / rental list (just up to 6 icons) may also appear; take',
  'only the species names from it.',
  '',
  'On the SPREADS slide:',
  '  - Stat rows are labelled in Spanish: PS=hp, Ataque=atk, Defensa=def,',
  '    "At. Esp."=spa, "Def. Esp."=spd, Velocidad=spe.',
  '  - Each stat row shows TWO numbers: the large left number is the final',
  '    in-game stat (ignore it), and the smaller second number is the trained',
  '    EV for that stat — read that into "evs". EVs range 0–252 per stat.',
  '  - A red up-arrow on a stat name = nature-boosted stat; a blue down-arrow',
  '    = nature-lowered stat. Use that pair to name the "nature" (e.g.',
  '    +atk/-spa = Adamant, +spa/-atk = Modest, +def/-atk = Bold,',
  '    +spd/-spa = Careful, +spe/-spa = Timid). Omit "nature" if no arrows.',
  '  - The icons next to each name are the gender symbol and the Pokémon\'s',
  '    TYPES — they are not a stat or a field to record. Ignore them entirely.',
  '',
  'On the DETAILS slide:',
  '  - Read each Pokémon\'s held "item", "ability" and "moves".',
  '',
  'When you have both slides, combine the spread from one and the',
  'item/ability/moves from the other for the SAME species into one member.',
  '',
  'Extract every Pokémon you can see and return ONLY JSON matching this shape:',
  '{ "name"?: string, "members": [ { "species": string, "item"?: string,',
  '  "ability"?: string, "nature"?: string, "moves"?: string[],',
  '  "evs"?: { "hp"?: number, "atk"?: number, "def"?: number, "spa"?: number,',
  '  "spd"?: number, "spe"?: number } } ] }',
  'Rules:',
  '- Use official English species names in Pokémon Showdown form, e.g.',
  '  "Goodra-Hisui", "Ogerpon-Wellspring", "Urshifu-Rapid-Strike". For a',
  '  regional form, append the suffix (-Hisui, -Alola, -Galar, -Paldea). Note',
  '  Hisuian Goodra is Steel/Dragon, so a Goodra showing a Steel type is',
  '  "Goodra-Hisui".',
  '- Mega Evolutions exist in this format: if a Pokémon is shown Mega-Evolved or',
  '  holding a Mega Stone, append "-Mega" (or "-Mega-X"/"-Mega-Y" for Charizard',
  '  and Mewtwo), e.g. "Venusaur-Mega", "Charizard-Mega-Y".',
  '- "item" is the held item name if a held-item icon/label is visible, else omit.',
  '- "moves" are the official English move names if any are visible, else omit.',
  '- "evs" only from the spreads slide; omit when EVs are not visible (e.g. a',
  '  plain team-preview or the details slide). Never invent EVs/IVs.',
  '- Omit "ability" and "nature" unless clearly shown.',
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
          nature: { type: 'STRING' },
          moves: { type: 'ARRAY', items: { type: 'STRING' } },
          evs: {
            type: 'OBJECT',
            properties: {
              hp: { type: 'INTEGER' },
              atk: { type: 'INTEGER' },
              def: { type: 'INTEGER' },
              spa: { type: 'INTEGER' },
              spd: { type: 'INTEGER' },
              spe: { type: 'INTEGER' },
            },
          },
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
  const evs = toStatSpread(r.evs);
  if (evs) {
    member.evs = evs;
  }
  return member;
}

/** Read a stat spread, keeping only valid EV numbers (0–252). */
function toStatSpread(raw: unknown): TeamMember['evs'] | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const r = raw as Record<string, unknown>;
  const keys = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
  const spread: Record<string, number> = {};
  for (const key of keys) {
    const value = r[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      spread[key] = Math.max(0, Math.min(252, Math.round(value)));
    }
  }
  return Object.keys(spread).length > 0 ? spread : undefined;
}
