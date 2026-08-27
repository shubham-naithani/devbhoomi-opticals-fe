import { Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { MarketingService, SendRecipient } from '../../../core/services/marketing.service';
import { ToastService } from '../../../core/services/toast.service';
import { Lead } from '../../../core/models/lead.model';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { SendCouponModalComponent } from '../send-coupon-modal/send-coupon-modal.component';

@Component({
  selector: 'app-new-customers-tab',
  standalone: true,
  imports: [DatePipe, PaginationComponent, SendCouponModalComponent],
  templateUrl: './new-customers-tab.component.html',
  styleUrl: './new-customers-tab.component.scss',
})
export class NewCustomersTabComponent {
  private marketingService = inject(MarketingService);
  private toast = inject(ToastService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  leads = signal<Lead[]>([]);
  total = signal(0);
  page = signal(1);
  pageSize = signal(10);
  totalPages = signal(1);
  isLoading = signal(true);
  isUploading = signal(false);
  searchTerm = signal('');

  selectedIds = signal<Set<string>>(new Set());
  isSendModalOpen = signal(false);

  selectedCount = computed(() => this.selectedIds().size);
  allOnPageSelected = computed(() => {
    const leads = this.leads();
    return (
      leads.length > 0 && leads.every((l) => this.selectedIds().has(l._id))
    );
  });

  // NEW — this tab is never destroyed (Marketing's tab strip toggles visibility with
  // CSS, not @if), and fetch() is called on every tab-switch-in, search keystroke, and
  // page change with no cancellation. Without tracking the in-flight request, an older,
  // slower-to-resolve fetch can resolve AFTER a newer one and silently overwrite fresher
  // data with stale data — no visible cause, looks exactly like a random flicker. Calling
  // .unsubscribe() on a pending HttpClient request actually aborts it client-side, so the
  // stale response's next() callback never fires once a newer fetch has started.
  private fetchSub?: Subscription;

  constructor() {
    this.fetch();
  }

  fetch(): void {
    this.isLoading.set(true);
    this.fetchSub?.unsubscribe();
    this.fetchSub = this.marketingService
      .listLeads({
        search: this.searchTerm() || undefined,
        page: this.page(),
        limit: this.pageSize(),
      })
      .subscribe({
        next: (res) => {
          this.leads.set(res.leads || []);
          this.total.set(res.total);
          this.totalPages.set(res.pages || 1);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.toast.error('Could not load leads');
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

  triggerFilePicker(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.isUploading.set(true);
    this.marketingService.uploadLeads(file).subscribe({
      next: (res) => {
        this.isUploading.set(false);
        this.fileInput.nativeElement.value = '';
        const createdCount = res.created?.length || 0;
        const skippedCount = res.skipped?.length || 0;
        if (skippedCount === 0) {
          this.toast.success(
            `${createdCount} lead${createdCount === 1 ? '' : 's'} added`,
          );
        } else {
          this.toast.success(
            `${createdCount} added, ${skippedCount} skipped — see browser console for reasons`,
          );
          console.table(res.skipped);
        }
        this.page.set(1);
        this.fetch();
      },
      error: (err) => {
        this.isUploading.set(false);
        this.fileInput.nativeElement.value = '';
        this.toast.error(err?.error?.message || 'Could not upload file');
      },
    });
  }

  toggle(id: string): void {
    const next = new Set(this.selectedIds());
    next.has(id) ? next.delete(id) : next.add(id);
    this.selectedIds.set(next);
  }

  toggleAllOnPage(): void {
    const next = new Set(this.selectedIds());
    if (this.allOnPageSelected()) {
      this.leads().forEach((l) => next.delete(l._id));
    } else {
      this.leads().forEach((l) => next.add(l._id));
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

  get selectedRecipients(): SendRecipient[] {
    const ids = this.selectedIds();
    return this.leads()
      .filter((l) => ids.has(l._id))
      .map((l) => ({
        type: 'lead' as const,
        name: `${l.firstName} ${l.lastName}`.trim(),
        phone: l.phone,
        email: l.email,
      }));
  }

  onSent(): void {
    this.closeSendModal();
    this.clearSelection();
    // NEW — a successful send changes the very "Contacted"/converted status this tab
    // just added, so refetch immediately instead of waiting for the next tab-switch to
    // (accidentally) show the right thing.
    this.fetch();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
    this.fetch();
  }
}
