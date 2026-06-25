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

    // When the question involves stat changes, also run the matchup at neutral
    // so the answer can contrast both ("yes if intimidated… otherwise…").
    const baseline = this.hasBoosts(request)
      ? this.scenario.run(this.withoutBoosts(request))
      : undefined;
    const { answer, details } = this.nlg.narrate(understood, scenario, baseline);

    return { answer, details, understood, scenario };
  }

  /** True when either side carries a non-empty stat-stage spread. */
  private hasBoosts(request: ScenarioRequestDto): boolean {
    const has = (boosts?: SideDto['boosts']): boolean =>
      !!boosts && Object.values(boosts).some((n) => n !== 0 && n != null);
    return has(request.attacker.boosts) || has(request.defender.boosts);
  }

  /** Same request with all stat changes stripped, for the neutral baseline. */
  private withoutBoosts(request: ScenarioRequestDto): ScenarioRequestDto {
    return {
      ...request,
      attacker: { ...request.attacker, boosts: undefined },
      defender: { ...request.defender, boosts: undefined },
    };
  }

  /**
   * Map an understood question to a scenario request. The defender is the
   * user's own Pokémon ("my X"), so it resolves to that team member's real
   * spread when known (digested from the team screenshot); otherwise a default
   * build. The attacker fans out across stored sets when available.
   */
  private toScenarioRequest(q: ParsedQuestion): ScenarioRequestDto {
    return {
      attacker: {
        name: q.attacker!,
        useSets: this.sets.hasSets(q.attacker!),
        boosts: q.attackerBoosts,
      },
      defender: this.defenderSide(q.defender!, q.defenderBoosts),
      move: { name: q.move! },
    };
  }

  private defenderSide(species: string, boosts?: SideDto['boosts']): SideDto {
    const member = this.team.findMember(species);
    if (!member) {
      return { name: species, boosts };
    }
    return {
      name: member.species,
      level: member.level,
      item: member.item,
      ability: member.ability,
      nature: member.nature,
      evs: member.evs,
      ivs: member.ivs,
      boosts,
    };
  }
}

