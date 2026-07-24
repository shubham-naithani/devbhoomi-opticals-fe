import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { OrderService, PaymentService, AuthService, Order } from 'shared';

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [RouterLink, DatePipe, UpperCasePipe, MatButtonModule, MatIconModule],
  templateUrl: './my-orders.component.html',
  styleUrl: './my-orders.component.scss',
})
export class MyOrdersComponent implements OnInit {
  private orderService = inject(OrderService);
  private paymentService = inject(PaymentService);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  orders = signal<Order[]>([]);
  isLoading = signal(true);
  payingOrderId = signal<string | null>(null);

  ngOnInit(): void {
    this.fetchOrders();
  }

  private fetchOrders(): void {
    this.isLoading.set(true);
    this.orderService.myOrders().subscribe({
      next: (res) => {
        this.orders.set(res.orders);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.snackBar.open('Could not load your orders', undefined, { duration: 3000 });
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
                  this.snackBar.open('Payment successful', undefined, { duration: 3000 });
                  this.fetchOrders();
                },
                error: (err) => {
                  this.payingOrderId.set(null);
                  this.snackBar.open(
                    err?.error?.message || 'Payment was received but verification failed — contact the store if this persists',
                    undefined,
                    { duration: 5000 }
                  );
                },
              });
          },
          () => {
            this.payingOrderId.set(null);
          }
        );
      },
      error: (err: any) => {
        this.payingOrderId.set(null);
        this.snackBar.open(err?.error?.message || 'Could not start payment', undefined, { duration: 3000 });
      },
    });
  }
}
