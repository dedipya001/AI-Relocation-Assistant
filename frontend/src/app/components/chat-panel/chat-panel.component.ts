import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

type Message = { role: 'user' | 'assistant'; content: string };

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './chat-panel.component.html',
  styleUrl: './chat-panel.component.scss',
})
export class ChatPanelComponent {
  private api = inject(ApiService);

  messages = signal<Message[]>([
    { role: 'assistant', content: 'Tell me your office location, budget, commute preference, and what kind of life you want nearby.' },
  ]);
  input = 'Need PG near office with metro connectivity and safe late-night commute.';
  isLoading = signal(false);

  async onSubmit(): Promise<void> {
    const text = this.input.trim();
    if (!text) return;
    this.messages.update((prev) => [...prev, { role: 'user', content: text }]);
    this.input = '';
    this.isLoading.set(true);
    try {
      const res = await this.api.chat(text);
      this.messages.update((prev) => [...prev, { role: 'assistant', content: res.answer }]);
    } finally {
      this.isLoading.set(false);
    }
  }
}
