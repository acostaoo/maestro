import { BadRequestException, Injectable } from '@nestjs/common';
import {
  calculate,
  Field,
  Generations,
  Move,
  Pokemon,
  toID,
} from '@smogon/calc';
import type { CalcResult } from './calc-result.interface';
import type {
  CalcRequestDto,
  FieldDto,
  MoveDto,
  PokemonDto,
} from './dto/calc-request.dto';

/** Gen 9 (Scarlet/Violet) — the only generation we target for now. */
const GEN = Generations.get(9);

/** VGC defaults. */
const DEFAULT_LEVEL = 50;
const DEFAULT_GAME_TYPE = 'Doubles' as const;

@Injectable()
export class CalcService {
  calculate(req: CalcRequestDto): CalcResult {
    const attacker = this.buildPokemon(req.attacker, 'attacker');
    const defender = this.buildPokemon(req.defender, 'defender');
    const move = this.buildMove(req.move);
    const field = this.buildField(req.field);

    let result: CalcResult|any;
    try {
      result = calculate(GEN, attacker, defender, move, field);
    } catch (err) {
      throw new BadRequestException(
        `Calculation failed: ${(err as Error).message}`,
      );
    }

    const [minDamage, maxDamage] = result.range();
    const defenderMaxHP = defender.maxHP();
    const effectiveness =
      move.category === 'Status'
        ? undefined
        : this.typeEffectiveness(move, defender);
    const weatherMod = this.weatherModifier(move, field);

    // Zero-damage moves (type immunity, status moves) make @smogon/calc throw
    // inside both desc() and kochance(), so handle them explicitly.
    if (maxDamage === 0) {
      return {
        description: `${attacker.name} ${move.name} vs. ${defender.name}: 0 damage (immune or status move)`,
        damage: result.damage as number | number[],
        minDamage,
        maxDamage,
        minPercent: 0,
        maxPercent: 0,
        defenderMaxHP,
        koChanceText: 'no damage (immune or status move)',
        koHits: 0,
        effectiveness,
        weatherMod,
      };
    }

    const ko = result.kochance();

    return {
      description: result.desc(),
      damage: result.damage as number | number[],
      minDamage,
      maxDamage,
      minPercent: this.toPercent(minDamage, defenderMaxHP),
      maxPercent: this.toPercent(maxDamage, defenderMaxHP),
      defenderMaxHP,
      koChanceText: ko.text || 'unknown',
      koHits: ko.n,
      effectiveness,
      weatherMod,
    };
  }

  /** Move-type effectiveness against the defender's typing (product of each). */
  private typeEffectiveness(move: Move, defender: Pokemon): number {
    const chart = GEN.types.get(toID(move.type));
    if (!chart) {
      return 1;
    }
    let multiplier = 1;
    for (const type of defender.types) {
      multiplier *= chart.effectiveness[type] ?? 1;
    }
    return multiplier;
  }

  /** Damage multiplier the active weather applies to this move (1 if none). */
  private weatherModifier(move: Move, field: Field): number | undefined {
    if (move.category === 'Status') {
      return undefined;
    }
    const weather = field.weather;
    if (!weather) {
      return undefined;
    }
    if (weather === 'Rain' || weather === 'Heavy Rain') {
      if (move.type === 'Water') return 1.5;
      if (move.type === 'Fire') return 0.5;
    } else if (weather === 'Sun' || weather === 'Harsh Sunshine') {
      if (move.type === 'Fire') return 1.5;
      if (move.type === 'Water') return 0.5;
    }
    return 1; // weather is up but doesn't change this move
  }

  private buildPokemon(dto: PokemonDto | undefined, role: string): Pokemon {
    if (!dto?.name) {
      throw new BadRequestException(`Missing ${role} Pokémon name.`);
    }
    if (!GEN.species.get(toID(dto.name))) {
      throw new BadRequestException(`Unknown Pokémon: "${dto.name}".`);
    }
    try {
      // @smogon/calc uses branded string types for names/abilities/items;
      // the constructor accepts plain strings at runtime, so we cast options.
      return new Pokemon(GEN, dto.name, {
        level: dto.level ?? DEFAULT_LEVEL,
        ability: dto.ability,
        item: dto.item,
        nature: dto.nature,
        status: dto.status,
        evs: dto.evs,
        ivs: dto.ivs,
        boosts: dto.boosts,
      } as never);
    } catch (err) {
      throw new BadRequestException(
        `Invalid ${role} "${dto.name}": ${(err as Error).message}`,
      );
    }
  }

  private buildMove(dto: MoveDto | undefined): Move {
    if (!dto?.name) {
      throw new BadRequestException('Missing move name.');
    }
    if (!GEN.moves.get(toID(dto.name))) {
      throw new BadRequestException(`Unknown move: "${dto.name}".`);
    }
    try {
      return new Move(GEN, dto.name, {
        isCrit: dto.crit,
        hits: dto.hits,
      } as never);
    } catch (err) {
      throw new BadRequestException(
        `Invalid move "${dto.name}": ${(err as Error).message}`,
      );
    }
  }

  private buildField(dto?: FieldDto): Field {
    return new Field({
      gameType: dto?.gameType ?? DEFAULT_GAME_TYPE,
      weather: dto?.weather,
      terrain: dto?.terrain,
    } as never);
  }

  private toPercent(damage: number, maxHP: number): number {
    return Math.round((damage / maxHP) * 1000) / 10;
  }
}
