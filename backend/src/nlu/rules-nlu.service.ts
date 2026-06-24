import { Injectable } from '@nestjs/common';
import { Generations } from '@smogon/calc';
import type { Nlu, ParsedQuestion } from './nlu.interface';

const GEN = Generations.get(9);

/** A known name plus its lowercased form, for substring matching. */
interface NameEntry {
  name: string;
  lower: string;
}

/** Common move nicknames → canonical move name. */
const MOVE_ALIASES: Record<string, string> = {
  draco: 'Draco Meteor',
  eq: 'Earthquake',
  cc: 'Close Combat',
  tbolt: 'Thunderbolt',
  twave: 'Thunder Wave',
  dgleam: 'Dazzling Gleam',
  fireblast: 'Fire Blast',
  hydro: 'Hydro Pump',
};

/**
 * Rules-based NLU. Recognizes the "can my X tank/take a MOVE from Y?" family
 * using a regex skeleton plus dictionary matching against Gen 9 species/move
 * names (and a few nicknames). No external calls — runs anywhere.
 */
@Injectable()
export class RulesNluService implements Nlu {
  private readonly species: NameEntry[];
  private readonly moves: NameEntry[];

  constructor() {
    this.species = this.collect(GEN.species);
    this.moves = this.collect(GEN.moves);
  }

  parse(text: string): ParsedQuestion {
    const raw = text;
    const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();

    // can [my] <defender> tank/take/survive [a] <move> from/off <attacker>
    const m = normalized.match(
      /can\s+(?:my\s+)?(.+?)\s+(?:tank|take|survive|eat|live(?:\s+through)?|handle)\s+(?:an?\s+)?(.+?)\s+(?:from|off(?:\s+of)?)\s+(.+?)[?.!]*$/,
    );

    if (!m) {
      // Best-effort fallback: pull whatever names we can recognize.
      const move = this.findMove(normalized);
      const mons = this.findAllSpecies(normalized);
      return {
        intent: 'unknown',
        defender: mons[0],
        attacker: mons[1],
        move,
        raw,
        reason:
          'Could not match a known question shape. Try: "can my [mon] tank a [move] from [mon]?"',
      };
    }

    const [, defenderPhrase, movePhrase, attackerPhrase] = m;
    const defender = this.findSpecies(defenderPhrase);
    const attacker = this.findSpecies(attackerPhrase);
    const move = this.findMove(movePhrase);

    const missing: string[] = [];
    if (!defender) missing.push('defending Pokémon');
    if (!attacker) missing.push('attacking Pokémon');
    if (!move) missing.push('move');

    if (missing.length > 0) {
      return {
        intent: 'unknown',
        defender,
        attacker,
        move,
        raw,
        reason: `Recognized the question shape but could not identify: ${missing.join(', ')}.`,
      };
    }

    return { intent: 'survive-check', defender, attacker, move, raw };
  }

  /** Build a length-sorted dictionary from an iterable of named data. */
  private collect(source: Iterable<{ name: string }>): NameEntry[] {
    const entries: NameEntry[] = [];
    for (const item of source) {
      if (item?.name) {
        entries.push({ name: item.name, lower: item.name.toLowerCase() });
      }
    }
    // Longest names first so "Draco Meteor" wins over "Draco" etc.
    return entries.sort((a, b) => b.lower.length - a.lower.length);
  }

  /** First known species whose name appears in the phrase. */
  private findSpecies(phrase: string): string | undefined {
    const p = phrase.toLowerCase();
    for (const entry of this.species) {
      if (p.includes(entry.lower)) return entry.name;
    }
    return undefined;
  }

  /** All known species mentioned, in order of appearance. */
  private findAllSpecies(phrase: string): string[] {
    const p = phrase.toLowerCase();
    const hits: { name: string; at: number }[] = [];
    for (const entry of this.species) {
      const at = p.indexOf(entry.lower);
      if (at >= 0 && !hits.some((h) => h.name === entry.name)) {
        hits.push({ name: entry.name, at });
      }
    }
    return hits.sort((a, b) => a.at - b.at).map((h) => h.name);
  }

  /** Known move from the phrase: nickname → direct name → contained token. */
  private findMove(phrase: string): string | undefined {
    const p = phrase.toLowerCase();

    for (const token of p.split(/\s+/)) {
      if (MOVE_ALIASES[token]) return MOVE_ALIASES[token];
    }
    for (const entry of this.moves) {
      if (p.includes(entry.lower)) return entry.name;
    }
    return undefined;
  }
}
