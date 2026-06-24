import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { NLG, type Nlg } from '../nlg/nlg.interface';
import { NLU, type Nlu, type ParsedQuestion } from '../nlu/nlu.interface';
import type { ScenarioRequestDto } from '../scenario/dto/scenario-request.dto';
import { ScenarioService } from '../scenario/scenario.service';
import { SetsService } from '../sets/sets.service';
import type { AskResult } from './orchestrator.types';

/**
 * The coordinator. Runs the agent pipeline for one question:
 *   text → NLU → scenario fan-out (sets + calc + legality) → NLG → answer.
 * Pure wiring: each step is a call to an injected agent.
 */
@Injectable()
export class OrchestratorService {
  constructor(
    @Inject(NLU) private readonly nlu: Nlu,
    @Inject(NLG) private readonly nlg: Nlg,
    private readonly scenario: ScenarioService,
    private readonly sets: SetsService,
  ) {}

  ask(text: string): AskResult {
    const understood = this.nlu.parse(text);
    if (understood.intent !== 'survive-check') {
      throw new BadRequestException(
        understood.reason ?? "Sorry, I couldn't understand that question.",
      );
    }

    const request = this.toScenarioRequest(understood);
    const scenario = this.scenario.run(request);
    const { answer, details } = this.nlg.narrate(understood, scenario);

    return { answer, details, understood, scenario };
  }

  /**
   * Map an understood question to a scenario request. The attacker fans out
   * across stored sets when available (the spread feature); otherwise both
   * sides use a default build so we can still answer.
   */
  private toScenarioRequest(q: ParsedQuestion): ScenarioRequestDto {
    return {
      attacker: { name: q.attacker!, useSets: this.sets.hasSets(q.attacker!) },
      defender: { name: q.defender! },
      move: { name: q.move! },
    };
  }
}
