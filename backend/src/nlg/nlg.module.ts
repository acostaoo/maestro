import { Module } from '@nestjs/common';
import { NLG } from './nlg.interface';
import { RulesNlgService } from './rules-nlg.service';

/**
 * Binds the active NLG implementation to the NLG token. Swap `useClass` to a
 * Gemini-backed service later without changing any consumer.
 */
@Module({
  providers: [{ provide: NLG, useClass: RulesNlgService }],
  exports: [NLG],
})
export class NlgModule {}
