import type { StatSpread } from '../sets/sets.types';

/**
 * One concrete member of the user's team — a fully-specified build with its
 * real spread. Populated by the team-digest agent (screenshot → team); for now
 * seeded from team/data/my-team.json or set via PUT /team.
 */
export interface TeamMember {
  species: string;
  level?: number;
  item?: string;
  ability?: string;
  nature?: string;
  teraType?: string;
  evs?: StatSpread;
  ivs?: StatSpread;
  moves?: string[];
}

/** The user's current team. */
export interface Team {
  name?: string;
  members: TeamMember[];
}
