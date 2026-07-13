import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { ToastService } from '../../../core/services/toast.service';
import { Order } from '../../../core/models/order.model';

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './my-orders.component.html',
  styleUrl: './my-orders.component.scss',
})
export class MyOrdersComponent {
  private orderService = inject(OrderService);
  private toast = inject(ToastService);

  orders = signal<Order[]>([]);
  isLoading = signal(true);

  constructor() {
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
}
