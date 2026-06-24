import { IsString, MinLength } from 'class-validator';

export class AskRequestDto {
  @IsString()
  @MinLength(3)
  text!: string;
}
