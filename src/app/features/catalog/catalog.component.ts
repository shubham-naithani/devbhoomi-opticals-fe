import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../core/services/inventory.service';
import { CartService } from '../../core/services/cart.service';
import { ToastService } from '../../core/services/toast.service';
import { InventoryItem } from '../../core/models/inventory.model';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.scss',
})
export class CatalogComponent {
  private inventoryService = inject(InventoryService);
  private toast = inject(ToastService);
  cart = inject(CartService);

  items = signal<InventoryItem[]>([]);
  isLoading = signal(true);

  searchTerm = signal('');
  category = signal('');
  gender = signal('');

  constructor() {
    this.fetch();
  }

  fetch(): void {
    this.isLoading.set(true);
    this.inventoryService
      .list({
        search: this.searchTerm() || undefined,
        category: this.category() || undefined,
        gender: this.gender() || undefined,
        limit: 50,
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.items || []);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.toast.error('Could not load the catalog');
        },
      });
  }

  onFilterChange(): void {
    this.fetch();
  }

  addToCart(item: InventoryItem): void {
    if (item.stock <= 0) {
      this.toast.error('This item is currently out of stock');
      return;
    }
    this.cart.add(item, 1);
    this.toast.success(`${item.name} added to cart`);
  }
}
