/** A single EV/IV stat spread. All stats optional. */
export type StatSpread = Partial<
  Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>
>;

/** One named competitive set for a species. */
export interface PokemonSet {
  /** Set label, e.g. "Bulky Support", "Choice Specs". */
  name: string;
  item?: string;
  ability?: string;
  nature?: string;
  evs?: StatSpread;
  ivs?: StatSpread;
  moves?: string[];
  /** Usage share 0–1, when known (from ingestion). */
  usage?: number;
}

/** All known sets for a species, as stored in one JSON file. */
export interface SpeciesSets {
  species: string;
  sets: PokemonSet[];
}

/** One move/item/ability/nature entry with its Pikalytics usage percentage. */
export interface UsageStat {
  name: string;
  usage: number;
}

/** One EV spread entry with usage percentage, stored in tailormade files. */
export interface TailorMadeSpread extends StatSpread {
  usage: number;
}

/**
 * Raw Pikalytics usage data for a species.
 * Written as {species}.json by the ingestion service.
 * Moves/items/natures filtered to >= 10% usage; spreads limited to #1 spread.
 */
export interface TailorMadeData {
  species: string;
  base_stats?: StatSpread;
  moves: UsageStat[];
  items: UsageStat[];
  abilities: UsageStat[];
  natures: UsageStat[];
  spreads: TailorMadeSpread[];
}
