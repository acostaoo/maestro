import { Module } from '@nestjs/common';
import { FormatModule } from '../format/format.module';
import { SetsController } from './sets.controller';
import { SetsRepository } from './sets.repository';
import { SetsService } from './sets.service';

@Module({
  imports: [FormatModule],
  controllers: [SetsController],
  providers: [SetsRepository, SetsService],
  exports: [SetsService, SetsRepository],
})
export class SetsModule {}
