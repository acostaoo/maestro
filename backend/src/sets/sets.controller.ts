import { Controller, Get, Param, Post } from '@nestjs/common';
import { SetsIngestionService } from './sets-ingestion.service';
import { SetsService } from './sets.service';
import type { SpeciesSets } from './sets.types';

@Controller('sets')
export class SetsController {
  constructor(
    private readonly setsService: SetsService,
    private readonly ingestion: SetsIngestionService,
  ) {}

  /** List species that currently have stored sets. */
  @Get()
  listCovered(): { covered: string[] } {
    return { covered: this.setsService.listCovered() };
  }

  /** Manually trigger Pikalytics ingestion for the top 15 species. */
  @Post('ingest')
  ingest(): Promise<{ ingested: number; top: string[] }> {
    return this.ingestion.ingest();
  }

  /** On-demand ingestion for a single species by name. */
  @Post('ingest/:name')
  ingestOne(@Param('name') name: string): Promise<SpeciesSets> {
    return this.ingestion.ingestOne(name);
  }

  /** Resolve the known sets for a species. */
  @Get(':name')
  resolve(@Param('name') name: string): SpeciesSets {
    return this.setsService.resolve(name);
  }
}
