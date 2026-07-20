import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { OrderService } from '../../core/services/order.service';
import { PaymentService } from '../../core/services/payment.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

const SHIPPING_FEE = 100;

type PaymentChoice = 'cod' | 'online';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss',
})
export class CartComponent {
  cart = inject(CartService);
  private orderService = inject(OrderService);
  private paymentService = inject(PaymentService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);

  shippingAddress = signal('');
  contactPhone = signal('');
  notes = signal('');
  paymentChoice = signal<PaymentChoice>('cod');
  isPlacingOrder = signal(false);

  readonly shippingFee = SHIPPING_FEE;

  grandTotal(): number {
    return this.cart.total() + SHIPPING_FEE;
  }

  increment(line: { articleId: string; quantity: number; stock: number }): void {
    this.cart.update(line.articleId, Math.min(line.quantity + 1, line.stock));
  }

  decrement(line: { articleId: string; quantity: number }): void {
    this.cart.update(line.articleId, line.quantity - 1);
  }

  placeOrder(): void {
    if (this.cart.lines().length === 0) return;

    if (!this.shippingAddress().trim() || !this.contactPhone().trim()) {
      this.toast.error('Please add a delivery address and phone number');
      return;
    }

    this.isPlacingOrder.set(true);

    const payload = {
      items: this.cart.lines().map((l) => ({
        inventoryItem: l.inventoryItem,
        articleId: l.articleId,
        quantity: l.quantity,
      })),
      shippingAddress: this.shippingAddress(),
      contactPhone: this.contactPhone(),
      notes: this.notes() || undefined,
    };

    this.orderService.create(payload).subscribe({
      next: (res) => {
        this.cart.clear();

        if (this.paymentChoice() === 'cod') {
          this.isPlacingOrder.set(false);
          this.toast.success('Order placed! We will contact you to confirm.');
          this.router.navigate(['/orders']);
          return;
        }

        // Online payment chosen — order already exists (created above,
        // same as COD would be) with its default cod/unpaid state. We now
        // immediately open Razorpay Checkout for it. If the customer
        // completes payment, verifyPayment flips it to paid/razorpay. If
        // they back out of the popup, the order simply remains as an
        // unpaid order they can pay later from My Orders — no separate
        // "abandoned payment" state to handle.
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
                      this.toast.success('Payment successful — order confirmed!');
                      this.router.navigate(['/orders']);
                    },
                    error: (err) => {
                      this.isPlacingOrder.set(false);
                      this.toast.error(
                        err?.error?.message ||
                          'Payment received but verification failed — contact the store if this persists'
                      );
                      this.router.navigate(['/orders']);
                    },
                  });
              },
              () => {
                // Customer closed the popup without paying — order still
                // exists, unpaid. Send them to My Orders where "Pay Now"
                // is available to retry whenever they're ready.
                this.isPlacingOrder.set(false);
                this.toast.success('Order placed — you can complete payment anytime from My Orders.');
                this.router.navigate(['/orders']);
              }
            );
          },
          error: (err) => {
            this.isPlacingOrder.set(false);
            this.toast.error(err?.error?.message || 'Order placed, but could not start online payment — pay later from My Orders.');
            this.router.navigate(['/orders']);
          },
        });
      },
      error: (err) => {
        this.isPlacingOrder.set(false);
        this.toast.error(err?.error?.message || 'Could not place order');
      },
    });
  }
}
