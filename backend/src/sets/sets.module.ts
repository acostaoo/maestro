import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { FormatModule } from '../format/format.module';
import { SetsController } from './sets.controller';
import { SetsIngestionService } from './sets-ingestion.service';
import { SetsRepository } from './sets.repository';
import { SetsService } from './sets.service';

@Module({
  imports: [FormatModule, ScheduleModule.forRoot()],
  controllers: [SetsController],
  providers: [SetsRepository, SetsService, SetsIngestionService],
  exports: [SetsService, SetsRepository, SetsIngestionService],
})
export class SetsModule {}
