import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
  private route = inject(ActivatedRoute);

  // Defaults to 'new', but a "?tab=repair" query param lands directly on
  // Repair — used by the per-item "Repair" button on the Orders detail
  // panel (admin-orders.component's repairItem()) so staff don't have to
  // click the tab themselves after being sent here.
  activeTab = signal<Tab>(
    this.route.snapshot.queryParamMap.get('tab') === 'repair' ? 'repair' : 'new',
  );

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }
}
