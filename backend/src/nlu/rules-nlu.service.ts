import { Injectable } from '@nestjs/common';
import { Generations } from '@smogon/calc';
import type { BoostSpread, Nlu, ParsedQuestion } from './nlu.interface';

const GEN = Generations.get(9);

/** A known name plus its lowercased form, for substring matching. */
interface NameEntry {
  name: string;
  lower: string;
}

/** A dictionary hit: the canonical name, where it matched, and how strongly. */
interface NameMatch {
  name: string;
  at: number;
  length: number;
  score: number;
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

/** Minimum fuzzy similarity (0–1) to accept a typo'd name as a match. */
const FUZZY_THRESHOLD = 0.72;

/** Filler words that should never be fuzzy-matched to a species/move name. */
const STOPWORDS = new Set([
  'can',
  'my',
  'a',
  'an',
  'the',
  'is',
  'it',
  'to',
  'of',
  'off',
  'from',
  'frmo',
  'tank',
  'tanks',
  'take',
  'takes',
  'survive',
  'survives',
  'eat',
  'eats',
  'live',
  'lives',
  'through',
  'handle',
  'handles',
  'vs',
  'versus',
  'against',
  'intimidate',
  'intimidated',
  'intimidates',
]);

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
      // No rigid shape (e.g. a typo'd "from") — still answer if we can recover
      // all three entities from the free text. Mask the move first so its words
      // (e.g. "flare" in "flare blitz") can't be misread as a species.
      const moveMatch = this.findMoveMatch(normalized);
      const move = moveMatch?.name;
      const scan = moveMatch ? this.mask(normalized, moveMatch) : normalized;
      const mons = this.matchAll(scan, this.species);
      const defenderMatch = mons[0];
      const attackerMatch = mons[1];
      const defender = defenderMatch?.name;
      const attacker = attackerMatch?.name;
      if (defender && attacker && move) {
        return {
          intent: 'survive-check',
          defender,
          attacker,
          move,
          defenderBoosts: this.boostsBefore(scan, defenderMatch.at),
          attackerBoosts: this.boostsBefore(scan, attackerMatch.at),
          raw,
        };
      }
      return {
        intent: 'unknown',
        defender,
        attacker,
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

    return {
      intent: 'survive-check',
      defender,
      attacker,
      move,
      defenderBoosts: this.scanBoosts(defenderPhrase),
      attackerBoosts: this.scanBoosts(attackerPhrase),
      raw,
    };
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

  /** Best known species the phrase mentions (exact, typo, or abbreviation). */
  private findSpecies(phrase: string): string | undefined {
    return this.best(this.matchAll(phrase, this.species));
  }

  /** Known move from the phrase: nickname → exact name → close typo. */
  private findMove(phrase: string): string | undefined {
    return this.findMoveMatch(phrase)?.name;
  }

  /** Locate the move and where it appears, so callers can mask its span. */
  private findMoveMatch(phrase: string): NameMatch | undefined {
    const p = phrase.toLowerCase();
    // Nickname aliases win, keeping the token's position for masking.
    const re = /[a-z0-9]+/g;
    let token: RegExpExecArray | null;
    while ((token = re.exec(p)) !== null) {
      const alias = MOVE_ALIASES[token[0]];
      if (alias) {
        return { name: alias, at: token.index, length: token[0].length, score: 1 };
      }
    }
    const matches = this.matchAll(p, this.moves);
    if (matches.length === 0) return undefined;
    return [...matches].sort((a, b) => b.score - a.score || a.at - b.at)[0];
  }

  /** Blank out a matched span so its words aren't re-read as another entity. */
  private mask(phrase: string, match: NameMatch): string {
    return (
      phrase.slice(0, match.at) +
      ' '.repeat(match.length) +
      phrase.slice(match.at + match.length)
    );
  }

  /** Stat changes in the few words just before a species at `at`. */
  private boostsBefore(text: string, at: number): BoostSpread | undefined {
    const words = text.slice(0, at).split(/\s+/).filter(Boolean);
    return this.scanBoosts(words.slice(-4).join(' '));
  }

  /**
   * Read stat-stage changes from a fragment: "intimidated" (atk -1) plus
   * explicit stages like "+1 atk", "atk +2", "-1 def". Returns undefined when
   * nothing is found.
   */
  private scanBoosts(fragment: string): BoostSpread | undefined {
    const t = fragment.toLowerCase();
    const boosts: BoostSpread = {};
    const add = (stat: keyof BoostSpread, n: number) => {
      boosts[stat] = Math.max(-6, Math.min(6, (boosts[stat] ?? 0) + n));
    };

    if (/\bintimidat(?:e|ed|es|ion)?\b/.test(t)) {
      add('atk', -1);
    }

    const STAT =
      '(atk|attack|def|defense|defence|spa|spatk|special attack|spd|spdef|special defense|spe|speed)';
    const apply = (raw: string, sign: string, num: string) => {
      const stat = this.statKey(raw);
      if (stat) add(stat, (sign === '-' ? -1 : 1) * Number(num));
    };
    for (const x of t.matchAll(new RegExp(`([+\\-])\\s*([1-6])\\s*${STAT}`, 'g'))) {
      apply(x[3], x[1], x[2]);
    }
    for (const x of t.matchAll(new RegExp(`${STAT}\\s*([+\\-])\\s*([1-6])`, 'g'))) {
      apply(x[1], x[2], x[3]);
    }

    return Object.keys(boosts).length > 0 ? boosts : undefined;
  }

  /** Normalize a stat word/abbreviation to its boost key. */
  private statKey(word: string): keyof BoostSpread | undefined {
    const w = word.replace(/[^a-z]/g, '');
    if (['atk', 'attack'].includes(w)) return 'atk';
    if (['def', 'defense', 'defence'].includes(w)) return 'def';
    if (['spa', 'spatk', 'specialattack'].includes(w)) return 'spa';
    if (['spd', 'spdef', 'specialdefense'].includes(w)) return 'spd';
    if (['spe', 'speed'].includes(w)) return 'spe';
    return undefined;
  }

  /**
   * Find every dictionary name the phrase mentions, tolerating typos and
   * abbreviations. Returns matches ordered by where they appear, de-duplicated
   * keeping the strongest hit per name. Exact substring hits always win.
   */
  private matchAll(phrase: string, dict: NameEntry[]): NameMatch[] {
    const p = phrase.toLowerCase();
    const matches: NameMatch[] = [];

    // 1. Exact substring (cheap and unambiguous — longest names already win).
    for (const entry of dict) {
      const at = p.indexOf(entry.lower);
      if (at >= 0) {
        matches.push({
          name: entry.name,
          at,
          length: entry.lower.length,
          score: 1,
        });
      }
    }

    // 2. Fuzzy: compare single words and adjacent word pairs to each name.
    const words = this.tokenize(p);
    for (let i = 0; i < words.length; i++) {
      const windows = [words[i]];
      if (i + 1 < words.length) {
        windows.push({
          text: `${words[i].text} ${words[i + 1].text}`,
          at: words[i].at,
        });
      }
      for (const w of windows) {
        if (w.text.length < 3 || STOPWORDS.has(w.text)) continue;
        let best: NameMatch | undefined;
        for (const entry of dict) {
          const score = this.score(w.text, entry.lower);
          if (score >= FUZZY_THRESHOLD && (!best || score > best.score)) {
            best = { name: entry.name, at: w.at, length: w.text.length, score };
          }
        }
        if (best) matches.push(best);
      }
    }

    // Earliest position first; for the same spot prefer the stronger score.
    matches.sort((a, b) => a.at - b.at || b.score - a.score);
    const seen = new Set<string>();
    return matches.filter((mat) =>
      seen.has(mat.name) ? false : (seen.add(mat.name), true),
    );
  }

  /** Strongest match by score, breaking ties by earliest appearance. */
  private best(matches: NameMatch[]): string | undefined {
    if (matches.length === 0) return undefined;
    return [...matches].sort((a, b) => b.score - a.score || a.at - b.at)[0].name;
  }

  /** Similarity in [0,1]: 1 = identical, with prefix/abbreviation shortcuts. */
  private score(a: string, b: string): number {
    if (a === b) return 1;
    // "incin" → "incineroar": a typed prefix of a longer canonical name.
    if (b.startsWith(a) && a.length >= 4) return 0.95;
    if (a.startsWith(b) && b.length >= 4) return 0.9;
    const distance = this.levenshtein(a, b);
    return 1 - distance / Math.max(a.length, b.length);
  }

  /** Split into lowercase word tokens, remembering each token's offset. */
  private tokenize(phrase: string): { text: string; at: number }[] {
    const tokens: { text: string; at: number }[] = [];
    const re = /[a-z0-9]+/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(phrase)) !== null) {
      tokens.push({ text: match[0], at: match.index });
    }
    return tokens;
  }

  /** Classic Levenshtein edit distance between two short strings. */
  private levenshtein(a: string, b: string): number {
    const cols = b.length + 1;
    const dp: number[] = Array.from({ length: cols }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j < cols; j++) {
        const temp = dp[j];
        dp[j] = Math.min(
          dp[j] + 1,
          dp[j - 1] + 1,
          prev + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
        prev = temp;
      }
    }
    return dp[cols - 1];
  }
}
