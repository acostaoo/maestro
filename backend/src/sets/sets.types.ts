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
  teraType?: string;
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
