import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuditLogService } from '../../core/services/audit-log.service';
import { ToastService } from '../../core/services/toast.service';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { AuditLogEntry } from '../../core/models/audit-log.model';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [FormsModule, DatePipe, PaginationComponent],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.scss',
})
export class AuditLogComponent {
  private auditLogService = inject(AuditLogService);
  private toast = inject(ToastService);

  logs = signal<AuditLogEntry[]>([]);
  totalLogs = signal(0);
  page = signal(1);
  totalPages = signal(1);
  isLoading = signal(true);
  entityFilter = signal('');

  constructor() {
    this.fetch();
  }

  fetch(): void {
    this.isLoading.set(true);
    this.auditLogService
      .list({ entityType: this.entityFilter() || undefined, page: this.page(), limit: PAGE_SIZE })
      .subscribe({
        next: (res) => {
          this.logs.set(res.logs);
          this.totalLogs.set(res.total);
          this.totalPages.set(res.pages || 1);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.toast.error('Could not load activity log');
        },
      });
  }

  onFilterChange(): void {
    this.page.set(1);
    this.fetch();
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.fetch();
  }
}
