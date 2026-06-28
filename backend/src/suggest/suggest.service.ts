import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Generations, toID } from '@smogon/calc';
import type { TypeName } from '@smogon/calc/dist/data/interface';
import { FormatService } from '../format/format.service';
import { SetsRepository } from '../sets/sets.repository';
import { TeamService } from '../team/team.service';
import type { MetaThreat, Suggestion } from './suggest.types';

/** Gen 9 — matches the rest of the calc stack. */
const GEN = Generations.get(9);

/**
 * Generates team-relevant example questions. It pairs each of the user's
 * Pokémon (the defender, "my X") against a small persisted list of top
 * metagame threats and their standard moves, then surfaces the scariest
 * matchups (super-effective first) as ready-to-ask questions.
 */
@Injectable()
export class SuggestService implements OnModuleInit {
  private readonly logger = new Logger(SuggestService.name);
  private threats: MetaThreat[] = [];

  constructor(
    private readonly team: TeamService,
    private readonly sets: SetsRepository,
  ) {}

  onModuleInit(): void {
    this.threats = this.loadThreats();
  }

  /** Up to `limit` survival questions for the current team, scary ones first. */
  suggest(limit = 5): string[] {
    const members = this.team.getTeam().members;
    if (members.length === 0 || this.threats.length === 0) {
      return [];
    }

    const candidates: Suggestion[] = [];
    for (const member of members) {
      const types = this.typesOf(member.species);
      if (!types) {
        continue;
      }
      for (const threat of this.threats) {
        if (toID(threat.species) === toID(member.species)) {
          continue; // don't pit a Pokémon against itself
        }
        const best = this.scariestMove(threat, types);
        if (!best || best.effectiveness === 0) {
          continue; // skip immunities — "yes, obviously" isn't interesting
        }
        candidates.push({
          text: this.phrase(member.species, best.move, threat.species),
          defender: member.species,
          attacker: threat.species,
          move: best.move,
          effectiveness: best.effectiveness,
        });
      }
    }

    return this.pick(candidates, limit);
  }

  /** The threat's most effective damaging move against the given typing. */
  private scariestMove(
    threat: MetaThreat,
    defenderTypes: readonly TypeName[],
  ): { move: string; effectiveness: number } | undefined {
    let best: { move: string; effectiveness: number } | undefined;
    for (const name of threat.moves) {
      const move = GEN.moves.get(toID(name));
      if (!move || move.category === 'Status') {
        continue;
      }
      const effectiveness = this.effectiveness(move.type, defenderTypes);
      if (!best || effectiveness > best.effectiveness) {
        best = { move: name, effectiveness };
      }
    }
    return best;
  }

  /** Product of the move-type chart across the defender's types. */
  private effectiveness(
    moveType: TypeName,
    defenderTypes: readonly TypeName[],
  ): number {
    const chart = GEN.types.get(toID(moveType));
    if (!chart) {
      return 1;
    }
    let multiplier = 1;
    for (const type of defenderTypes) {
      multiplier *= chart.effectiveness[type] ?? 1;
    }
    return multiplier;
  }

  private typesOf(species: string): readonly TypeName[] | undefined {
    return GEN.species.get(toID(species))?.types;
  }

  /** "can my goodra tank a draco meteor from archaludon?" */
  private phrase(defender: string, move: string, attacker: string): string {
    const article = /^[aeiou]/i.test(move) ? 'an' : 'a';
    return `can my ${defender.toLowerCase()} tank ${article} ${move.toLowerCase()} from ${attacker.toLowerCase()}?`;
  }

  /**
   * Spread across the team (one question per Pokémon) and pick a *random*
   * super-effective matchup for each, so the chips rotate on every load
   * instead of always showing the single scariest hit.
   */
  private pick(candidates: Suggestion[], limit: number): string[] {

    // Prefer the genuinely scary (super-effective) matchups; fall back to all
    // if a team doesn't have enough of them to fill the chips.
    const scary = candidates.filter((c) => c.effectiveness >= 2);
    const pool = scary.length >= limit ? scary : candidates;

    // Bucket by defender so each chip features a different team member.
    const byDefender = new Map<string, Suggestion[]>();
    for (const c of pool) {
      const id = toID(c.defender);
      const list = byDefender.get(id) ?? [];
      list.push(c);
      byDefender.set(id, list);
    }

    const out: string[] = [];
    for (const id of this.shuffle([...byDefender.keys()])) {
      if (out.length >= limit) break;
      const matchup = this.shuffle(byDefender.get(id)!)[0];
      out.push(matchup.text);
    }

    // Smaller team than `limit`? Top up with other random matchups.
    for (const c of this.shuffle(pool)) {
      if (out.length >= limit) break;
      if (!out.includes(c.text)) out.push(c.text);
    }

    return out;
  }

  /** Fisher–Yates shuffle (non-mutating). */
  private shuffle<T>(items: T[]): T[] {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private loadThreats(): MetaThreat[] {
    const all = this.
    sets.all();
    if (all.length === 0) {
      this.logger.warn('No sets loaded in SetsRepository — threat list empty.');
      return [];
    }

    return all
      .map((s) => {
        // Collect all moves across every stored set, preserving order of first
        // appearance so the most-used set's moves come first.
        const seen = new Set<string>();
        const moves: string[] = [];
        for (const set of s.sets) {
          for (const m of set.moves ?? []) {
            const id = toID(m);
            if (!seen.has(id)) {
              seen.add(id);
              moves.push(m);
            }
          }
        }
        return { species: s.species, moves } satisfies MetaThreat;
      });
  }
}
