import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CouponService } from '../../core/services/coupon.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { Coupon } from '../../core/models/coupon.model';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-coupons',
  standalone: true,
  imports: [FormsModule, DatePipe, PaginationComponent],
  templateUrl: './coupons.component.html',
  styleUrl: './coupons.component.scss',
})
export class CouponsComponent {
  private couponService = inject(CouponService);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);

  coupons = signal<Coupon[]>([]);
  totalCoupons = signal(0);
  page = signal(1);
  totalPages = signal(1);
  isLoading = signal(true);
  searchTerm = signal('');

  isCreatePanelOpen = signal(false);
  isSaving = signal(false);

  code = signal('');
  discountType = signal<'fixed' | 'percentage'>('fixed');
  value = signal<number | null>(null);
  minOrderValue = signal<number | null>(null);
  expiresAt = signal('');
  usageLimit = signal<number | null>(null);

  constructor() {
    this.fetch();
  }

  fetch(): void {
    this.isLoading.set(true);
    this.couponService.list({ search: this.searchTerm() || undefined, page: this.page(), limit: PAGE_SIZE }).subscribe({
      next: (res) => {
        this.coupons.set(res.coupons || []);
        this.totalCoupons.set(res.total);
        this.totalPages.set(res.pages || 1);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.toast.error('Could not load coupons');
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

  openCreatePanel(): void {
    this.code.set('');
    this.discountType.set('fixed');
    this.value.set(null);
    this.minOrderValue.set(null);
    this.expiresAt.set('');
    this.usageLimit.set(null);
    this.isCreatePanelOpen.set(true);
  }

  closeCreatePanel(): void {
    this.isCreatePanelOpen.set(false);
  }

  saveCoupon(): void {
    if (!this.code().trim()) {
      this.toast.error('Coupon code is required');
      return;
    }
    if (this.value() === null || this.value()! < 0) {
      this.toast.error('Enter a valid discount value');
      return;
    }

    this.isSaving.set(true);
    this.couponService
      .create({
        code: this.code().trim(),
        discountType: this.discountType(),
        value: this.value()!,
        minOrderValue: this.minOrderValue() || undefined,
        expiresAt: this.expiresAt() || undefined,
        usageLimit: this.usageLimit() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.isSaving.set(false);
          this.toast.success(`Coupon ${res.coupon.code} created`);
          this.isCreatePanelOpen.set(false);
          this.fetch();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.toast.error(err?.error?.message || 'Could not create coupon');
        },
      });
  }

  toggleActive(coupon: Coupon): void {
    this.couponService.update(coupon._id, { isActive: !coupon.isActive }).subscribe({
      next: (res) => {
        this.toast.success(res.coupon.isActive ? 'Coupon activated' : 'Coupon deactivated');
        this.fetch();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Could not update coupon'),
    });
  }

  async deleteCoupon(coupon: Coupon): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete this coupon?',
      message: `Delete "${coupon.code}"? This cannot be undone. Orders that already used it keep their discount on record.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    this.couponService.delete(coupon._id).subscribe({
      next: () => {
        this.toast.success('Coupon deleted');
        this.fetch();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Could not delete coupon'),
    });
  }
}
