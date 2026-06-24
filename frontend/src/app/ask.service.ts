import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/** How the backend understood the question. */
export interface ParsedQuestion {
  intent: string;
  defender?: string;
  attacker?: string;
  move?: string;
  raw: string;
  reason?: string;
}

/** Response of POST /ask. */
export interface AskResult {
  answer: string;
  details: string[];
  understood: ParsedQuestion;
  scenario: unknown;
}

@Injectable({ providedIn: 'root' })
export class AskService {
  private readonly http = inject(HttpClient);
  private readonly base = 'http://localhost:3000';

  ask(text: string): Observable<AskResult> {
    return this.http.post<AskResult>(`${this.base}/ask`, { text });
  }
}
