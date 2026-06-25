import { Module } from '@nestjs/common';
import { GeminiVisionService } from './gemini-vision.service';
import { OpenAiVisionService } from './openai-vision.service';
import { VISION, type VisionTeamExtractor } from './vision.interface';

/**
 * Chooses the active vision provider from the environment and binds it to the
 * VISION token. Consumers (TeamController) never change.
 *
 * Selection:
 * - VISION_PROVIDER=gemini   -> Google Gemini (needs GEMINI_API_KEY)
 * - VISION_PROVIDER=openai   -> any OpenAI-compatible API, including local
 *                               Ollama / LM Studio (see OpenAiVisionService)
 * - unset                    -> auto: use OpenAI-compatible if OPENAI_BASE_URL
 *                               or OPENAI_API_KEY is set, otherwise Gemini.
 *
 * When nothing is configured the chosen provider simply returns 503, so the
 * rest of the app keeps working without any vision credentials.
 */
function selectVision(
  gemini: GeminiVisionService,
  openai: OpenAiVisionService,
): VisionTeamExtractor {
  const provider = (process.env.VISION_PROVIDER || '').trim().toLowerCase();
  if (provider === 'openai' || provider === 'ollama') {
    return openai;
  }
  if (provider === 'gemini' || provider === 'google') {
    return gemini;
  }
  // Auto-detect when unset.
  if (process.env.OPENAI_BASE_URL || process.env.OPENAI_API_KEY) {
    return openai;
  }
  return gemini;
}

@Module({
  providers: [
    GeminiVisionService,
    OpenAiVisionService,
    {
      provide: VISION,
      inject: [GeminiVisionService, OpenAiVisionService],
      useFactory: selectVision,
    },
  ],
  exports: [VISION],
})
export class VisionModule {}
