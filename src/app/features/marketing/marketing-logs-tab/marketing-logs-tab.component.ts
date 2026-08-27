import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MarketingService } from '../../../core/services/marketing.service';
import { ToastService } from '../../../core/services/toast.service';
import { MarketingLogEntry } from '../../../core/models/marketing-log.model';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-marketing-logs-tab',
  standalone: true,
  imports: [DatePipe, PaginationComponent],
  templateUrl: './marketing-logs-tab.component.html',
  styleUrl: './marketing-logs-tab.component.scss',
})
export class MarketingLogsTabComponent {
  private marketingService = inject(MarketingService);
  private toast = inject(ToastService);

  logs = signal<MarketingLogEntry[]>([]);
  total = signal(0);
  page = signal(1);
  totalPages = signal(1);
  pageSize = signal(10);
  isLoading = signal(true);

  constructor() {
    this.fetch();
  }

  fetch(): void {
    this.isLoading.set(true);
    this.marketingService
      .getLogs({ page: this.page(), limit: this.pageSize() })
      .subscribe({
        next: (res) => {
          this.logs.set(res.logs || []);
          this.total.set(res.total);
          this.totalPages.set(res.pages || 1);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.toast.error('Could not load marketing logs');
        },
      });
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.fetch();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
    this.fetch();
  }
}
