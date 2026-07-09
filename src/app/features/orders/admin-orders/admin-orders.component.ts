import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../core/services/order.service';
import { ToastService } from '../../../core/services/toast.service';
import { Order, OrderStatus } from '../../../core/models/order.model';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './admin-orders.component.html',
  styleUrl: './admin-orders.component.scss',
})
export class AdminOrdersComponent {
  private orderService = inject(OrderService);
  private toast = inject(ToastService);

  orders = signal<Order[]>([]);
  isLoading = signal(true);
  statusFilter = signal('');
  updatingId = signal<string | null>(null);

  statusOptions: OrderStatus[] = ['pending', 'confirmed', 'delivered', 'cancelled'];

  constructor() {
    this.fetch();
  }

  fetch(): void {
    this.isLoading.set(true);
    this.orderService.all({ status: this.statusFilter() || undefined, limit: 50 }).subscribe({
      next: (res) => {
        this.orders.set(res.orders);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.toast.error('Could not load orders');
      },
    });
  }

  onFilterChange(): void {
    this.fetch();
  }

  customerName(order: Order): string {
    return typeof order.customer === 'object' ? order.customer.name : 'Unknown';
  }

  customerContact(order: Order): string {
    if (typeof order.customer === 'object') {
      return order.customer.phone || order.customer.email;
    }
    return '';
  }

  changeStatus(order: Order, status: OrderStatus): void {
    if (status === order.status) return;
    this.updatingId.set(order._id);

    this.orderService.updateStatus(order._id, status).subscribe({
      next: (res) => {
        this.orders.update((list) => list.map((o) => (o._id === order._id ? res.order : o)));
        this.updatingId.set(null);
        this.toast.success('Order status updated');
      },
      error: (err) => {
        this.updatingId.set(null);
        this.toast.error(err?.error?.message || 'Could not update status');
      },
    });
  }
}
