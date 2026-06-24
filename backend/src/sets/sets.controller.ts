import { Controller, Get, Param } from '@nestjs/common';
import { SetsService } from './sets.service';
import type { SpeciesSets } from './sets.types';

@Controller('sets')
export class SetsController {
  constructor(private readonly setsService: SetsService) {}

  /** List species that currently have stored sets. */
  @Get()
  listCovered(): { covered: string[] } {
    return { covered: this.setsService.listCovered() };
  }

  /** Resolve the known sets for a species. */
  @Get(':name')
  resolve(@Param('name') name: string): SpeciesSets {
    return this.setsService.resolve(name);
  }
}
