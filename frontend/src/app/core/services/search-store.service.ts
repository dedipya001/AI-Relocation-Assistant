import { Injectable, signal, computed } from '@angular/core';
import { ApiService } from './api.service';
import type { SearchResponse, ScoringProfile, HardConstraints } from '../models/relocation.models';

@Injectable({ providedIn: 'root' })
export class SearchStoreService {
  // ── State signals ──────────────────────────────────────────
  readonly query = signal<string>(
    'I work in Sector V Kolkata, budget is 15k, need peaceful place, fast internet, good food nearby.'
  );
  readonly response = signal<SearchResponse | undefined>(undefined);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | undefined>(undefined);
  readonly selectedProfile = signal<ScoringProfile>('balanced');
  readonly hardConstraints = signal<Partial<HardConstraints>>({});

  // ── Derived ────────────────────────────────────────────────
  readonly hasResults = computed(() => {
    const r = this.response();
    return !!r && r.properties.length > 0 && !this.isLoading();
  });

  readonly properties = computed(() => this.response()?.properties ?? []);
  readonly recommendations = computed(() => this.response()?.recommendations ?? []);
  readonly officeCoordinates = computed(() => this.response()?.office_coordinates ?? undefined);
  readonly officeLabel = computed(() => this.response()?.intent?.filters?.office_location);

  constructor(private api: ApiService) {}

  setQuery(q: string): void {
    this.query.set(q);
  }

  async setSelectedProfile(profile: ScoringProfile): Promise<void> {
    this.selectedProfile.set(profile);
    await this.runSearch(this.query(), profile, this.hardConstraints());
  }

  async setHardConstraints(constraints: Partial<HardConstraints>): Promise<void> {
    this.hardConstraints.set(constraints);
    await this.runSearch(this.query(), this.selectedProfile(), constraints);
  }

  async runSearch(
    query?: string,
    profile?: ScoringProfile,
    constraints?: Partial<HardConstraints>
  ): Promise<void> {
    const activeQuery = query ?? this.query();
    const activeProfile = profile ?? this.selectedProfile();
    const activeConstraints = constraints ?? this.hardConstraints();

    this.isLoading.set(true);
    this.error.set(undefined);
    if (query) this.query.set(activeQuery);

    try {
      const result = await this.api.search(activeQuery, {
        profile: activeProfile,
        hard_constraints: activeConstraints,
      });
      this.response.set(result);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Search failed');
    } finally {
      this.isLoading.set(false);
    }
  }
}
