import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AskService, AskResult } from '../ask.service';

type Verdict = 'survives' | 'risky' | 'ko';

interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  details?: string[];
  error?: boolean;
  verdict?: Verdict;
  matchup?: { defender: string; move: string; attacker: string };
  worstPercent?: number;
}

@Component({
  selector: 'app-chat',
  imports: [FormsModule],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat {
  private readonly ask = inject(AskService);

  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly loading = signal(false);
  protected inputText = '';

  protected readonly examples = [
    'can my goodra tank a draco meteor from archaludon?',
    'can my incineroar survive a draco from goodra?',
  ];

  send(text?: string): void {
    const question = (text ?? this.inputText).trim();
    if (!question || this.loading()) {
      return;
    }

    this.messages.update((m) => [...m, { role: 'user', text: question }]);
    this.inputText = '';
    this.loading.set(true);

    this.ask.ask(question).subscribe({
      next: (result) => {
        this.messages.update((m) => [...m, this.toBotMessage(result)]);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        const message = this.errorMessage(err);
        this.messages.update((m) => [
          ...m,
          { role: 'bot', text: message, error: true },
        ]);
        this.loading.set(false);
      },
    });
  }

  protected verdictLabel(v: Verdict): string {
    return v === 'survives' ? 'Survives' : v === 'ko' ? 'Gets KO\u2019d' : 'Risky';
  }

  protected verdictIcon(v: Verdict): string {
    return v === 'survives' ? '\u2713' : v === 'ko' ? '\u2715' : '\u26A0';
  }

  private toBotMessage(result: AskResult): ChatMessage {
    const summary = result.scenario?.summary;
    return {
      role: 'bot',
      text: result.answer,
      details: result.details,
      verdict: this.verdictFor(result, summary?.guaranteedOHKO),
      matchup: result.scenario
        ? {
            defender: result.scenario.defender,
            move: result.scenario.move,
            attacker: result.scenario.attacker,
          }
        : undefined,
      worstPercent: summary
        ? Math.min(100, Math.round(summary.maxMaxPercent))
        : undefined,
    };
  }

  private verdictFor(result: AskResult, guaranteedOHKO?: boolean): Verdict {
    const head = result.answer.trim().toLowerCase();
    if (head.startsWith('yes')) {
      return 'survives';
    }
    if (head.startsWith('no') || guaranteedOHKO) {
      return 'ko';
    }
    return 'risky';
  }

  private errorMessage(err: unknown): string {
    const e = err as { error?: { message?: string }; status?: number };
    if (e?.status === 0) {
      return 'Can\u2019t reach the server. Is the backend running on :3000?';
    }
    return e?.error?.message ?? 'Something went wrong.';
  }
}
