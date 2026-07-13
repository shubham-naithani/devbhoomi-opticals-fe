import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuditLogService } from '../../core/services/audit-log.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditLogEntry } from '../../core/models/audit-log.model';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.scss',
})
export class AuditLogComponent {
  private auditLogService = inject(AuditLogService);
  private toast = inject(ToastService);

  logs = signal<AuditLogEntry[]>([]);
  isLoading = signal(true);
  entityFilter = signal('');

  constructor() {
    this.fetch();
  }

  fetch(): void {
    this.isLoading.set(true);
    this.auditLogService.list({ entityType: this.entityFilter() || undefined, limit: 50 }).subscribe({
      next: (res) => {
        this.logs.set(res.logs);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.toast.error('Could not load activity log');
      },
    });
  }

  onFilterChange(): void {
    this.fetch();
  }
}
