import { Component, inject, signal } from '@angular/core';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RepairService } from '../../core/services/repair.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { RepairStatus, RepairTicket } from '../../core/models/repair.model';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-repairs',
  standalone: true,
  imports: [FormsModule, DatePipe, UpperCasePipe, PaginationComponent],
  templateUrl: './repairs.component.html',
  styleUrl: './repairs.component.scss',
})
export class RepairsComponent {
  private repairService = inject(RepairService);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);
  auth = inject(AuthService);

  private readonly statusTransitions: Record<RepairStatus, RepairStatus[]> = {
    received: ['in_progress', 'cancelled'],
    in_progress: ['ready_for_pickup', 'cancelled'],
    ready_for_pickup: ['collected', 'cancelled'],
    collected: [],
    cancelled: [],
  };

  private readonly statusLabels: Record<RepairStatus, string> = {
    received: 'Received',
    in_progress: 'In progress',
    ready_for_pickup: 'Ready to pick up',
    collected: 'Collected',
    cancelled: 'Cancelled',
  };

  statusOptions: RepairStatus[] = ['received', 'in_progress', 'ready_for_pickup', 'collected', 'cancelled'];

  tickets = signal<RepairTicket[]>([]);
  totalTickets = signal(0);
  page = signal(1);
  totalPages = signal(1);
  isLoading = signal(true);
  statusFilter = signal('');
  searchTerm = signal('');
  updatingId = signal<string | null>(null);

  selectedTicket = signal<RepairTicket | null>(null);
  isPanelLoading = signal(false);

  constructor() {
    this.fetch();
  }

  fetch(): void {
    this.isLoading.set(true);
    this.repairService
      .all({
        status: this.statusFilter() || undefined,
        search: this.searchTerm() || undefined,
        page: this.page(),
        limit: PAGE_SIZE,
      })
      .subscribe({
        next: (res) => {
          this.tickets.set(res.tickets);
          this.totalTickets.set(res.total);
          this.totalPages.set(res.pages || 1);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.toast.error('Could not load repair tickets');
        },
      });
  }

  statusLabel(status: RepairStatus): string {
    return this.statusLabels[status] || status;
  }

  allowedNextStatuses(ticket: RepairTicket): RepairStatus[] {
    const next = this.statusTransitions[ticket.status] || [];
    return [ticket.status, ...next];
  }

  isTerminalStatus(status: RepairStatus): boolean {
    return (this.statusTransitions[status] || []).length === 0;
  }

  onFilterChange(): void {
    this.page.set(1);
    this.fetch();
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.page.set(1);
    this.fetch();
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.fetch();
  }

  customerName(ticket: RepairTicket): string {
    return typeof ticket.customer === 'object' ? ticket.customer.name : 'Unknown';
  }

  customerContact(ticket: RepairTicket): string {
    return typeof ticket.customer === 'object' ? ticket.customer.phone || '' : '';
  }

  createdByName(ticket: RepairTicket): string {
    return ticket.createdBy && typeof ticket.createdBy === 'object' ? ticket.createdBy.name : '';
  }

  linkedOrderNumber(ticket: RepairTicket): string {
    return ticket.linkedOrderId && typeof ticket.linkedOrderId === 'object' ? ticket.linkedOrderId.orderId : '';
  }

  changeStatus(ticket: RepairTicket, status: RepairStatus): void {
    if (status === ticket.status) return;
    this.updatingId.set(ticket._id);

    this.repairService.updateStatus(ticket._id, status).subscribe({
      next: (res) => {
        this.tickets.update((list) => list.map((t) => (t._id === ticket._id ? res.ticket : t)));
        this.updatingId.set(null);
        this.toast.success('Repair status updated');
      },
      error: (err) => {
        this.updatingId.set(null);
        this.toast.error(err?.error?.message || 'Could not update status');
      },
    });
  }

  openDetail(ticket: RepairTicket): void {
    this.isPanelLoading.set(true);
    this.selectedTicket.set(ticket);

    this.repairService.getById(ticket._id).subscribe({
      next: (res) => {
        this.selectedTicket.set(res.ticket);
        this.isPanelLoading.set(false);
      },
      error: () => {
        this.isPanelLoading.set(false);
        this.toast.error('Could not load full ticket details');
      },
    });
  }

  closeDetail(): void {
    this.selectedTicket.set(null);
  }

  async deleteTicket(ticket: RepairTicket): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete this repair ticket?',
      message: `Delete ${ticket.repairId}? This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    this.repairService.remove(ticket._id).subscribe({
      next: () => {
        this.toast.success('Repair ticket deleted');
        this.tickets.update((list) => list.filter((t) => t._id !== ticket._id));
        if (this.selectedTicket()?._id === ticket._id) this.closeDetail();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Could not delete ticket'),
    });
  }
}
