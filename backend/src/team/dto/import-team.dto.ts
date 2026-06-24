import { IsOptional, IsString, MinLength } from 'class-validator';

/** A raw Pokémon Showdown team export to import. */
export class ImportTeamDto {
  @IsString()
  @MinLength(3)
  paste!: string;

  @IsOptional()
  @IsString()
  name?: string;
}
