import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CalcModule } from './calc/calc.module';
import { FormatModule } from './format/format.module';
import { ScenarioModule } from './scenario/scenario.module';
import { SetsModule } from './sets/sets.module';
import { NluModule } from './nlu/nlu.module';
import { NlgModule } from './nlg/nlg.module';
import { TeamModule } from './team/team.module';
import { OrchestratorModule } from './orchestrator/orchestrator.module';
import { SuggestModule } from './suggest/suggest.module';

@Module({
  imports: [
    CalcModule,
    FormatModule,
    SetsModule,
    ScenarioModule,
    NluModule,
    NlgModule,
    TeamModule,
    OrchestratorModule,
    SuggestModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
