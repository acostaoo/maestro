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
import { VISION, type VisionImage, type VisionTeamExtractor } from '../vision/vision.interface';
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
    const images = this.decodeImages(body);
    const extracted = await this.vision.extractTeam(images);
    if (extracted.members.length === 0) {
      throw new BadRequestException(
        'No Pokémon were recognized in that screenshot. Try a clearer team-preview shot.',
      );
    }
    return this.team.setTeam(extracted);
  }

  /**
   * Collect every provided screenshot — the single `image` and/or the `images`
   * slides (spreads + moves/items) — as raw base64 + MIME type.
   */
  private decodeImages(body: ImportScreenshotDto): VisionImage[] {
    const raw = [...(body.image ? [body.image] : []), ...(body.images ?? [])];
    if (raw.length === 0) {
      throw new BadRequestException(
        'Provide at least one screenshot via "image" or "images".',
      );
    }
    return raw.map((data) => this.decodeImage(data, body.mimeType));
  }

  /** Split an optional `data:` URL prefix into raw base64 + a MIME type. */
  private decodeImage(image: string, fallbackMime?: string): VisionImage {
    const match = image.match(/^data:(image\/[\w.+-]+);base64,(.*)$/s);
    if (match) {
      return { mimeType: match[1], base64: match[2] };
    }
    return { mimeType: fallbackMime ?? 'image/png', base64: image };
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
