import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

/** A game screenshot (or both team-preview slides) to read into a team. */
export class ImportScreenshotDto {
  /** Base64 image data; may include a `data:image/...;base64,` prefix. */
  @IsOptional()
  @IsString()
  @MinLength(100)
  image?: string;

  /**
   * Base64 images for the two team-preview slides (spreads + moves/items) of
   * the same team. Each may include a `data:image/...;base64,` prefix.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MinLength(100, { each: true })
  images?: string[];

  /** Optional MIME type override, e.g. "image/jpeg". Defaults to image/png. */
  @IsOptional()
  @IsString()
  mimeType?: string;
}
