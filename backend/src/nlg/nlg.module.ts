import { Module } from '@nestjs/common';
import { GeminiNlgService } from './gemini-nlg.service';
import { NLG } from './nlg.interface';
import { RulesNlgService } from './rules-nlg.service';

/**
 * Binds the active NLG implementation to the NLG token. Uses Gemini for
 * maximum accuracy ("perfection" mode).
 */
@Module({
  providers: [
    GeminiNlgService,
    RulesNlgService,
    {
      provide: NLG,
      useFactory: (gemini: GeminiNlgService, rules: RulesNlgService) => {
        return process.env.GEMINI_API_KEY ? gemini : rules;
      },
      inject: [GeminiNlgService, RulesNlgService],
    },
  ],
  exports: [NLG],
})
export class NlgModule {}
