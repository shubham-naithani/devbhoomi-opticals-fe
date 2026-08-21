import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { InventoryService } from '../../core/services/inventory.service';
import { CouponService } from '../../core/services/coupon.service';
import { ToastService } from '../../core/services/toast.service';
import { Article, InventoryItem } from '../../core/models/inventory.model';

interface CheckLine {
  articleId: string;
  inventoryItem: string;
  name: string;
  image: string | null;
  price: number;      // MRP
  mspPrice: number;
  stock: number;
  quantity: number;
  discountPercent: number;
  warrantyMonths: number;
}

const HANDOFF_KEY = 'walkInPriceCheckHandoff';

@Component({
  selector: 'app-price-check',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './price-check.component.html',
  styleUrl: './price-check.component.scss',
})
export class PriceCheckComponent implements AfterViewInit {
  @ViewChild('scanInput') scanInputRef?: ElementRef<HTMLInputElement>;
  @Output() closed = new EventEmitter<void>();

  private inventoryService = inject(InventoryService);
  private couponService = inject(CouponService);
  private toast = inject(ToastService);
  private router = inject(Router);

  scanBarcode = signal('');
  isScanning = signal(false);
  lines = signal<CheckLine[]>([]);

  couponCode = signal('');
  isCheckingCoupon = signal(false);
  couponResult = signal<{ code: string; discountAmount: number } | null>(null);
  couponError = signal<string | null>(null);

  hasAnyItemDiscount = computed(() => this.lines().some((l) => l.discountPercent > 0));
  couponDisabled = computed(() => this.hasAnyItemDiscount());
  itemDiscountDisabled = computed(() => !!this.couponResult());

  itemCount = computed(() => this.lines().reduce((sum, l) => sum + l.quantity, 0));

  subtotalMrp = computed(() => this.lines().reduce((sum, l) => sum + l.price * l.quantity, 0));

  ngAfterViewInit(): void {
    setTimeout(() => this.scanInputRef?.nativeElement?.focus(), 50);
  }

  private playBeep(): void {
    // A short, synthesized beep — no audio file to bundle/load, just a
    // brief tone via the Web Audio API. Wrapped in try/catch since some
    // browsers block audio until a user gesture has occurred at least
    // once on the page; a failed beep should never break a real scan.
    try {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.12);
    } catch {
      // silently ignore — a missing beep is not worth surfacing to staff
    }
  }

  lineEffectivePrice(line: CheckLine): number {
    const discounted = line.price * (1 - line.discountPercent / 100);
    return Math.max(discounted, line.mspPrice);
  }

  lineDiscountAmount(line: CheckLine): number {
    return (line.price - this.lineEffectivePrice(line)) * line.quantity;
  }

  totalItemDiscount = computed(() =>
    this.lines().reduce((sum, l) => sum + this.lineDiscountAmount(l), 0)
  );

  grandTotal = computed(() => {
    const afterItemDiscounts = this.lines().reduce(
      (sum, l) => sum + this.lineEffectivePrice(l) * l.quantity,
      0
    );
    const couponOff = this.couponResult()?.discountAmount ?? 0;
    return Math.max(afterItemDiscounts - couponOff, 0);
  });

  onScanBarcode(): void {
    const code = this.scanBarcode().trim();
    if (!code || code.length < 6) {
      this.toast.error('Enter a complete barcode (or use the scanner)');
      return;
    }

    this.isScanning.set(true);
    this.inventoryService.lookupByBarcode(code).subscribe({
      next: (res) => {
        this.isScanning.set(false);
        this.scanBarcode.set('');
        this.scanInputRef?.nativeElement?.focus();
        if (!res.article || !res.item) {
          this.toast.error('No item found for this barcode');
          return;
        }
        this.addLine(res.item, res.article);
      },
      error: (err) => {
        this.isScanning.set(false);
        this.scanBarcode.set('');
        this.scanInputRef?.nativeElement?.focus();
        this.toast.error(err?.error?.message || 'No item found for this barcode');
      },
    });
  }

  private addLine(product: InventoryItem, article: Article): void {
    const existing = this.lines().find((l) => l.articleId === article._id);
    if (existing) {
      this.setQuantity(article._id, existing.quantity + 1);
      this.playBeep();
      return;
    }
    this.lines.update((list) => [
      ...list,
      {
        articleId: article._id,
        inventoryItem: product._id,
        name: `${product.name} — ${[article.color, article.lensTint, article.size].filter(Boolean).join(' / ') || 'Standard'}`,
        image: article.images?.[0] ?? null,
        price: article.price,
        mspPrice: article.mspPrice ?? article.price,
        stock: article.stock,
        quantity: 1,
        discountPercent: 0,
        warrantyMonths: 0,
      },
    ]);
    this.couponResult.set(null);
    this.playBeep();
  }

  setQuantity(articleId: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeLine(articleId);
      return;
    }
    this.lines.update((list) =>
      list.map((l) => (l.articleId === articleId ? { ...l, quantity: Math.min(quantity, l.stock) } : l))
    );
    this.couponResult.set(null);
  }

  removeLine(articleId: string): void {
    this.lines.update((list) => list.filter((l) => l.articleId !== articleId));
    this.couponResult.set(null);
  }

  clearAll(): void {
    this.lines.set([]);
    this.couponResult.set(null);
    this.couponCode.set('');
    this.couponError.set(null);
  }

  setDiscount(articleId: string, rawValue: number | null): void {
    const clamped = Math.min(Math.max(Number(rawValue) || 0, 0), 100);
    this.lines.update((list) =>
      list.map((l) => (l.articleId === articleId ? { ...l, discountPercent: clamped } : l))
    );
  }

  checkCoupon(): void {
    const code = this.couponCode().trim();
    if (!code) return;
    if (this.lines().length === 0) {
      this.toast.error('Scan at least one item first');
      return;
    }

    this.isCheckingCoupon.set(true);
    this.couponError.set(null);
    this.couponService
      .preview(
        code,
        this.lines().map((l) => ({ price: l.price, mspPrice: l.mspPrice, quantity: l.quantity }))
      )
      .subscribe({
        next: (res) => {
          this.isCheckingCoupon.set(false);
          this.couponResult.set({ code: res.code!, discountAmount: res.discountAmount });
        },
        error: (err) => {
          this.isCheckingCoupon.set(false);
          this.couponResult.set(null);
          this.couponError.set(err?.error?.message || 'Invalid coupon code');
        },
      });
  }

  clearCoupon(): void {
    this.couponCode.set('');
    this.couponResult.set(null);
    this.couponError.set(null);
  }

  startWalkInOrder(): void {
    if (this.lines().length === 0) {
      this.toast.error('Scan at least one item first');
      return;
    }

    const handoffLines = this.lines().map((l) => ({
      inventoryItem: l.inventoryItem,
      articleId: l.articleId,
      name: l.name,
      price: l.price,
      mspPrice: l.mspPrice,
      stock: l.stock,
      quantity: l.quantity,
      discountPercent: l.discountPercent,
      warrantyMonths: 0,
    }));

    localStorage.setItem(HANDOFF_KEY, JSON.stringify(handoffLines));
    this.close();
    this.router.navigate(['/walk-in-order']);
  }

  close(): void {
    this.closed.emit();
  }
}
