import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Body,
} from '@nestjs/common';
import { VISION, type VisionTeamExtractor } from '../vision/vision.interface';
import { ImportScreenshotDto } from './dto/import-screenshot.dto';
import { ImportTeamDto } from './dto/import-team.dto';
import { SetTeamDto } from './dto/set-team.dto';
import { TeamService } from './team.service';
import type { Team, TeamMember } from './team.types';

@Controller('team')
export class TeamController {
  constructor(
    private readonly team: TeamService,
    @Inject(VISION) private readonly vision: VisionTeamExtractor,
  ) {}

  @Get()
  get(): Team {
    return this.team.getTeam();
  }

  @Put()
  set(@Body() body: SetTeamDto): Team {
    return this.team.setTeam(body);
  }

  @Post('import')
  import(@Body() body: ImportTeamDto): Team {
    return this.team.importPaste(body.paste, body.name);
  }

  @Post('import-screenshot')
  async importScreenshot(@Body() body: ImportScreenshotDto): Promise<Team> {
    const { base64, mimeType } = this.decodeImage(body);
    const extracted = await this.vision.extractTeam({ base64, mimeType });
    if (extracted.members.length === 0) {
      throw new BadRequestException(
        'No Pokémon were recognized in that screenshot. Try a clearer team-preview shot.',
      );
    }
    return this.team.setTeam(extracted);
  }

  /** Split an optional `data:` URL prefix into raw base64 + a MIME type. */
  private decodeImage(body: ImportScreenshotDto): {
    base64: string;
    mimeType: string;
  } {
    const match = body.image.match(/^data:(image\/[\w.+-]+);base64,(.*)$/s);
    if (match) {
      return { mimeType: match[1], base64: match[2] };
    }
    return { mimeType: body.mimeType ?? 'image/png', base64: body.image };
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
