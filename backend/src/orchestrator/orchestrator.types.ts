import type { ParsedQuestion } from '../nlu/nlu.interface';
import type { ScenarioResult } from '../scenario/scenario.types';

/** Full response of the orchestrator: spoken answer plus the reasoning trail. */
export interface AskResult {
  /** The spoken-language answer. */
  answer: string;
  /** Per-set detail lines backing the answer. */
  details: string[];
  /** How the question was understood (for transparency/debugging). */
  understood: ParsedQuestion;
  /** The underlying scenario fan-out. */
  scenario: ScenarioResult;
}
