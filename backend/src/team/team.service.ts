import { BadRequestException, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { toID } from '@smogon/calc';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseShowdownTeam } from './showdown-paste';
import type { Team, TeamMember } from './team.types';

/**
 * Holds the user's current team and its real spreads. This is the store the
 * team-digest agent (screenshot → team) writes to — same "seam first" pattern
 * as the sets repository.
 *
 * On startup it restores a previously saved team from backend/data/team.json
 * (written whenever the team changes, so it survives restarts) and otherwise
 * falls back to the bundled placeholder seed team/data/my-team.json. The store
 * file path is anchored to the backend root so a rebuild never clobbers it.
 */
@Injectable()
export class TeamService implements OnModuleInit {
  private readonly logger = new Logger(TeamService.name);
  private readonly seedFile = join(__dirname, 'data', 'my-team.json');
  private readonly storeFile = join(__dirname, '..', '..', 'data', 'team.json');
  private team: Team = { members: [] };

  onModuleInit(): void {
    this.loadInitial();
  }

  private loadInitial(): void {
    if (this.loadFrom(this.storeFile, 'saved team')) {
      return;
    }
    if (this.loadFrom(this.seedFile, 'seed team')) {
      return;
    }
    this.logger.log('No team found; starting with an empty team.');
  }

  private loadFrom(file: string, label: string): boolean {
    if (!existsSync(file)) {
      return false;
    }
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf-8')) as Team;
      if (Array.isArray(parsed.members)) {
        this.team = parsed;
        this.logger.log(`Loaded ${label} with ${parsed.members.length} members.`);
        return true;
      }
    } catch (err) {
      this.logger.warn(`Failed to load ${label}: ${(err as Error).message}`);
    }
    return false;
  }

  private persist(): void {
    try {
      mkdirSync(dirname(this.storeFile), { recursive: true });
      writeFileSync(this.storeFile, JSON.stringify(this.team, null, 2), 'utf-8');
    } catch (err) {
      this.logger.warn(`Failed to save team: ${(err as Error).message}`);
    }
  }

  getTeam(): Team {
    return this.team;
  }

  setTeam(team: Team): Team {
    this.team = team;
    this.persist();
    this.logger.log(`Team replaced; now ${team.members.length} members (saved).`);
    return this.team;
  }

  /** Replace the team from a Pokémon Showdown export paste. */
  importPaste(paste: string, name?: string): Team {
    const parsed = parseShowdownTeam(paste, name);
    if (parsed.members.length === 0) {
      throw new BadRequestException(
        "Couldn't parse any Pokémon from that paste. Use a Showdown team export.",
      );
    }
    return this.setTeam(parsed);
  }

  /**
   * The member matching a species, if it's on the team. Tries an exact id
   * match first, then a base-form match so a spoken base name ("goodra")
   * resolves to a regional member ("Goodra-Hisui").
   */
  findMember(species: string): TeamMember | undefined {
    const id = toID(species);
    const exact = this.team.members.find((m) => toID(m.species) === id);
    if (exact) {
      return exact;
    }
    return this.team.members.find(
      (m) =>
        toID(m.species).startsWith(id) || toID(this.baseName(m.species)) === id,
    );
  }

  /** The species name without its form suffix, e.g. "Goodra-Hisui" → "Goodra". */
  private baseName(species: string): string {
    return species.split('-')[0];
  }
}
