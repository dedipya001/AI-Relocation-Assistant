import { Component, inject, signal, OnInit } from '@angular/core';
import { SearchStoreService } from '../../core/services/search-store.service';
import { NavComponent } from '../nav/nav.component';
import { RelocationMapComponent } from '../map/relocation-map.component';
import { AIPanelComponent } from '../ai-panel/ai-panel.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [NavComponent, RelocationMapComponent, AIPanelComponent],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
})
export class SearchComponent implements OnInit {
  store = inject(SearchStoreService);
  activeIndex = signal(0);

  ngOnInit(): void {
    if (!this.store.response()) {
      void this.store.runSearch();
    }
  }
}
