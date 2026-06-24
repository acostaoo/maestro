import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/** A Pokémon's effort/individual values. Each stat is optional. */
export class StatsDto {
  @IsOptional() @IsInt() @Min(0) @Max(252) hp?: number;
  @IsOptional() @IsInt() @Min(0) @Max(252) atk?: number;
  @IsOptional() @IsInt() @Min(0) @Max(252) def?: number;
  @IsOptional() @IsInt() @Min(0) @Max(252) spa?: number;
  @IsOptional() @IsInt() @Min(0) @Max(252) spd?: number;
  @IsOptional() @IsInt() @Min(0) @Max(252) spe?: number;
}

/** Stat-stage boosts, from -6 to +6. */
export class BoostsDto {
  @IsOptional() @IsInt() @Min(-6) @Max(6) atk?: number;
  @IsOptional() @IsInt() @Min(-6) @Max(6) def?: number;
  @IsOptional() @IsInt() @Min(-6) @Max(6) spa?: number;
  @IsOptional() @IsInt() @Min(-6) @Max(6) spd?: number;
  @IsOptional() @IsInt() @Min(-6) @Max(6) spe?: number;
}

export class PokemonDto {
  @IsString() name!: string;

  /** Defaults to 50 (VGC). */
  @IsOptional() @IsInt() @Min(1) @Max(100) level?: number;

  @IsOptional() @IsString() ability?: string;
  @IsOptional() @IsString() item?: string;
  @IsOptional() @IsString() nature?: string;
  @IsOptional() @IsString() status?: string;

  /** Tera type, e.g. "Fairy". Omit for non-Tera. */
  @IsOptional() @IsString() teraType?: string;

  @IsOptional() @ValidateNested() @Type(() => StatsDto) evs?: StatsDto;
  @IsOptional() @ValidateNested() @Type(() => StatsDto) ivs?: StatsDto;
  @IsOptional() @ValidateNested() @Type(() => BoostsDto) boosts?: BoostsDto;
}

export class MoveDto {
  @IsString() name!: string;

  @IsOptional() @IsBoolean() crit?: boolean;

  /** Number of hits for multi-hit moves. */
  @IsOptional() @IsInt() @Min(1) @Max(10) hits?: number;
}

export class FieldDto {
  /** Defaults to "Doubles" (VGC). */
  @IsOptional() @IsString() gameType?: 'Singles' | 'Doubles';

  /** e.g. "Sun", "Rain", "Sand", "Snow". */
  @IsOptional() @IsString() weather?: string;

  /** e.g. "Electric", "Grassy", "Misty", "Psychic". */
  @IsOptional() @IsString() terrain?: string;
}

export class CalcRequestDto {
  @IsDefined() @ValidateNested() @Type(() => PokemonDto) attacker!: PokemonDto;
  @IsDefined() @ValidateNested() @Type(() => PokemonDto) defender!: PokemonDto;
  @IsDefined() @ValidateNested() @Type(() => MoveDto) move!: MoveDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FieldDto)
  field?: FieldDto;
}
