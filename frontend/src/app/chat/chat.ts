import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AskService, AskResult } from '../ask.service';
import { SpriteService } from '../sprite.service';
import { Team, TeamService } from '../team.service';

type Verdict = 'survives' | 'risky' | 'ko';

interface DamageBar {
  best: number;
  avg: number;
  worst: number;
}

interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  details?: string[];
  error?: boolean;
  verdict?: Verdict;
  matchup?: { defender: string; move: string; attacker: string };
  atkSprite?: string;
  defSprite?: string;
  bar?: DamageBar;
}

@Component({
  selector: 'app-chat',
  imports: [FormsModule],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat implements OnInit {
  private readonly ask = inject(AskService);
  private readonly sprites = inject(SpriteService);
  private readonly teamApi = inject(TeamService);

  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly loading = signal(false);
  protected inputText = '';

  protected readonly team = signal<Team | null>(null);
  protected readonly teamSprites = signal<Record<string, string>>({});
  protected readonly importing = signal(false);
  protected readonly importError = signal<string | null>(null);

  protected readonly examples = [
    'can my goodra tank a draco meteor from archaludon?',
    'can my incineroar survive a draco from goodra?',
  ];

  ngOnInit(): void {
    this.refreshTeam();
  }

  /** Load the currently held team and resolve its sprites. */
  private refreshTeam(): void {
    this.teamApi.get().subscribe({
      next: (team) => this.applyTeam(team),
      error: () => this.team.set(null),
    });
  }

  private applyTeam(team: Team): void {
    this.team.set(team);
    for (const member of team.members) {
      this.sprites.get(member.species).subscribe((url) => {
        if (url) {
          this.teamSprites.update((map) => ({ ...map, [member.species]: url }));
        }
      });
    }
  }

  /** Read a chosen screenshot file and send it to the vision importer. */
  onScreenshot(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.importing()) {
      return;
    }

    this.importError.set(null);
    this.importing.set(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      this.teamApi.importScreenshot(dataUrl, file.type || 'image/png').subscribe({
        next: (team) => {
          this.applyTeam(team);
          this.importing.set(false);
          const count = team.members.length;
          this.messages.update((m) => [
            ...m,
            {
              role: 'bot',
              text: `Loaded ${count} Pok\u00e9mon from your screenshot. Ask away \u2014 "my <mon>" now uses this team.`,
            },
          ]);
        },
        error: (err: unknown) => {
          this.importing.set(false);
          this.importError.set(this.errorMessage(err));
        },
      });
    };
    reader.onerror = () => {
      this.importing.set(false);
      this.importError.set('Could not read that image file.');
    };
    reader.readAsDataURL(file);
  }

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
        const message = this.toBotMessage(result);
        this.messages.update((m) => [...m, message]);
        this.loading.set(false);
        this.loadSprites(message);
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

  /** Resolve attacker/defender sprites and patch them onto the message. */
  private loadSprites(message: ChatMessage): void {
    if (!message.matchup) {
      return;
    }
    this.sprites.get(message.matchup.attacker).subscribe((url) => {
      if (url) {
        message.atkSprite = url;
        this.messages.update((m) => [...m]);
      }
    });
    this.sprites.get(message.matchup.defender).subscribe((url) => {
      if (url) {
        message.defSprite = url;
        this.messages.update((m) => [...m]);
      }
    });
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
      bar: summary
        ? {
            best: this.clampPct(summary.bestCasePercent),
            avg: this.clampPct(summary.avgCasePercent),
            worst: this.clampPct(summary.worstCasePercent),
          }
        : undefined,
    };
  }

  private clampPct(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
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
