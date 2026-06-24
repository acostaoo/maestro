import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { toID } from '@smogon/calc';
import regMB from './regulations/reg-mb.json';
import type { LegalityResult, Regulation } from './format.types';

/**
 * Provides format/regulation rules. Legality is data-driven: the legal pool
 * lives in the regulation JSON, so rotating regulations is a data change, not
 * a code change. Currently pinned to Regulation M-B (Pokémon Champions).
 */
@Injectable()
export class FormatService {
  private readonly logger = new Logger(FormatService.name);
  private readonly regulation: Regulation = regMB as Regulation;

  /** Normalized (toID) lookup sets for fast, name-format-agnostic checks. */
  private readonly legalIds = new Set(this.regulation.legal.map((n) => toID(n)));
  private readonly bannedIds = new Set(
    this.regulation.banned.map((n) => toID(n)),
  );

  getRegulation(): Regulation {
    return this.regulation;
  }

  /** True if the species is usable in the current regulation. */
  isLegal(species: string): boolean {
    const id = toID(species);
    return this.legalIds.has(id) && !this.bannedIds.has(id);
  }

  check(species: string): LegalityResult {
    const id = toID(species);
    if (this.bannedIds.has(id)) {
      return { species, legal: false, reason: 'banned' };
    }
    if (!this.legalIds.has(id)) {
      return { species, legal: false, reason: 'not-in-pool' };
    }
    return { species, legal: true, reason: 'ok' };
  }

  /** Throws a 400 if the species is not legal in the current regulation. */
  assertLegal(species: string): void {
    const result = this.check(species);
    if (!result.legal) {
      throw new BadRequestException(
        `"${species}" is not legal in ${this.regulation.name} (${result.reason}).`,
      );
    }
  }

  /** Returns only the species that are legal in the current regulation. */
  filterLegal(species: string[]): string[] {
    return species.filter((s) => this.isLegal(s));
  }
}
