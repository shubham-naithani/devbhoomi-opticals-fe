import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ErrorLogService } from '../../core/services/error-log.service';
import { ErrorLog } from '../../core/models/error-log.model';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

const PAGE_SIZE = 30;

@Component({
  selector: 'app-error-log',
  standalone: true,
  imports: [FormsModule, DatePipe, PaginationComponent],
  templateUrl: './error-log.component.html',
  styleUrl: './error-log.component.scss',
})
export class ErrorLogComponent {
  private errorLogService = inject(ErrorLogService);

  logs = signal<ErrorLog[]>([]);
  totalLogs = signal(0);
  page = signal(1);
  totalPages = signal(1);
  isLoading = signal(true);

  searchTerm = signal('');
  sourceFilter = signal('');
  expandedId = signal<string | null>(null);

  constructor() {
    this.fetch();
  }

  fetch(): void {
    this.isLoading.set(true);
    this.errorLogService
      .list({ search: this.searchTerm() || undefined, source: this.sourceFilter() || undefined, page: this.page(), limit: PAGE_SIZE })
      .subscribe({
        next: (res) => {
          this.logs.set(res.logs || []);
          this.totalLogs.set(res.total);
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

  toggleExpand(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }
}
