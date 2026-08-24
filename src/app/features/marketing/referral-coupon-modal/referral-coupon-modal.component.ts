import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MarketingService } from '../../../core/services/marketing.service';
import { ToastService } from '../../../core/services/toast.service';
import { ExistingCustomer } from '../../../core/models/existing-customer.model';

@Component({
  selector: 'app-referral-coupon-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './referral-coupon-modal.component.html',
  styleUrl: './referral-coupon-modal.component.scss',
})
export class ReferralCouponModalComponent {
  @Input({ required: true }) referrer!: ExistingCustomer;
  @Output() closed = new EventEmitter<void>();
  @Output() generated = new EventEmitter<void>();

  private marketingService = inject(MarketingService);
  private toast = inject(ToastService);

  // Sensible defaults — a flat ₹200-off code, 10% of the friend's order
  // credited back to the referrer, usable once. Admin can change any of
  // these before generating.
  discountType = signal<'fixed' | 'percentage'>('fixed');
  value = signal(200);
  minOrderValue = signal(0);
  expiresAt = signal('');
  referralPercent = signal(10);
  usageLimit = signal(1);
  customCode = signal('');

  isSubmitting = signal(false);
  result = signal<{ code: string; whatsappSent: boolean } | null>(null);

  close(): void {
    this.closed.emit();
  }

  generate(): void {
    if (!(this.value() > 0)) {
      this.toast.error('Enter a discount value greater than 0');
      return;
    }
    if (!(this.referralPercent() > 0) || this.referralPercent() > 100) {
      this.toast.error('Referral reward must be between 1 and 100%');
      return;
    }

    this.isSubmitting.set(true);
    this.marketingService
      .generateReferralCoupon({
        referrerUserId: this.referrer.userId,
        discountType: this.discountType(),
        value: this.value(),
        minOrderValue: this.minOrderValue() || undefined,
        expiresAt: this.expiresAt() || undefined,
        referralPercent: this.referralPercent(),
        usageLimit: this.usageLimit() || 1,
        code: this.customCode() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.result.set({ code: res.coupon.code, whatsappSent: res.whatsappSent });
          this.toast.success(
            res.whatsappSent
              ? `Referral code ${res.coupon.code} generated and sent to ${this.referrer.name}`
              : `Referral code ${res.coupon.code} generated — WhatsApp send failed, share it manually`,
          );
          this.generated.emit();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.toast.error(err?.error?.message || 'Could not generate referral coupon');
        },
      });
  }
}
