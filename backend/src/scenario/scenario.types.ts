import type { CalcResult } from '../calc/calc-result.interface';

/** One calc in the fan-out, labeled by which set each side used. */
export interface ScenarioOutcome {
  /** Set label for the attacker (set name, or "custom" for an explicit build). */
  attackerSet: string;
  /** Set label for the defender. */
  defenderSet: string;
  result: CalcResult;
}

/** Aggregate read across every outcome. */
export interface ScenarioSummary {
  outcomeCount: number;
  /** Smallest "max roll" percent across all outcomes (defender's best case). */
  minMaxPercent: number;
  /** Largest "max roll" percent across all outcomes (defender's worst case). */
  maxMaxPercent: number;
  /** Least damage possible: min roll of the weakest set. */
  bestCasePercent: number;
  /** Typical damage: the average roll of the average set. */
  avgCasePercent: number;
  /** Most damage possible: max roll of the strongest set (== maxMaxPercent). */
  worstCasePercent: number;
  /** Any set combination that is a guaranteed OHKO. */
  guaranteedOHKO: boolean;
  /** Any set combination that can OHKO on a high roll. */
  possibleOHKO: boolean;
}

/** Result of running an attacker × defender set fan-out for one move. */
export interface ScenarioResult {
  attacker: string;
  defender: string;
  move: string;
  outcomes: ScenarioOutcome[];
  summary: ScenarioSummary;
}
