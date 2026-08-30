import { Component, inject, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SearchStoreService } from '../../core/services/search-store.service';

const SUGGESTED_PROMPTS = [
  'Office is Candor TechSpace Gate 2. Keep commute under 20 mins and rent under 35k.',
  'I want a calmer neighborhood than New Town with good cafes and metro access.',
  'Show furnished 1BHK/2BHK options with reliable internet and lower evening traffic.',
];

@Component({
  selector: 'app-search-box',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './search-box.component.html',
  styleUrl: './search-box.component.scss',
})
export class SearchBoxComponent {
  store = inject(SearchStoreService);
  readonly prompts = SUGGESTED_PROMPTS;
  @Input() compact = false;

  get queryModel(): string { return this.store.query(); }
  set queryModel(v: string) { this.store.setQuery(v); }

  setPrompt(p: string): void { this.store.setQuery(p); }

  onEnter(e: Event): void {
    if (!(e as KeyboardEvent).shiftKey) { e.preventDefault(); this.onSubmit(); }
  }

  onSubmit(): void { void this.store.runSearch(); }
}
