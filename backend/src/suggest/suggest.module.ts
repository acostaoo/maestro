import { Module } from '@nestjs/common';
import { FormatModule } from '../format/format.module';
import { TeamModule } from '../team/team.module';
import { SuggestController } from './suggest.controller';
import { SuggestService } from './suggest.service';

@Module({
  imports: [TeamModule, FormatModule],
  controllers: [SuggestController],
  providers: [SuggestService],
})
export class SuggestModule {}
