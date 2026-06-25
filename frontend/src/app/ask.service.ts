import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/** Stat-stage changes per stat (e.g. atk -1 from Intimidate). */
export type BoostSpread = Partial<
  Record<'atk' | 'def' | 'spa' | 'spd' | 'spe', number>
>;

/** How the backend understood the question. */
export interface ParsedQuestion {
  intent: string;
  defender?: string;
  attacker?: string;
  move?: string;
  raw: string;
  reason?: string;
}

/** Roll summary across every set matchup. */
export interface ScenarioSummary {
  outcomeCount: number;
  minMaxPercent: number;
  maxMaxPercent: number;
  bestCasePercent: number;
  avgCasePercent: number;
  worstCasePercent: number;
  guaranteedOHKO: boolean;
  possibleOHKO: boolean;
}

export interface ScenarioResult {
  attacker: string;
  defender: string;
  move: string;
  effectiveness?: number;
  attackerBoosts?: BoostSpread;
  defenderBoosts?: BoostSpread;
  summary: ScenarioSummary;
}

/** Response of POST /ask. */
export interface AskResult {
  answer: string;
  details: string[];
  understood: ParsedQuestion;
  scenario: ScenarioResult;
}

@Injectable({ providedIn: 'root' })
export class AskService {
  private readonly http = inject(HttpClient);
  private readonly base = 'http://localhost:3000';

  ask(text: string): Observable<AskResult> {
    return this.http.post<AskResult>(`${this.base}/ask`, { text });
  }

  /** Team-relevant example questions for the empty-chat prompt chips. */
  suggestions(limit = 3): Observable<{ suggestions: string[] }> {
    return this.http.get<{ suggestions: string[] }>(
      `${this.base}/suggestions?limit=${limit}`,
    );
  }
}
