import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { toID } from '@smogon/calc';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PokemonSet, SpeciesSets, StatSpread, TailorMadeData } from './sets.types';

/**
 * Data-access layer for competitive sets. Loads one JSON file per species from
 * the `data/` directory and caches them in memory, keyed by normalized species
 * id. This is the seam a future ingestion agent writes to: it only needs to
 * drop/update JSON files here, no service code changes.
 */
@Injectable()
export class SetsRepository implements OnModuleInit {
  private readonly logger = new Logger(SetsRepository.name);
  private readonly dataDir =
    process.env.SETS_DATA_DIR ?? join(process.cwd(), 'src', 'sets', 'data');
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
        const parsed = JSON.parse(raw) as TailorMadeData;
        if (!parsed.species || !Array.isArray(parsed.moves)) {
          this.logger.warn(`Skipping malformed set file: ${file}`);
          continue;
        }
        this.cache.set(toID(parsed.species), this.toSpeciesSets(parsed));
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

  /** Derives a single canonical PokemonSet from the top entry in each category. */
  private toSpeciesSets(data: TailorMadeData): SpeciesSets {
    const item = data.items[0]?.name;
    const ability = data.abilities[0]?.name;
    const nature = data.natures[0]?.name ?? 'Serious';
    const spreadEntry = data.spreads[0];
    const evs: StatSpread = {};
    if (spreadEntry) {
      const { usage: _u, ...rest } = spreadEntry;
      Object.assign(evs, rest);
    }
    const moves = data.moves.map((m) => m.name);
    const set: PokemonSet = {
      name: item ? `${item} (${nature})` : `Standard (${nature})`,
      ...(ability && { ability }),
      ...(item && { item }),
      nature,
      evs,
      moves,
    };
    return { species: data.species, sets: [set] };
  }
  }

