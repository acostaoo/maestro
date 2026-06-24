import { Injectable, NotFoundException } from '@nestjs/common';
import { FormatService } from '../format/format.service';
import { SetsRepository } from './sets.repository';
import type { SpeciesSets } from './sets.types';

/**
 * The "sets agent": resolves the known competitive sets for a species. For now
 * it reads from the local repository (JSON). A future ingestion agent will
 * populate that repository from external usage sources. Sets are validated
 * against the current regulation so we never suggest an illegal Pokémon.
 */
@Injectable()
export class SetsService {
  constructor(
    private readonly repo: SetsRepository,
    private readonly format: FormatService,
  ) {}

  /** Resolve the stored sets for a legal species. */
  resolve(species: string): SpeciesSets {
    this.format.assertLegal(species);

    const found = this.repo.findBySpecies(species);
    if (!found) {
      throw new NotFoundException(
        `No sets stored for "${species}" yet. (Legal in the current regulation, but not yet ingested.)`,
      );
    }
    return found;
  }

  /** Whether any sets are stored for a species (non-throwing). */
  hasSets(species: string): boolean {
    return this.repo.has(species);
  }

  /** Species that currently have stored sets. */
  listCovered(): string[] {
    return this.repo.all().map((s) => s.species);
  }
}
