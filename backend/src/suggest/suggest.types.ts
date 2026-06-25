/** A common metagame attacker and its standard offensive moves. */
export interface MetaThreat {
  species: string;
  /** Representative damaging moves, most standard first. */
  moves: string[];
}

/** A generated, team-relevant survival question. */
export interface Suggestion {
  /** The clickable question text, e.g. "can my X tank a MOVE from Y?". */
  text: string;
  defender: string;
  attacker: string;
  move: string;
  /** Type-effectiveness of the chosen move vs the defender (for ranking). */
  effectiveness: number;
}
