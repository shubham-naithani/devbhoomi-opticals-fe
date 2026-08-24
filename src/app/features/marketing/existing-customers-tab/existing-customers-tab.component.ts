import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MarketingService, SendRecipient } from '../../../core/services/marketing.service';
import { ToastService } from '../../../core/services/toast.service';
import { ExistingCustomer } from '../../../core/models/existing-customer.model';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { SendCouponModalComponent } from '../send-coupon-modal/send-coupon-modal.component';
import { ReferralCouponModalComponent } from '../referral-coupon-modal/referral-coupon-modal.component';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-existing-customers-tab',
  standalone: true,
  imports: [DatePipe, PaginationComponent, SendCouponModalComponent, ReferralCouponModalComponent],
  templateUrl: './existing-customers-tab.component.html',
  styleUrl: './existing-customers-tab.component.scss',
})
export class ExistingCustomersTabComponent {
  private marketingService = inject(MarketingService);
  private toast = inject(ToastService);

  customers = signal<ExistingCustomer[]>([]);
  total = signal(0);
  page = signal(1);
  totalPages = signal(1);
  isLoading = signal(true);
  searchTerm = signal('');

  selectedIds = signal<Set<string>>(new Set());
  isSendModalOpen = signal(false);

  // Referral coupons are generated one referrer at a time (there's no "recipients"
  // concept the way a campaign send has), so this holds the single customer row the
  // panel is currently open for rather than reusing the multi-select state above.
  referralTarget = signal<ExistingCustomer | null>(null);

  selectedCount = computed(() => this.selectedIds().size);
  allOnPageSelected = computed(() => {
    const customers = this.customers();
    return customers.length > 0 && customers.every((c) => this.selectedIds().has(c.userId));
  });

  constructor() {
    this.fetch();
  }

  fetch(): void {
    this.isLoading.set(true);
    this.marketingService
      .listExistingCustomers({ search: this.searchTerm() || undefined, page: this.page(), limit: PAGE_SIZE })
      .subscribe({
        next: (res) => {
          this.customers.set(res.customers || []);
          this.total.set(res.total);
          this.totalPages.set(res.pages || 1);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.toast.error('Could not load customers');
        },
      });
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

  toggle(id: string): void {
    const next = new Set(this.selectedIds());
    next.has(id) ? next.delete(id) : next.add(id);
    this.selectedIds.set(next);
  }

  toggleAllOnPage(): void {
    const next = new Set(this.selectedIds());
    if (this.allOnPageSelected()) {
      this.customers().forEach((c) => next.delete(c.userId));
    } else {
      this.customers().forEach((c) => next.add(c.userId));
    }
    this.selectedIds.set(next);
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  openSendModal(): void {
    this.isSendModalOpen.set(true);
  }

  closeSendModal(): void {
    this.isSendModalOpen.set(false);
  }

  openReferralModal(customer: ExistingCustomer): void {
    this.referralTarget.set(customer);
  }

  closeReferralModal(): void {
    this.referralTarget.set(null);
  }

  onReferralGenerated(): void {
    this.closeReferralModal();
    // Points balance doesn't change from generating a code (only from a friend
    // redeeming it later), but a refetch is cheap and keeps this tab honest if
    // anything else changed underneath it in the meantime.
    this.fetch();
  }

  get selectedRecipients(): SendRecipient[] {
    const ids = this.selectedIds();
    return this.customers()
      .filter((c) => ids.has(c.userId))
      .map((c) => ({ type: 'customer' as const, name: c.name, phone: c.phone, email: c.email }));
  }

  onSent(): void {
    this.closeSendModal();
    this.clearSelection();
  }
}
