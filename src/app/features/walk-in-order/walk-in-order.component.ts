import { Component, signal } from '@angular/core';
import { NewOrderComponent } from './new-order/new-order.component';
import { RepairOrderComponent } from './repair-order/repair-order.component';

type Tab = 'new' | 'repair';

@Component({
  selector: 'app-walk-in-order',
  standalone: true,
  imports: [NewOrderComponent, RepairOrderComponent],
  templateUrl: './walk-in-order.component.html',
  styleUrl: './walk-in-order.component.scss',
})
export class WalkInOrderComponent {
  activeTab = signal<Tab>('new');

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }
}
