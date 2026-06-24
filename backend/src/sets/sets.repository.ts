import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { toID } from '@smogon/calc';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SpeciesSets } from './sets.types';

/**
 * Data-access layer for competitive sets. Loads one JSON file per species from
 * the `data/` directory and caches them in memory, keyed by normalized species
 * id. This is the seam a future ingestion agent writes to: it only needs to
 * drop/update JSON files here, no service code changes.
 */
@Injectable()
export class SetsRepository implements OnModuleInit {
  private readonly logger = new Logger(SetsRepository.name);
  private readonly dataDir = join(__dirname, 'data');
  private readonly cache = new Map<string, SpeciesSets>();

  onModuleInit(): void {
    this.load();
  }

  /** (Re)loads all set JSON files from disk into the cache. */
  load(): void {
    this.cache.clear();
    if (!existsSync(this.dataDir)) {
      this.logger.warn(`Sets data directory not found: ${this.dataDir}`);
      return;
    }

    const files = readdirSync(this.dataDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = readFileSync(join(this.dataDir, file), 'utf-8');
        const parsed = JSON.parse(raw) as SpeciesSets;
        if (!parsed.species || !Array.isArray(parsed.sets)) {
          this.logger.warn(`Skipping malformed set file: ${file}`);
          continue;
        }
        this.cache.set(toID(parsed.species), parsed);
      } catch (err) {
        this.logger.warn(`Failed to load ${file}: ${(err as Error).message}`);
      }
    }
    this.logger.log(`Loaded sets for ${this.cache.size} species.`);
  }

  findBySpecies(name: string): SpeciesSets | undefined {
    return this.cache.get(toID(name));
  }

  has(name: string): boolean {
    return this.cache.has(toID(name));
  }

  all(): SpeciesSets[] {
    return [...this.cache.values()];
  }
}
