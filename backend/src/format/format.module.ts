import { Module } from '@nestjs/common';
import { FormatController } from './format.controller';
import { FormatService } from './format.service';

@Module({
  controllers: [FormatController],
  providers: [FormatService],
  exports: [FormatService],
})
export class FormatModule {}
