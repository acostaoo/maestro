import { Controller, Get, Query } from '@nestjs/common';
import { SuggestService } from './suggest.service';

@Controller('suggestions')
export class SuggestController {
  constructor(private readonly suggest: SuggestService) {}

  /** Team-relevant example questions for the empty-chat prompt chips. */
  @Get()
  list(@Query('limit') limit?: string): { suggestions: string[] } {
    const n = Number(limit);
    const count = Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 5;
    return { suggestions: this.suggest.suggest(count) };
  }
}
