/** A competitive regulation / format definition, loaded from JSON. */
export interface Regulation {
  /** Short id, e.g. "MB". */
  id: string;
  /** Display name, e.g. "Regulation M-B". */
  name: string;
  game: string;
  generation: number;
  gameType: 'Singles' | 'Doubles';
  level: number;
  teamSize: { min: number; max: number };
  startDate: string;
  endDate: string;
  source: string;
  notes?: string;
  /** Restricted ("legendary") species, usually capped per team. */
  restricted: string[];
  /** Explicitly banned species. */
  banned: string[];
  /** Full legal species pool. */
  legal: string[];
}

/** Result of a legality check for a single species. */
export interface LegalityResult {
  species: string;
  legal: boolean;
  reason?: 'banned' | 'not-in-pool' | 'ok';
}
