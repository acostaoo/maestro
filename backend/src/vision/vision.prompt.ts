import { UnprocessableEntityException } from '@nestjs/common';
import { toID } from '@smogon/calc';
import type { Team, TeamMember } from '../team/team.types';

/**
 * Shared prompt + JSON parsing for every vision provider. The provider services
 * (Gemini, OpenAI-compatible, …) differ only in how they call their API; the
 * instructions we give the model and the way we sanitize its JSON are identical,
 * so they live here.
 */

/** The instruction sent to every vision model. */
export const VISION_PROMPT = [
  'You are a professional Pokémon VGC data extractor for "Pokémon Champions" (Level 50, Gen 9 Regulation M-B).',
  'You will receive TWO screenshots of the same team, as of now in latin american spanish that will be required to be translated to english. Your task is to merge them into a perfect JSON team representation.',
  '',
  '1. IDENTIFICATION (CRITICAL):',
  '   - IGNORE NICKNAMES. Pokémon in this app often have custom nicknames.',
  '   - Identify the official SPECIES by looking at the 3D sprite, their types, and their moves.',
  '   - For regional forms, you MUST use the suffix: "Goodra-Hisui", "Ursaluna-Bloodmoon", "Ogerpon-Wellspring", "Urshifu-Rapid-Strike", etc.',
  '   - If a Pokémon is holding a Mega Stone, append "-Mega" (e.g., "Venusaur-Mega").',
  '',
  '2. SLIDE 1: STATS & EVS ("Características" in Spanish):',
  '   - This slide shows a grid of stat tables.',
  '   - PS = HP, Ataque = Atk, Defensa = Def, At. Esp. = SpA, Def. Esp. = SpD, Velocidad = Spe.',
  '   - Each row has two numbers. The SMALLER, second number is the EV (0-252). Read this into the "evs" field.',
  '   - NATURE: Look for colored arrows on stat names. Red up-arrow = +10%, Blue down-arrow = -10%. Map the pair to the Nature name (e.g., +Atk/-SpA = Adamant).',
  '',
  '3. SLIDE 2: DETAILS (Moves, Item, Ability):',
  '   - Read the held Item, Ability, and the 4 Moves.',
  '   - Use official English names for everything.',
  '',
  '4. MERGING:',
  '   - Merge data from both slides for the same Pokémon based on their position or 3D model.',
  '',
  'Output ONLY raw JSON matching this schema:',
  '{ "members": [ { "species": string, "item"?: string, "ability": string, "nature"?: string, "moves"?: string[], "evs"?: { "hp"?: number, "atk"?: number, "def"?: number, "spa"?: number, "spd"?: number, "spe"?: number } } ] }',
  'No markdown fences, no commentary, no nicknames.',
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
      // Fix common vision artifacts or missing forms
      if (member.species === 'Goodra' && member.moves?.includes('Shelter')) {
        member.species = 'Goodra-Hisui';
      }
      if (member.species === 'Ursaluna' && member.moves?.includes('Blood Moon')) {
        member.species = 'Ursaluna-Bloodmoon';
      }
      
      // If the model gave us a nickname or a slight typo, healing logic here
      // can cross-reference the moves/ability to verify the species.
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
