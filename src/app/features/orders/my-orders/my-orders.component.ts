import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { ToastService } from '../../../core/services/toast.service';
import { PaymentService } from '../../../core/services/payment.service';
import { AuthService } from '../../../core/services/auth.service';
import { Order } from '../../../core/models/order.model';

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [RouterLink, DatePipe, UpperCasePipe],
  templateUrl: './my-orders.component.html',
  styleUrl: './my-orders.component.scss',
})
export class MyOrdersComponent {
  private orderService = inject(OrderService);
  private paymentService = inject(PaymentService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  orders = signal<Order[]>([]);
  isLoading = signal(true);
  payingOrderId = signal<string | null>(null);

  constructor() {
    this.fetchOrders();
  }

  private fetchOrders(): void {
    this.orderService.myOrders().subscribe({
      next: (res) => {
        this.orders.set(res.orders);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.toast.error('Could not load your orders');
      },
    });
  }

  balanceDue(order: Order): number {
    return Math.max(order.totalAmount - order.amountPaid, 0);
  }

  payNow(order: Order): void {
    this.payingOrderId.set(order._id);

    this.paymentService.createRazorpayOrder(order._id).subscribe({
      next: (data) => {
        this.paymentService.openCheckout(
          data,
          this.auth.currentUser()?.name || '',
          (response) => {
            // Checkout succeeded on the client side — now verify with the
            // backend, which is what actually flips the order to "paid"
            // and logs the Transaction. The webhook (server-side) is the
            // true safety net if this call never fires for any reason.
            this.paymentService
              .verifyPayment({
                orderId: order._id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              })
              .subscribe({
                next: () => {
                  this.payingOrderId.set(null);
                  this.toast.success('Payment successful');
                  this.fetchOrders(); // refresh to show updated paymentStatus
                },
                error: (err) => {
                  this.payingOrderId.set(null);
                  this.toast.error(
                    err?.error?.message ||
                      'Payment was received but verification failed — contact the store if this persists'
                  );
                },
              });
          },
          () => {
            // Customer closed the popup without paying — not an error,
            // just reset the loading state.
            this.payingOrderId.set(null);
          }
        );
      },
      error: (err: any) => {
        this.payingOrderId.set(null);
        this.toast.error(err?.error?.message || 'Could not start payment');
      },
    });
  }
}
