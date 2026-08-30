import { Component, inject, signal, computed, effect, Input, Output, EventEmitter } from '@angular/core';
import { SearchStoreService } from '../../core/services/search-store.service';
import { SearchBoxComponent } from '../search/search-box.component';
import { PersonaSelectorComponent } from '../persona-selector/persona-selector.component';
import { PropertyCardComponent } from '../property/property-card.component';
import type { Recommendation } from '../../core/models/relocation.models';

const THINKING_STAGES = [
  'Locating your office…',
  'Analyzing commute patterns…',
  'Computing multi-factor safety & internet scores…',
  'Applying persona weights & constraints…',
  'Curating explainable recommendations…',
];
const STAGE_DELAYS = [0, 600, 1300, 2100, 3000];

@Component({
  selector: 'app-ai-panel',
  standalone: true,
  imports: [SearchBoxComponent, PersonaSelectorComponent, PropertyCardComponent],
  templateUrl: './ai-panel.component.html',
  styleUrl: './ai-panel.component.scss',
})
export class AIPanelComponent {
  store = inject(SearchStoreService);

  @Input() activeIndex = 0;
  @Output() onSelect = new EventEmitter<number>();

  thinkingStage = signal(THINKING_STAGES[0]);
  private thinkingTimers: ReturnType<typeof setTimeout>[] = [];

  topProperty = computed(() => this.store.properties()[0]);
  topScore = computed(() => this.store.recommendations()[0]?.score?.total ?? null);

  private recMap = computed<Map<string, Recommendation>>(() => {
    const recs = this.store.recommendations();
    return new Map(recs.map((r: Recommendation) => [r.entity_id, r]));
  });

  constructor() {
    effect(() => {
      if (this.store.isLoading()) {
        this.thinkingTimers.forEach(clearTimeout);
        this.thinkingStage.set(THINKING_STAGES[0]);
        this.thinkingTimers = STAGE_DELAYS.slice(1).map((delay, i) =>
          setTimeout(() => this.thinkingStage.set(THINKING_STAGES[i + 1]), delay)
        );
      } else {
        this.thinkingTimers.forEach(clearTimeout);
      }
    });
  }

  getRecommendation(id: string, idx: number): Recommendation | undefined {
    return this.recMap().get(id) ?? this.store.recommendations()[idx];
  }
}
