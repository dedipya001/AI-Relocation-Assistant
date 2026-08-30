import { Component, Input, Output, EventEmitter, signal, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { Property, Recommendation } from '../../core/models/relocation.models';

const AMENITY_LABELS: Record<string, string> = {
  'high-speed internet': 'WiFi', internet: 'WiFi', wifi: 'WiFi',
  gym: 'Gym', metro: 'Metro', parking: 'Parking',
  security: 'Secure', '24/7 security': 'Secure', pool: 'Pool',
  'power backup': 'Backup', 'swimming pool': 'Pool',
  'modular kitchen': 'Kitchen',
  '1bhk':'1BHK','2bhk':'2BHK','3bhk':'3BHK','4bhk':'4BHK',
  '1 bhk':'1BHK','2 bhk':'2BHK','3 bhk':'3BHK','4 bhk':'4BHK',
};
const SKIP_TAGS = new Set([
  'magicbricks','housing.com','99acres','nobroker','housing','makaan',
  'dataset-imported','scraped','api-imported','no data','n/a','na',
  'furnished','unfurnished','semi-furnished','semi furnished',
  'fully furnished','partially furnished',
]);

function labelAmenity(raw: string): string {
  return AMENITY_LABELS[raw.toLowerCase()] ?? raw;
}

@Component({
  selector: 'app-property-card',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './property-card.component.html',
  styleUrl: './property-card.component.scss',
})
export class PropertyCardComponent implements OnInit {
  @Input({ required: true }) property!: Property;
  @Input() recommendation?: Recommendation;
  @Input() index?: number;
  @Input() isActive = false;
  @Output() onClick = new EventEmitter<void>();

  showModal = signal(false);

  get totalScore(): number | null { return this.recommendation?.score?.total ?? null; }
  get priceK(): number { return Math.round(this.property.rent / 1000); }
  get violations(): string[] { return this.recommendation?.constraint_violations ?? []; }
  get isIneligible(): boolean { return this.recommendation?.is_eligible === false; }
  get highlights(): string[] { return this.recommendation?.highlights ?? []; }
  get tradeoffs(): string[] { return this.recommendation?.tradeoffs ?? []; }

  get amenityTags(): string[] {
    return this.property.amenities
      .filter((a) => !SKIP_TAGS.has(a.toLowerCase()) && a.length > 1 && a.length < 28)
      .slice(0, 3)
      .map(labelAmenity);
  }

  get scorePillClass(): string {
    const s = this.totalScore ?? 0;
    if (s >= 85) return 'score-pill score-high';
    if (s >= 72) return 'score-pill score-mid';
    if (s >= 60) return 'score-pill score-fair';
    return 'score-pill score-low';
  }

  get scoreColor(): string {
    const s = this.totalScore ?? 0;
    if (s >= 85) return '#10b981';
    if (s >= 72) return '#38bdf8';
    if (s >= 60) return '#f59e0b';
    return '#f43f5e';
  }

  get subscores(): Array<{key:string; label:string; score:number; weight:number; contribution:number; details:string}> {
    const ss = this.recommendation?.score?.subscores;
    if (!ss) return [];
    return Object.entries(ss).map(([key, d]) => ({ key, ...d }));
  }

  getColor(score: number): string {
    if (score >= 85) return '#10b981';
    if (score >= 72) return '#38bdf8';
    if (score >= 60) return '#f59e0b';
    return '#f43f5e';
  }

  openModal(e: Event): void {
    e.stopPropagation();
    this.showModal.set(true);
  }

  ngOnInit(): void {}
}
