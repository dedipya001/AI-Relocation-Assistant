import { Component } from '@angular/core';
import { NavComponent } from '../nav/nav.component';

const ROWS = [
  ['Sector V',  '78', '8 min',  'Rs 9.5k',  '86', 'Best for shortest commute'],
  ['New Town',  '82', '28 min', 'Rs 14.5k', '84', 'Best value and newer housing'],
  ['Lake Town', '76', '38 min', 'Rs 11k',   '78', 'Best calmer residential feel'],
];

@Component({
  selector: 'app-compare',
  standalone: true,
  imports: [NavComponent],
  templateUrl: './compare.component.html',
  styleUrl: './compare.component.scss',
})
export class CompareComponent {
  rows = ROWS;
}
