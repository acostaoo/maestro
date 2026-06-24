import { Module } from '@nestjs/common';
import { CalcModule } from '../calc/calc.module';
import { SetsModule } from '../sets/sets.module';
import { ScenarioController } from './scenario.controller';
import { ScenarioService } from './scenario.service';

@Module({
  imports: [CalcModule, SetsModule],
  controllers: [ScenarioController],
  providers: [ScenarioService],
  exports: [ScenarioService],
})
export class ScenarioModule {}
