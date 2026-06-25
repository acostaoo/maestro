import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { StatsDto } from '../../calc/dto/calc-request.dto';

export class TeamMemberDto {
  @IsString() species!: string;

  @IsOptional() @IsInt() @Min(1) @Max(100) level?: number;
  @IsOptional() @IsString() item?: string;
  @IsOptional() @IsString() ability?: string;
  @IsOptional() @IsString() nature?: string;

  @IsOptional() @ValidateNested() @Type(() => StatsDto) evs?: StatsDto;
  @IsOptional() @ValidateNested() @Type(() => StatsDto) ivs?: StatsDto;

  @IsOptional() @IsArray() @IsString({ each: true }) moves?: string[];
}

export class SetTeamDto {
  @IsOptional() @IsString() name?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamMemberDto)
  members!: TeamMemberDto[];
}
