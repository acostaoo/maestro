import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AskService } from '../ask.service';

interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  details?: string[];
  error?: boolean;
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
        this.messages.update((m) => [
          ...m,
          { role: 'bot', text: result.answer, details: result.details },
        ]);
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

  private errorMessage(err: unknown): string {
    const e = err as { error?: { message?: string }; status?: number };
    if (e?.status === 0) {
      return 'Can\u2019t reach the server. Is the backend running on :3000?';
    }
    return e?.error?.message ?? 'Something went wrong.';
  }
}
