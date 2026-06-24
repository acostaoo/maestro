import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Put,
  Body,
} from '@nestjs/common';
import { SetTeamDto } from './dto/set-team.dto';
import { TeamService } from './team.service';
import type { Team, TeamMember } from './team.types';

@Controller('team')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  get(): Team {
    return this.team.getTeam();
  }

  @Put()
  set(@Body() body: SetTeamDto): Team {
    return this.team.setTeam(body);
  }

  @Get(':name')
  member(@Param('name') name: string): TeamMember {
    const found = this.team.findMember(name);
    if (!found) {
      throw new NotFoundException(`"${name}" is not on the current team.`);
    }
    return found;
  }
}
