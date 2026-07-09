import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { InventoryService } from '../../core/services/inventory.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  auth = inject(AuthService);
  private userService = inject(UserService);
  private inventoryService = inject(InventoryService);

  totalUsers = signal<number | null>(null);
  totalInventory = signal<number | null>(null);
  lowStockCount = signal<number | null>(null);

  constructor() {
    if (this.auth.isAdmin()) {
      this.userService.list({ limit: 1 }).subscribe((res) => this.totalUsers.set(res.total));
      this.inventoryService.list({ limit: 1 }).subscribe((res) => this.totalInventory.set(res.total));
      // A simple heuristic view of low stock — the inventory list screen has full filtering.
      this.inventoryService.list({ limit: 100 }).subscribe((res) => {
        const low = (res.items || []).filter((i) => i.stock <= 5).length;
        this.lowStockCount.set(low);
      });
    }
  }
}
