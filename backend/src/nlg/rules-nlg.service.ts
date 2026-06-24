import { Injectable } from '@nestjs/common';
import type { ParsedQuestion } from '../nlu/nlu.interface';
import type {
  ScenarioOutcome,
  ScenarioResult,
} from '../scenario/scenario.types';
import type { NarratedAnswer, Nlg } from './nlg.interface';

/**
 * Rules-based narrator. Reads a scenario fan-out and produces a spoken answer
 * to a "can my X tank a MOVE from Y?" question, plus per-set detail lines.
 */
@Injectable()
export class RulesNlgService implements Nlg {
  narrate(question: ParsedQuestion, scenario: ScenarioResult): NarratedAnswer {
    const { defender, attacker, move, outcomes, summary } = scenario;
    const details = outcomes.map((o) => this.detailLine(o));

    if (outcomes.length === 0) {
      return { answer: 'No matchups to evaluate.', details };
    }

    const worst = outcomes.reduce((a, b) =>
      b.result.maxPercent > a.result.maxPercent ? b : a,
    );
    const multi = outcomes.length > 1;
    const setOf = (o: ScenarioOutcome): string =>
      o.attackerSet === 'custom' ? attacker : `${attacker}'s ${o.attackerSet}`;

    // Survives even the highest roll of every set.
    if (summary.maxMaxPercent < 100) {
      const remaining = Math.round((100 - summary.maxMaxPercent) * 10) / 10;
      const scope = multi ? `every ${attacker} set` : attacker;
      return {
        answer:
          `Yes — ${defender} tanks ${move} from ${scope}. ` +
          `Worst case (${worst.attackerSet}) it takes ${worst.result.maxPercent}%, ` +
          `leaving ~${remaining}% HP.`,
        details,
      };
    }

    // Some set is a guaranteed OHKO.
    if (summary.guaranteedOHKO) {
      const ko =
        outcomes.find((o) => /guaranteed OHKO/i.test(o.result.koChanceText)) ??
        worst;
      const safe = outcomes.filter((o) => o.result.maxPercent < 100);
      let answer = `No — ${move} from ${setOf(ko)} is a guaranteed OHKO on ${defender}.`;
      if (multi && safe.length > 0) {
        answer += ` It survives the ${this.list(safe.map((o) => o.attackerSet))} set${safe.length > 1 ? 's' : ''}, though.`;
      }
      return { answer, details };
    }

    // Survives most rolls, but a high roll can KO.
    return {
      answer:
        `Mostly — ${defender} lives most rolls, but ${setOf(worst)} ` +
        `can OHKO on a high roll (${worst.result.koChanceText}).`,
      details,
    };
  }

  private detailLine(o: ScenarioOutcome): string {
    return `[${o.attackerSet}] ${o.result.description}`;
  }

  /** "A, B and C" */
  private list(items: string[]): string {
    if (items.length <= 1) return items.join('');
    return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
  }
}
