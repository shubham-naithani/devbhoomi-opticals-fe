import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  template: `
    @if (totalPages() > 1) {
      <div class="pagination">
        <div class="range">
          Showing {{ rangeStart() }}–{{ rangeEnd() }} of {{ totalItems() }}
        </div>
        <div class="controls">
          <button class="btn btn-ghost" [disabled]="page() <= 1" (click)="pageChange.emit(page() - 1)">
            ‹ Prev
          </button>
          <span class="page-indicator">Page {{ page() }} of {{ totalPages() }}</span>
          <button class="btn btn-ghost" [disabled]="page() >= totalPages()" (click)="pageChange.emit(page() + 1)">
            Next ›
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    .pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 4px 4px;
      flex-wrap: wrap;
      gap: 10px;
    }
    .range {
      font-size: 13px;
      color: var(--color-text-muted);
    }
    .controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .page-indicator {
      font-size: 13px;
      color: var(--color-text-muted);
      font-weight: 600;
      white-space: nowrap;
    }
    .btn {
      padding: 7px 14px;
      font-size: 13px;
    }
  `],
})
export class PaginationComponent {
  page = input.required<number>();
  totalPages = input.required<number>();
  totalItems = input<number>(0);
  pageSize = input<number>(10);

  pageChange = output<number>();

  rangeStart = computed(() => (this.page() - 1) * this.pageSize() + 1);
  rangeEnd = computed(() => Math.min(this.page() * this.pageSize(), this.totalItems()));
}
