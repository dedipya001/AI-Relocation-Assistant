import { Component, inject } from '@angular/core';
import { SearchStoreService } from '../../core/services/search-store.service';
import type { ScoringProfile } from '../../core/models/relocation.models';

interface PersonaOption {
  id: ScoringProfile;
  label: string;
  icon: string;
  hint: string;
}

const PERSONAS: PersonaOption[] = [
  { id: 'balanced',         label: 'Balanced',     icon: '✦', hint: 'Even balance of rent, commute & livability' },
  { id: 'tech_professional',label: 'Tech Pro',     icon: '💻', hint: 'Short commute & gigabit internet priority' },
  { id: 'budget_saver',     label: 'Budget Saver', icon: '₹', hint: 'Maximum rent savings & value focus' },
  { id: 'safety_priority',  label: 'Safety First', icon: '🛡', hint: 'Women safety & late-night security priority' },
  { id: 'family_first',     label: 'Family',       icon: '🏠', hint: 'Spacious apartments, safety & grocery access' },
  { id: 'night_owl',        label: 'Night Owl',    icon: '🌙', hint: 'Late-night safety & 24/7 food access' },
];

@Component({
  selector: 'app-persona-selector',
  standalone: true,
  templateUrl: './persona-selector.component.html',
  styleUrl: './persona-selector.component.scss',
})
export class PersonaSelectorComponent {
  store = inject(SearchStoreService);
  personas = PERSONAS;

  get activeHint(): string {
    return PERSONAS.find((p) => p.id === this.store.selectedProfile())?.hint ?? '';
  }

  select(id: ScoringProfile): void {
    void this.store.setSelectedProfile(id);
  }
}
