import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavComponent } from '../nav/nav.component';
import { ApiService } from '../../core/services/api.service';
import type { Property } from '../../core/models/relocation.models';

function formatRent(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

@Component({
  selector: 'app-property',
  standalone: true,
  imports: [NavComponent],
  templateUrl: './property.component.html',
  styleUrl: './property.component.scss',
})
export class PropertyComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);

  property = signal<Property | null>(null);
  formatRent = formatRent;

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.property.set(await this.api.getProperty(id));
  }
}
