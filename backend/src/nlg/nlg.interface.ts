import type { ParsedQuestion } from '../nlu/nlu.interface';
import type { ScenarioResult } from '../scenario/scenario.types';

/**
 * The NLG ("narration") agent contract. Turns a structured scenario result
 * into a spoken-language answer. Rules-based now, Gemini-backed later behind
 * the same token.
 */
export const NLG = 'NLG';

/** A narrated answer plus supporting one-liners. */
export interface NarratedAnswer {
  /** The headline spoken answer, e.g. "Yes, but the Specs set OHKOs...". */
  answer: string;
  /** Per-set detail lines, suitable for a chat UI's expandable section. */
  details: string[];
}

export interface Nlg {
  /**
   * Narrate a scenario. When `baseline` is given (the same matchup run with
   * the stat changes removed), the answer compares the boosted case against
   * neutral, e.g. "Yes, if Incineroar is at −1 Atk… otherwise…".
   */
  narrate(
    question: ParsedQuestion,
    scenario: ScenarioResult,
    baseline?: ScenarioResult,
  ): NarratedAnswer;
}
