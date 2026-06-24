/** Normalized result returned by the calc engine. */
export interface CalcResult {
  /** Human-readable summary from @smogon/calc, e.g.
   * "252+ SpA Archaludon Draco Meteor vs. 252 HP / 4 SpD Goodra: 320-378 (83.3 - 98.4%) -- guaranteed 2HKO". */
  description: string;

  /** Damage rolls (length 16) or a single number for fixed-damage moves. */
  damage: number | number[];

  minDamage: number;
  maxDamage: number;

  /** Percentage of the defender's max HP. */
  minPercent: number;
  maxPercent: number;

  defenderMaxHP: number;

  /** e.g. "guaranteed 2HKO", "50.4% chance to OHKO". */
  koChanceText: string;

  /** Number of hits to KO (n in nHKO), when determinable. */
  koHits?: number;
}
