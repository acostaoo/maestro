import { Module } from '@nestjs/common';
import { GeminiNluService } from './gemini-nlu.service';
import { NLU } from './nlu.interface';
import { RulesNluService } from './rules-nlu.service';

/**
 * Binds the active NLU implementation to the NLU token. Uses Gemini for
 * maximum accuracy ("perfection" mode).
 */
@Module({
  providers: [
    GeminiNluService,
    RulesNluService,
    {
      provide: NLU, useExisting: RulesNluService,
    },
  ],
  exports: [NLU],
})
export class NluModule {}
