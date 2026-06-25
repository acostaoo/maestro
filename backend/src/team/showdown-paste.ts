import type { StatSpread } from '../sets/sets.types';
import type { Team, TeamMember } from './team.types';

/**
 * Parses a Pokémon Showdown team export into our Team shape. Each member is a
 * block separated by a blank line, e.g.:
 *
 *   Nickname (Goodra-Hisui) (M) @ Assault Vest
 *   Ability: Sap Sipper
 *   Level: 50
 *   EVs: 252 HP / 4 Def / 252 SpD
 *   Calm Nature
 *   IVs: 0 Atk
 *   - Draco Meteor
 *   - Flamethrower
 *
 * Unknown lines are ignored; blocks without a species are skipped.
 */
export function parseShowdownTeam(paste: string, name?: string): Team {
  const blocks = paste
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const members: TeamMember[] = [];
  for (const block of blocks) {
    const member = parseBlock(block);
    if (member) {
      members.push(member);
    }
  }

  return { name, members };
}

function parseBlock(block: string): TeamMember | undefined {
  const lines = block
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return undefined;
  }

  const header = parseHeader(lines[0]);
  if (!header.species) {
    return undefined;
  }

  const member: TeamMember = { species: header.species };
  if (header.item) {
    member.item = header.item;
  }

  const moves: string[] = [];
  for (const line of lines.slice(1)) {
    if (line.startsWith('-')) {
      const move = line.replace(/^-\s*/, '').trim();
      if (move) {
        moves.push(move);
      }
      continue;
    }

    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();

    switch (key) {
      case 'ability':
        member.ability = value;
        break;
      case 'level':
        member.level = Number(value) || undefined;
        break;
      case 'evs':
        member.evs = parseStats(value);
        break;
      case 'ivs':
        member.ivs = parseStats(value);
        break;
      default:
        if (/\bNature$/i.test(line)) {
          member.nature = line.replace(/\s*Nature$/i, '').trim();
        }
    }
  }

  if (moves.length > 0) {
    member.moves = moves;
  }
  return member;
}

/** Parse "Nickname (Species) (M) @ Item" / "Species @ Item" / "Species". */
function parseHeader(line: string): { species: string; item?: string } {
  let rest = line;
  let item: string | undefined;

  const at = rest.indexOf('@');
  if (at !== -1) {
    item = rest.slice(at + 1).trim() || undefined;
    rest = rest.slice(0, at).trim();
  }

  // Strip a trailing gender marker: (M) / (F).
  rest = rest.replace(/\s*\((?:M|F)\)\s*$/i, '').trim();

  // "Nickname (Species)" → species is inside the parentheses.
  const named = rest.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  const species = (named ? named[2] : rest).trim();

  return { species, item };
}

const STAT_KEYS: Record<string, keyof StatSpread> = {
  hp: 'hp',
  atk: 'atk',
  def: 'def',
  spa: 'spa',
  spd: 'spd',
  spe: 'spe',
};

/** Parse "252 HP / 4 Def / 252 SpD" into a StatSpread. */
function parseStats(value: string): StatSpread | undefined {
  const spread: Partial<StatSpread> = {};
  let matched = false;
  for (const token of value.split('/')) {
    const m = token.trim().match(/^(\d+)\s+([a-zA-Z]+)$/);
    if (!m) {
      continue;
    }
    const key = STAT_KEYS[m[2].toLowerCase()];
    if (key) {
      spread[key] = Number(m[1]);
      matched = true;
    }
  }
  return matched ? (spread as StatSpread) : undefined;
}
