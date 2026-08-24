import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CouponService } from '../../../core/services/coupon.service';
import { MarketingService, SendRecipient } from '../../../core/services/marketing.service';
import { ToastService } from '../../../core/services/toast.service';
import { Coupon } from '../../../core/models/coupon.model';

@Component({
  selector: 'app-send-coupon-modal',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './send-coupon-modal.component.html',
  styleUrl: './send-coupon-modal.component.scss',
})
export class SendCouponModalComponent implements OnInit {
  @Input({ required: true }) recipients: SendRecipient[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() sent = new EventEmitter<void>();

  private couponService = inject(CouponService);
  private marketingService = inject(MarketingService);
  private toast = inject(ToastService);

  templates = signal<Coupon[]>([]);
  isLoadingTemplates = signal(true);
  selectedTemplateId = signal('');
  isSending = signal(false);

  selectedTemplate = computed(() => this.templates().find((c) => c._id === this.selectedTemplateId()));

  ngOnInit(): void {
    // limit: 100 is a pragmatic cap for a picker dropdown — fine for a single-store admin panel;
    // add search here later if the coupon list ever outgrows one page.
    this.couponService.list({ limit: 100 }).subscribe({
      next: (res) => {
        this.templates.set((res.coupons || []).filter((c) => c.isActive));
        this.isLoadingTemplates.set(false);
      },
      error: () => {
        this.isLoadingTemplates.set(false);
        this.toast.error('Could not load coupons');
      },
    });
  }

  close(): void {
    this.closed.emit();
  }

  send(): void {
    if (!this.selectedTemplateId()) {
      this.toast.error('Choose a coupon to send');
      return;
    }
    if (!this.recipients.length) {
      this.toast.error('No recipients selected');
      return;
    }

    this.isSending.set(true);
    this.marketingService.sendCoupon(this.selectedTemplateId(), this.recipients).subscribe({
      next: (res) => {
        this.isSending.set(false);
        const sentCount = res.sent?.length || 0;
        const failedCount = res.failed?.length || 0;
        if (failedCount === 0) {
          this.toast.success(`Sent to ${sentCount} recipient${sentCount === 1 ? '' : 's'}`);
        } else {
          this.toast.success(`Sent to ${sentCount}, ${failedCount} failed — see browser console for details`);
          console.table(res.failed);
        }
        this.sent.emit();
      },
      error: (err) => {
        this.isSending.set(false);
        this.toast.error(err?.error?.message || 'Could not send coupon');
      },
    });
  }
}
