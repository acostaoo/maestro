/**
 * The NLU ("understanding") agent contract. Turns a plain-language question
 * into a structured intent. A rules-based implementation ships now; a future
 * Gemini-backed implementation can be bound to the same token without touching
 * the orchestrator.
 */

/** Injection token used to bind an Nlu implementation. */
export const NLU = 'NLU';

/** Recognized question kinds. Extend as we support more phrasings. */
export type QuestionIntent = 'survive-check' | 'unknown';

/** Stat-stage changes (e.g. Intimidate = atk -1), per stat, range -6..6. */
export type BoostSpread = Partial<
  Record<'atk' | 'def' | 'spa' | 'spd' | 'spe', number>
>;

/** Active weather, when the question states one (e.g. "under rain"). */
export type Weather = 'Sun' | 'Rain' | 'Sand' | 'Snow';

/** Structured result of parsing a question. */
export interface ParsedQuestion {
  intent: QuestionIntent;
  /** The defending Pokémon ("my X"), if identified. */
  defender?: string;
  /** The attacking Pokémon ("from Y"), if identified. */
  attacker?: string;
  /** The move, if identified. */
  move?: string;
  /** Stat changes on the attacker (e.g. "intimidated" → atk -1). */
  attackerBoosts?: BoostSpread;
  /** Stat changes on the defender. */
  defenderBoosts?: BoostSpread;
  /** Weather in play, if the question mentions it. */
  weather?: Weather;
  /** Original text, kept for narration/debugging. */
  raw: string;
  /** Why parsing failed, when intent is "unknown". */
  reason?: string;
}

export interface Nlu {
  parse(text: string): ParsedQuestion | Promise<ParsedQuestion>;
}
