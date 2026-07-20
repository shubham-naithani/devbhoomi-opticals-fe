import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TransactionService } from '../../core/services/transaction.service';
import { Transaction, PnlSummary } from '../../core/models/transaction.model';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

const PAGE_SIZE = 20;

type RangePreset = 'today' | 'week' | 'month' | 'custom';

@Component({
  selector: 'app-pnl',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    DecimalPipe,
    UpperCasePipe,
    PaginationComponent,
  ],
  templateUrl: './pnl.component.html',
  styleUrl: './pnl.component.scss',
})
export class PnlComponent {
  private transactionService = inject(TransactionService);

  rangePreset = signal<RangePreset>('month');
  customFrom = signal('');
  customTo = signal('');
  searchTerm = signal('');

  summary = signal<PnlSummary | null>(null);
  isLoadingSummary = signal(true);

  transactions = signal<Transaction[]>([]);
  totalTransactions = signal(0);
  page = signal(1);
  totalPages = signal(1);
  isLoadingList = signal(true);
  typeFilter = signal('');

  constructor() {
    this.fetchAll();
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.page.set(1);
    this.fetchTransactions();
  }

  private getRange(): { from?: string; to?: string } {
    const now = new Date();
    if (this.rangePreset() === 'custom') {
      return {
        from: this.customFrom() || undefined,
        to: this.customTo() || undefined,
      };
    }
    let from: Date;
    if (this.rangePreset() === 'today') {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (this.rangePreset() === 'week') {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      from.setDate(from.getDate() - from.getDay());
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return { from: from.toISOString(), to: now.toISOString() };
  }

  onRangeChange(): void {
    this.page.set(1);
    this.fetchAll();
  }

  fetchAll(): void {
    this.fetchSummary();
    this.fetchTransactions();
  }

  fetchSummary(): void {
    this.isLoadingSummary.set(true);
    this.transactionService.pnl(this.getRange()).subscribe({
      next: (data) => {
        this.summary.set(data);
        this.isLoadingSummary.set(false);
      },
      error: () => this.isLoadingSummary.set(false),
    });
  }

  fetchTransactions(): void {
    this.isLoadingList.set(true);
    const range = this.getRange();
    this.transactionService
      .list({
        ...range,
        type: this.typeFilter() || undefined,
        search: this.searchTerm() || undefined,
        page: this.page(),
        limit: PAGE_SIZE,
      })
      .subscribe({
        next: (res) => {
          this.transactions.set(res.transactions);
          this.totalTransactions.set(res.total);
          this.totalPages.set(res.pages || 1);
          this.isLoadingList.set(false);
        },
        error: () => this.isLoadingList.set(false),
      });
  }

  onTypeFilterChange(): void {
    this.page.set(1);
    this.fetchTransactions();
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.fetchTransactions();
  }
}
