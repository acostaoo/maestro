import { Module } from '@nestjs/common';
import { GeminiVisionService } from './gemini-vision.service';
import { VISION } from './vision.interface';

/**
 * Binds the active vision implementation to the VISION token. Swap `useClass`
 * to a local-model service (e.g. Ollama) later without changing any consumer.
 */
@Module({
  providers: [{ provide: VISION, useClass: GeminiVisionService }],
  exports: [VISION],
})
export class VisionModule {}
