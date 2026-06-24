import { Module } from '@nestjs/common';
import { NlgModule } from '../nlg/nlg.module';
import { NluModule } from '../nlu/nlu.module';
import { ScenarioModule } from '../scenario/scenario.module';
import { SetsModule } from '../sets/sets.module';
import { TeamModule } from '../team/team.module';
import { OrchestratorController } from './orchestrator.controller';
import { OrchestratorService } from './orchestrator.service';

@Module({
  imports: [NluModule, NlgModule, ScenarioModule, SetsModule, TeamModule],
  controllers: [OrchestratorController],
  providers: [OrchestratorService],
})
export class OrchestratorModule {}
