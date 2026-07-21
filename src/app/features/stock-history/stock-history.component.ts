import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockMovementService } from '../../core/services/stock-movement.service';
import { StockMovement } from '../../core/models/stock-movement.model';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

const PAGE_SIZE = 30;

@Component({
  selector: 'app-stock-history',
  standalone: true,
  imports: [FormsModule, DatePipe, PaginationComponent],
  templateUrl: './stock-history.component.html',
  styleUrl: './stock-history.component.scss',
})
export class StockHistoryComponent {
  private stockMovementService = inject(StockMovementService);

  movements = signal<StockMovement[]>([]);
  totalMovements = signal(0);
  page = signal(1);
  totalPages = signal(1);
  isLoading = signal(true);

  searchTerm = signal('');
  typeFilter = signal('');
  fromDate = signal('');
  toDate = signal('');

  readonly typeOptions: { value: StockMovement['type']; label: string }[] = [
    { value: 'sale', label: 'Sale' },
    { value: 'restock_cancelled', label: 'Restock (cancelled order)' },
    { value: 'purchase_in', label: 'Purchase received' },
    { value: 'manual_adjustment', label: 'Manual adjustment' },
  ];

  private readonly typeLabelMap: Record<string, string> = Object.fromEntries(
    this.typeOptions.map((o) => [o.value, o.label])
  );

  constructor() {
    this.fetch();
  }

  fetch(): void {
    this.isLoading.set(true);
    this.stockMovementService
      .list({
        search: this.searchTerm() || undefined,
        type: this.typeFilter() || undefined,
        from: this.fromDate() || undefined,
        to: this.toDate() || undefined,
        page: this.page(),
        limit: PAGE_SIZE,
      })
      .subscribe({
        next: (res) => {
          this.movements.set(res.movements || []);
          this.totalMovements.set(res.total);
          this.totalPages.set(res.pages || 1);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.page.set(1);
    this.fetch();
  }

  onFilterChange(): void {
    this.page.set(1);
    this.fetch();
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.fetch();
  }

  typeLabel(type: string): string {
    return this.typeLabelMap[type] || type;
  }
}
