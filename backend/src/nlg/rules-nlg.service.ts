import { Injectable } from '@nestjs/common';
import type { ParsedQuestion } from '../nlu/nlu.interface';
import type {
  BoostSpread,
  ScenarioOutcome,
  ScenarioResult,
} from '../scenario/scenario.types';
import type { NarratedAnswer, Nlg } from './nlg.interface';

type VerdictKind = 'survives' | 'risky' | 'ko';

/** Display names for boost stats, e.g. atk → "Atk". */
const STAT_LABEL: Record<keyof BoostSpread, string> = {
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe',
};

/**
 * Rules-based narrator. Reads a scenario fan-out and produces a spoken answer
 * to a "can my X tank a MOVE from Y?" question, plus per-set detail lines.
 */
@Injectable()
export class RulesNlgService implements Nlg {
  narrate(
    _question: ParsedQuestion,
    scenario: ScenarioResult,
    baseline?: ScenarioResult,
  ): NarratedAnswer {
    const details = scenario.outcomes.map((o) => this.detailLine(o));

    if (scenario.outcomes.length === 0) {
      return { answer: 'No matchups to evaluate.', details };
    }

    if (baseline && baseline.outcomes.length > 0) {
      return this.narrateDual(scenario, baseline, details);
    }

    return this.narrateSingle(scenario, details);
  }

  /** Original single-scenario narration (no stat changes involved). */
  private narrateSingle(
    scenario: ScenarioResult,
    details: string[],
  ): NarratedAnswer {
    const { defender, attacker, move, outcomes, summary } = scenario;
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

  /**
   * Compare the boosted scenario (as asked) against the neutral baseline, so
   * the answer covers both: "Yes, if Incineroar is at −1 Atk … otherwise …".
   */
  private narrateDual(
    boosted: ScenarioResult,
    baseline: ScenarioResult,
    details: string[],
  ): NarratedAnswer {
    const condition = this.boostCondition(boosted);
    const asked = this.verdict(boosted);
    const neutral = this.verdict(baseline);
    const head =
      asked.kind === 'survives' ? 'Yes' : asked.kind === 'ko' ? 'No' : 'Maybe';

    return {
      answer:
        `${head} — ${condition}, ${asked.phrase}. ` +
        `Otherwise at neutral, ${neutral.phrase}.`,
      details,
    };
  }

  /** "if Incineroar is at −1 Atk" (or both sides, when both are boosted). */
  private boostCondition(scenario: ScenarioResult): string {
    const parts: string[] = [];
    const atk = this.formatBoosts(scenario.attackerBoosts);
    const def = this.formatBoosts(scenario.defenderBoosts);
    if (atk) parts.push(`${scenario.attacker} is at ${atk}`);
    if (def) parts.push(`${scenario.defender} is at ${def}`);
    return parts.length > 0
      ? `if ${parts.join(' and ')}`
      : 'with the stat changes';
  }

  /** Render a boost spread as "−1 Atk" / "+2 Spe, −1 Def". */
  private formatBoosts(boosts?: BoostSpread): string | undefined {
    if (!boosts) return undefined;
    const parts = (Object.keys(STAT_LABEL) as Array<keyof BoostSpread>)
      .filter((stat) => boosts[stat])
      .map((stat) => {
        const n = boosts[stat]!;
        return `${n > 0 ? '+' : '−'}${Math.abs(n)} ${STAT_LABEL[stat]}`;
      });
    return parts.length > 0 ? parts.join(', ') : undefined;
  }

  /** A short verdict + phrase for one scenario. */
  private verdict(scenario: ScenarioResult): {
    kind: VerdictKind;
    phrase: string;
  } {
    const { defender, summary } = scenario;
    if (summary.maxMaxPercent < 100) {
      const remaining = Math.round((100 - summary.maxMaxPercent) * 10) / 10;
      return {
        kind: 'survives',
        phrase: `${defender} tanks it (worst case ${summary.maxMaxPercent}%, ~${remaining}% HP left)`,
      };
    }
    if (summary.guaranteedOHKO) {
      return {
        kind: 'ko',
        phrase: `it's a guaranteed OHKO on ${defender} (up to ${summary.maxMaxPercent}%)`,
      };
    }
    return {
      kind: 'risky',
      phrase: `${defender} lives most rolls but can be KO'd on a high roll (up to ${summary.maxMaxPercent}%)`,
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
