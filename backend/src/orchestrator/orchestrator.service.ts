import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { NLG, type Nlg } from '../nlg/nlg.interface';
import { NLU, type Nlu, type ParsedQuestion } from '../nlu/nlu.interface';
import type {
  ScenarioRequestDto,
  SideDto,
} from '../scenario/dto/scenario-request.dto';
import { ScenarioService } from '../scenario/scenario.service';
import { SetsService } from '../sets/sets.service';
import { TeamService } from '../team/team.service';
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
    private readonly team: TeamService,
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
   * Map an understood question to a scenario request. The defender is the
   * user's own Pokémon ("my X"), so it resolves to that team member's real
   * spread when known (digested from the team screenshot); otherwise a default
   * build. The attacker fans out across stored sets when available.
   */
  private toScenarioRequest(q: ParsedQuestion): ScenarioRequestDto {
    return {
      attacker: { name: q.attacker!, useSets: this.sets.hasSets(q.attacker!) },
      defender: this.defenderSide(q.defender!),
      move: { name: q.move! },
    };
  }

  private defenderSide(species: string): SideDto {
    const member = this.team.findMember(species);
    if (!member) {
      return { name: species };
    }
    return {
      name: member.species,
      level: member.level,
      item: member.item,
      ability: member.ability,
      nature: member.nature,
      teraType: member.teraType,
      evs: member.evs,
      ivs: member.ivs,
    };
  }
}

