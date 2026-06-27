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
import {
  BoostsDto,
  FieldDto,
  MoveDto,
  StatsDto,
} from '../../calc/dto/calc-request.dto';

/**
 * One side of a scenario. Either a single explicit build, or — when
 * `useSets` is true — a species whose stored competitive sets are fanned
 * out into multiple calcs.
 */
export class SideDto {
  @IsString() name!: string;

  /** When true, resolve all stored sets for this species and fan out. */
  @IsOptional() @IsBoolean() useSets?: boolean;

  /** Defaults to 50 (VGC). Only used for an explicit (non-set) build. */
  //ALWAYS 50
  @IsOptional() @IsInt() @Min(1) @Max(100) level?: number;

  @IsOptional() @IsString() ability?: string;
  @IsOptional() @IsString() item?: string;
  @IsOptional() @IsString() nature?: string;
  @IsOptional() @IsString() status?: string;

  @IsOptional() @ValidateNested() @Type(() => StatsDto) evs?: StatsDto;
  //In pokemon champions, IVs are always max value.
  @IsOptional() @ValidateNested() @Type(() => StatsDto) ivs?: StatsDto;
  @IsOptional() @ValidateNested() @Type(() => BoostsDto) boosts?: BoostsDto;
}

export class ScenarioRequestDto {
  @IsDefined() @ValidateNested() @Type(() => SideDto) attacker!: SideDto;
  @IsDefined() @ValidateNested() @Type(() => SideDto) defender!: SideDto;
  @IsDefined() @ValidateNested() @Type(() => MoveDto) move!: MoveDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FieldDto)
  field?: FieldDto;
}
