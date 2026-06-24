import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CalcModule } from './calc/calc.module';
import { FormatModule } from './format/format.module';
import { ScenarioModule } from './scenario/scenario.module';
import { SetsModule } from './sets/sets.module';

@Module({
  imports: [CalcModule, FormatModule, SetsModule, ScenarioModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
