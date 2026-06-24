import { Controller, Get, Param } from '@nestjs/common';
import { FormatService } from './format.service';
import type { LegalityResult, Regulation } from './format.types';

@Controller('format')
export class FormatController {
  constructor(private readonly formatService: FormatService) {}

  /** Current regulation details (legal pool, ruleset, dates). */
  @Get()
  getRegulation(): Regulation {
    return this.formatService.getRegulation();
  }

  /** Check whether a single species is legal in the current regulation. */
  @Get('legal/:name')
  checkLegal(@Param('name') name: string): LegalityResult {
    return this.formatService.check(name);
  }
}
