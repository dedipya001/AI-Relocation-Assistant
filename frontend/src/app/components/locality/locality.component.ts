import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavComponent } from '../nav/nav.component';
import { ApiService } from '../../core/services/api.service';
import type { Locality } from '../../core/models/relocation.models';

@Component({
  selector: 'app-locality',
  standalone: true,
  imports: [NavComponent],
  templateUrl: './locality.component.html',
  styleUrl: './locality.component.scss',
})
export class LocalityComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);

  locality = signal<Locality | null>(null);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.locality.set(await this.api.getLocality(id));
  }
}
