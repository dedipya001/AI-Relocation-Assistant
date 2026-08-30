import { Component } from '@angular/core';
import { NavComponent } from '../nav/nav.component';
import { ChatPanelComponent } from '../chat-panel/chat-panel.component';
import { RelocationMapComponent } from '../map/relocation-map.component';

@Component({
  selector: 'app-assistant',
  standalone: true,
  imports: [NavComponent, ChatPanelComponent, RelocationMapComponent],
  templateUrl: './assistant.component.html',
  styleUrl: './assistant.component.scss',
})
export class AssistantComponent {}
