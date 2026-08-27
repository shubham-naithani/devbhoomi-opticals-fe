import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  template: `
    @if (totalItems() > 0) {
      <div class="pagination">
        <div class="range">
          Showing {{ rangeStart() }}–{{ rangeEnd() }} of {{ totalItems() }}
        </div>
        <div class="controls">
          <label class="page-size-label">
            Per page
            <select
              class="page-size-select"
              (change)="pageSizeChange.emit(+$any($event.target).value)"
            >
              @for (size of pageSizeOptions(); track size) {
                <option [value]="size" [selected]="size === pageSize()">
                  {{ size }}
                </option>
              }
            </select>
          </label>
          @if (totalPages() > 1) {
            <button
              class="btn btn-ghost"
              [disabled]="page() <= 1"
              (click)="pageChange.emit(page() - 1)"
            >
              ‹ Prev
            </button>
            <span class="page-indicator"
              >Page {{ page() }} of {{ totalPages() }}</span
            >
            <button
              class="btn btn-ghost"
              [disabled]="page() >= totalPages()"
              (click)="pageChange.emit(page() + 1)"
            >
              Next ›
            </button>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
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
        gap: 14px;
        flex-wrap: wrap;
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
      .page-size-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--color-text-muted);
        padding-right: 4px;
        border-right: 1px solid var(--color-border);
      }
      .page-size-select {
        padding: 6px 10px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        font-size: 13px;
        font-family: inherit;
        color: inherit;
        background: #fff;
        cursor: pointer;
        min-width: 60px;

        &:hover {
          border-color: var(--color-primary);
        }
        &:focus {
          outline: none;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(31, 78, 92, 0.12);
        }
      }
    `,
  ],
})
export class PaginationComponent {
  page = input.required<number>();
  totalPages = input.required<number>();
  totalItems = input<number>(0);
  pageSize = input<number>(10);
  pageSizeOptions = input<number[]>([5, 10, 20, 50, 100]);

  pageChange = output<number>();
  pageSizeChange = output<number>();

  rangeStart = computed(() => (this.page() - 1) * this.pageSize() + 1);
  rangeEnd = computed(() =>
    Math.min(this.page() * this.pageSize(), this.totalItems()),
  );
}
