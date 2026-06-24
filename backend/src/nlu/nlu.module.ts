import { Module } from '@nestjs/common';
import { NLU } from './nlu.interface';
import { RulesNluService } from './rules-nlu.service';

/**
 * Binds the active NLU implementation to the NLU token. Swap `useClass` to a
 * Gemini-backed service later without changing any consumer.
 */
@Module({
  providers: [{ provide: NLU, useClass: RulesNluService }],
  exports: [NLU],
})
export class NluModule {}
