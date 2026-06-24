import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { toID } from '@smogon/calc';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Team, TeamMember } from './team.types';

/**
 * Holds the user's current team and its real spreads. This is the store the
 * team-digest agent (screenshot → team) writes to — same "seam first" pattern
 * as the sets repository. Seeds from team/data/my-team.json on startup and can
 * be replaced at runtime via setTeam().
 */
@Injectable()
export class TeamService implements OnModuleInit {
  private readonly logger = new Logger(TeamService.name);
  private readonly seedFile = join(__dirname, 'data', 'my-team.json');
  private team: Team = { members: [] };

  onModuleInit(): void {
    this.loadSeed();
  }

  private loadSeed(): void {
    if (!existsSync(this.seedFile)) {
      this.logger.log('No seed team found; starting with an empty team.');
      return;
    }
    try {
      const parsed = JSON.parse(readFileSync(this.seedFile, 'utf-8')) as Team;
      if (Array.isArray(parsed.members)) {
        this.team = parsed;
        this.logger.log(`Loaded team with ${parsed.members.length} members.`);
      }
    } catch (err) {
      this.logger.warn(`Failed to load seed team: ${(err as Error).message}`);
    }
  }

  getTeam(): Team {
    return this.team;
  }

  setTeam(team: Team): Team {
    this.team = team;
    this.logger.log(`Team replaced; now ${team.members.length} members.`);
    return this.team;
  }

  /** The member matching a species, if it's on the team. */
  findMember(species: string): TeamMember | undefined {
    const id = toID(species);
    return this.team.members.find((m) => toID(m.species) === id);
  }
}
