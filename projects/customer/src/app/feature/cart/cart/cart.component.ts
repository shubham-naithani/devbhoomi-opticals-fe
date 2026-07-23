  import { Component, OnInit, inject, signal, computed } from '@angular/core';
  import { FormsModule } from '@angular/forms';
  import { Router, RouterLink } from '@angular/router';
  import { MatButtonModule } from '@angular/material/button';
  import { MatIconModule } from '@angular/material/icon';
  import { MatSnackBar } from '@angular/material/snack-bar';
  import {
    CartService,
    OrderService,
    PaymentService,
    AuthService,
    AuthPromptService,
    AccountService,
    Address,
  } from 'shared';

  const SHIPPING_FEE = 100;
  type PaymentChoice = 'cod' | 'online';

  @Component({
    selector: 'app-cart',
    standalone: true,
    imports: [FormsModule, RouterLink, MatButtonModule, MatIconModule],
    templateUrl: './cart.component.html',
    styleUrl: './cart.component.scss',
  })
  export class CartComponent implements OnInit {
    cart = inject(CartService);
    auth = inject(AuthService);
    private orderService = inject(OrderService);
    private paymentService = inject(PaymentService);
    private accountService = inject(AccountService);
    private authPrompt = inject(AuthPromptService);
    private snackBar = inject(MatSnackBar);
    private router = inject(Router);

    readonly shippingFee = SHIPPING_FEE;

    addresses = signal<Address[]>([]);
    selectedAddressId = signal<string | null>(null);
    showManualEntry = signal(false);

    manualAddress = signal('');
    manualPhone = signal('');
    notes = signal('');
    couponCode = signal('');
    paymentChoice = signal<PaymentChoice>('cod');
    isPlacingOrder = signal(false);

    selectedAddress = computed<Address | undefined>(() =>
      this.addresses().find((a) => a._id === this.selectedAddressId())
    );

    ngOnInit(): void {
      if (this.auth.isLoggedIn()) {
        this.loadAddresses();
      }
    }

    grandTotal(): number {
      return this.cart.total() + SHIPPING_FEE;
    }

    increment(line: { articleId: string; quantity: number; stock: number }): void {
      this.cart.update(line.articleId, Math.min(line.quantity + 1, line.stock));
    }

    decrement(line: { articleId: string; quantity: number }): void {
      this.cart.update(line.articleId, line.quantity - 1);
    }

    selectAddress(id: string): void {
      this.selectedAddressId.set(id);
      this.showManualEntry.set(false);
    }

    useManualEntry(): void {
      this.showManualEntry.set(true);
    }

    useSavedAddress(): void {
      this.showManualEntry.set(false);
    }

    private loadAddresses(): void {
      this.accountService.listAddresses().subscribe({
        next: ({ addresses }) => {
          this.addresses.set(addresses);
          const def = addresses.find((a) => a.isDefault) || addresses[0];
          if (def && !this.selectedAddressId()) this.selectedAddressId.set(def._id);
          if (addresses.length === 0) this.showManualEntry.set(true);
        },
        error: () => this.showManualEntry.set(true),
      });
    }

    private resolvedAddressText(): string {
      const addr = this.selectedAddress();
      if (!this.showManualEntry() && addr) {
        return [addr.line1, addr.line2, `${addr.city}${addr.state ? ', ' + addr.state : ''} - ${addr.pincode}`]
          .filter(Boolean)
          .join(', ');
      }
      return this.manualAddress().trim();
    }

    private resolvedPhone(): string {
      const addr = this.selectedAddress();
      if (!this.showManualEntry() && addr?.phone) return addr.phone;
      return this.manualPhone().trim();
    }

    placeOrder(): void {
      if (this.cart.lines().length === 0) return;

      if (!this.auth.isLoggedIn()) {
        this.authPrompt.requireAuth().subscribe((success) => {
          if (!success) return;
          this.loadAddresses();
          this.submitOrder();
        });
        return;
      }

      this.submitOrder();
    }

    private submitOrder(): void {
      const address = this.resolvedAddressText();
      const phone = this.resolvedPhone();

      if (!address || !phone) {
        this.snackBar.open('Please add a delivery address and phone number', undefined, { duration: 3000 });
        return;
      }

      this.isPlacingOrder.set(true);

      const payload = {
        items: this.cart.lines().map((l) => ({
          inventoryItem: l.inventoryItem,
          articleId: l.articleId,
          quantity: l.quantity,
        })),
        shippingAddress: address,
        contactPhone: phone,
        notes: this.notes() || undefined,
        couponCode: this.couponCode() || undefined,
      };

      this.orderService.create(payload).subscribe({
        next: (res) => {
          this.cart.clear();

          if (this.paymentChoice() === 'cod') {
            this.isPlacingOrder.set(false);
            const discountNote =
              res.order.discountAmount > 0 ? ` (₹${res.order.discountAmount} discount applied)` : '';
            this.snackBar.open(`Order placed!${discountNote} We will contact you to confirm.`, undefined, { duration: 4000 });
            this.router.navigate(['/orders']);
            return;
          }

          this.paymentService.createRazorpayOrder(res.order._id).subscribe({
            next: (data) => {
              this.paymentService.openCheckout(
                data,
                this.auth.currentUser()?.name || '',
                (response) => {
                  this.paymentService
                    .verifyPayment({
                      orderId: res.order._id,
                      razorpay_order_id: response.razorpay_order_id,
                      razorpay_payment_id: response.razorpay_payment_id,
                      razorpay_signature: response.razorpay_signature,
                    })
                    .subscribe({
                      next: () => {
                        this.isPlacingOrder.set(false);
                        this.snackBar.open('Payment successful — order confirmed!', undefined, { duration: 4000 });
                        this.router.navigate(['/orders']);
                      },
                      error: (err) => {
                        this.isPlacingOrder.set(false);
                        this.snackBar.open(
                          err?.error?.message || 'Payment received but verification failed — contact the store if this persists',
                          undefined,
                          { duration: 5000 }
                        );
                        this.router.navigate(['/orders']);
                      },
                    });
                },
                () => {
                  this.isPlacingOrder.set(false);
                  this.snackBar.open('Order placed — you can complete payment anytime from My Orders.', undefined, { duration: 4000 });
                  this.router.navigate(['/orders']);
                }
              );
            },
            error: (err) => {
              this.isPlacingOrder.set(false);
              this.snackBar.open(
                err?.error?.message || 'Order placed, but could not start online payment — pay later from My Orders.',
                undefined,
                { duration: 5000 }
              );
              this.router.navigate(['/orders']);
            },
          });
        },
        error: (err) => {
          this.isPlacingOrder.set(false);
          this.snackBar.open(err?.error?.message || 'Could not place order', undefined, { duration: 4000 });
        },
      });
    }
  }
