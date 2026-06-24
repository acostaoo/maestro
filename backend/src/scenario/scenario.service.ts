import { Injectable } from '@nestjs/common';
import { CalcService } from '../calc/calc.service';
import type { PokemonDto } from '../calc/dto/calc-request.dto';
import { SetsService } from '../sets/sets.service';
import type { PokemonSet } from '../sets/sets.types';
import type { SideDto, ScenarioRequestDto } from './dto/scenario-request.dto';
import type {
  ScenarioOutcome,
  ScenarioResult,
  ScenarioSummary,
} from './scenario.types';

/** A resolved build for one side, plus the label of where it came from. */
interface SideOption {
  label: string;
  pokemon: PokemonDto;
}

/**
 * Connects the sets agent to the calc engine. Each side can be a single
 * explicit build or a species whose stored sets are fanned out, producing one
 * calc per attacker-set × defender-set combination plus an aggregate summary.
 */
@Injectable()
export class ScenarioService {
  constructor(
    private readonly calc: CalcService,
    private readonly sets: SetsService,
  ) {}

  run(req: ScenarioRequestDto): ScenarioResult {
    const attackers = this.optionsFor(req.attacker);
    const defenders = this.optionsFor(req.defender);

    const outcomes: ScenarioOutcome[] = [];
    for (const a of attackers) {
      for (const d of defenders) {
        const result = this.calc.calculate({
          attacker: a.pokemon,
          defender: d.pokemon,
          move: req.move,
          field: req.field,
        });
        outcomes.push({
          attackerSet: a.label,
          defenderSet: d.label,
          result,
        });
      }
    }

    return {
      attacker: req.attacker.name,
      defender: req.defender.name,
      move: req.move.name,
      outcomes,
      summary: this.summarize(outcomes),
    };
  }

  /** Expand a side into one option per stored set, or a single custom build. */
  private optionsFor(side: SideDto): SideOption[] {
    if (side.useSets) {
      // resolve() validates legality and throws 404 if no sets are stored.
      const speciesSets = this.sets.resolve(side.name);
      return speciesSets.sets.map((set) => ({
        label: set.name,
        pokemon: this.setToPokemon(side.name, set),
      }));
    }
    return [{ label: 'custom', pokemon: this.sideToPokemon(side) }];
  }

  private setToPokemon(species: string, set: PokemonSet): PokemonDto {
    return {
      name: species,
      ability: set.ability,
      item: set.item,
      nature: set.nature,
      teraType: set.teraType,
      evs: set.evs,
      ivs: set.ivs,
    };
  }

  private sideToPokemon(side: SideDto): PokemonDto {
    return {
      name: side.name,
      level: side.level,
      ability: side.ability,
      item: side.item,
      nature: side.nature,
      status: side.status,
      teraType: side.teraType,
      evs: side.evs,
      ivs: side.ivs,
      boosts: side.boosts,
    };
  }

  private summarize(outcomes: ScenarioOutcome[]): ScenarioSummary {
    const maxPercents = outcomes.map((o) => o.result.maxPercent);
    return {
      outcomeCount: outcomes.length,
      minMaxPercent: Math.min(...maxPercents),
      maxMaxPercent: Math.max(...maxPercents),
      guaranteedOHKO: outcomes.some((o) =>
        /guaranteed OHKO/i.test(o.result.koChanceText),
      ),
      possibleOHKO: outcomes.some((o) => /OHKO/i.test(o.result.koChanceText)),
    };
  }
}
