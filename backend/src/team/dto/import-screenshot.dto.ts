import { IsOptional, IsString, MinLength } from 'class-validator';

/** A game screenshot to read into a team. */
export class ImportScreenshotDto {
  /** Base64 image data; may include a `data:image/...;base64,` prefix. */
  @IsString()
  @MinLength(100)
  image!: string;

  /** Optional MIME type override, e.g. "image/jpeg". Defaults to image/png. */
  @IsOptional()
  @IsString()
  mimeType?: string;
}
