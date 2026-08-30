import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavComponent } from '../nav/nav.component';
import { RelocationMapComponent } from '../map/relocation-map.component';
import { SearchBoxComponent } from '../search/search-box.component';

const SIGNALS = [
  { label: 'Commute reliability', icon: '📍', value: 'Peak-aware' },
  { label: 'Actual rent',         icon: '🏢', value: 'Crowdsourced' },
  { label: 'Women safety',        icon: '🛡',  value: 'Scored' },
  { label: 'Internet quality',    icon: '📶', value: 'Tracked' },
];

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, NavComponent, RelocationMapComponent, SearchBoxComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  signals = SIGNALS;
}
