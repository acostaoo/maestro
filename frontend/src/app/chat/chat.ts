import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AskService, AskResult, BoostSpread } from '../ask.service';
import { SpriteService } from '../sprite.service';
import { Team, TeamService } from '../team.service';

type Verdict = 'survives' | 'situational' | 'risky' | 'ko';

type Weather = 'Sun' | 'Rain' | 'Sand' | 'Snow';

/** Must match the backend NLG's WEATHER_PHRASE, for highlight detection. */
const WEATHER_PHRASE: Record<Weather, string> = {
  Rain: 'in the rain',
  Sun: 'in the sun',
  Sand: 'in the sandstorm',
  Snow: 'in the snow',
};

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
  weather?: Weather;
  matchup?: {
    defender: string;
    move: string;
    attacker: string;
    effectiveness?: number;
    weatherMod?: number;
    weather?: Weather;
    attackerBoosts?: BoostSpread;
    defenderBoosts?: BoostSpread;
  };
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
export class Chat implements OnInit, AfterViewChecked {
  private readonly ask = inject(AskService);
  private readonly sprites = inject(SpriteService);
  private readonly teamApi = inject(TeamService);

  @ViewChild('log') private log?: ElementRef<HTMLDivElement>;

  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly loading = signal(false);
  protected inputText = '';

  /** Previously sent questions, oldest first, for up/down-arrow recall. */
  private readonly history: string[] = [];
  /** Cursor into `history`; -1 means "not browsing" (showing live input). */
  private historyIndex = -1;
  /** Message+typing count last rendered, to know when to auto-scroll. */
  private lastRenderedCount = 0;

  protected readonly team = signal<Team | null>(null);
  protected readonly teamSprites = signal<Record<string, string>>({});
  protected readonly importing = signal(false);
  protected readonly importError = signal<string | null>(null);

  protected readonly examples = signal<string[]>([
    'can my goodra tank a draco meteor from archaludon?',
    'can my incineroar survive a draco from goodra?',
  ]);

  ngOnInit(): void {
    this.refreshTeam();
    this.refreshSuggestions();
  }

  /** Pull team-relevant example questions for the empty-chat prompt chips. */
  private refreshSuggestions(): void {
    this.ask.suggestions().subscribe({
      next: (res) => {
        if (res.suggestions?.length) {
          this.examples.set(res.suggestions);
        }
      },
      error: () => {
        /* keep the built-in fallbacks */
      },
    });
  }

  /** Keep the log pinned to the newest message as the chat grows. */
  ngAfterViewChecked(): void {
    const count = this.messages().length + (this.loading() ? 1 : 0);
    if (count !== this.lastRenderedCount) {
      this.lastRenderedCount = count;
      this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {
    const el = this.log?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }

  /** Recall earlier questions with the up/down arrows, terminal-style. */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowUp') {
      if (this.history.length === 0) {
        return;
      }
      event.preventDefault();
      this.historyIndex =
        this.historyIndex === -1
          ? this.history.length - 1
          : Math.max(0, this.historyIndex - 1);
      this.inputText = this.history[this.historyIndex];
    } else if (event.key === 'ArrowDown') {
      if (this.historyIndex === -1) {
        return;
      }
      event.preventDefault();
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        this.inputText = this.history[this.historyIndex];
      } else {
        this.historyIndex = -1;
        this.inputText = '';
      }
    }
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
    this.history.push(question);
    this.historyIndex = -1;
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
    switch (v) {
      case 'survives':
        return 'Survives';
      case 'situational':
        return 'Situational';
      case 'ko':
        return 'Gets KO\u2019d';
      default:
        return 'Risky';
    }
  }

  protected verdictIcon(v: Verdict): string {
    switch (v) {
      case 'survives':
        return '\u2713';
      case 'situational':
        return '\u2248'; // ≈ — holds under conditions
      case 'ko':
        return '\u2715';
      default:
        return '\u26A0';
    }
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
      weather: result.understood?.weather,
      matchup: result.scenario
        ? {
            defender: result.scenario.defender,
            move: result.scenario.move,
            attacker: result.scenario.attacker,
            effectiveness: result.scenario.effectiveness,
            weatherMod: result.scenario.weatherMod,
            weather: result.understood?.weather,
            attackerBoosts: result.scenario.attackerBoosts,
            defenderBoosts: result.scenario.defenderBoosts,
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

  /**
   * Split the answer so the "under <weather>" phrase can be highlighted.
   * Returns plain chunks plus the weather chunk (flagged) in reading order.
   */
  protected textSegments(
    m: ChatMessage,
  ): { text: string; weather?: Weather }[] {
    if (!m.weather) {
      return [{ text: m.text }];
    }
    const phrase = WEATHER_PHRASE[m.weather];
    const idx = m.text.toLowerCase().indexOf(phrase);
    if (idx < 0) {
      return [{ text: m.text }];
    }
    const segments: { text: string; weather?: Weather }[] = [];
    if (idx > 0) segments.push({ text: m.text.slice(0, idx) });
    segments.push({
      text: m.text.slice(idx, idx + phrase.length),
      weather: m.weather,
    });
    const rest = m.text.slice(idx + phrase.length);
    if (rest) segments.push({ text: rest });
    return segments;
  }

  /** Human label for a type-effectiveness multiplier, or null when neutral. */
  protected effLabel(effectiveness?: number): string | null {
    if (effectiveness == null || effectiveness === 1) {
      return null;
    }
    if (effectiveness === 0) return '0×';
    if (effectiveness === 0.25) return '¼×';
    if (effectiveness === 0.5) return '½×';
    return `${effectiveness}×`;
  }

  /** Weather damage swing as a signed percent ("+50%" / "−50%"), or null. */
  protected weatherModLabel(mod?: number): string | null {
    if (mod == null || mod === 1) {
      return null;
    }
    const pct = Math.round(Math.abs(mod - 1) * 100);
    return `${mod > 1 ? '+' : '−'}${pct}%`;
  }

  /** "−1 Atk" / "+2 Spe, −1 Def", or null when there are no stat changes. */
  protected boostLabel(boosts?: BoostSpread): string | null {
    if (!boosts) return null;
    const names: Record<string, string> = {
      atk: 'Atk',
      def: 'Def',
      spa: 'SpA',
      spd: 'SpD',
      spe: 'Spe',
    };
    const parts = Object.keys(names)
      .filter((stat) => boosts[stat as keyof BoostSpread])
      .map((stat) => {
        const n = boosts[stat as keyof BoostSpread]!;
        return `${n > 0 ? '+' : '−'}${Math.abs(n)} ${names[stat]}`;
      });
    return parts.length > 0 ? parts.join(', ') : null;
  }

  /** Sign of the net stat change, for badge coloring (-1, 0, +1). */
  protected boostSign(boosts?: BoostSpread): number {
    if (!boosts) return 0;
    const total = Object.values(boosts).reduce(
      (sum, n) => sum + (n ?? 0),
      0,
    );
    return Math.sign(total);
  }

  private verdictFor(result: AskResult, guaranteedOHKO?: boolean): Verdict {
    const weather = result.understood?.weather;
    // Strip a leading weather scene-setter ("In the rain, yes — …") so the
    // yes/no read isn't fooled by the prefix.
    const head = result.answer
      .trim()
      .toLowerCase()
      .replace(/^in the (rain|sun|sandstorm|snow),\s*/, '');
    if (head.startsWith('no') || guaranteedOHKO) {
      return 'ko';
    }
    if (head.startsWith('yes')) {
      // A clean survival that only holds because of the stated weather.
      return weather ? 'situational' : 'survives';
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
