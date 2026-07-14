import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../core/services/order.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { Order, OrderStatus, PaymentMethod } from '../../../core/models/order.model';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [FormsModule, DatePipe, UpperCasePipe, PaginationComponent],
  templateUrl: './admin-orders.component.html',
  styleUrl: './admin-orders.component.scss',
})
export class AdminOrdersComponent {
  private orderService = inject(OrderService);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);
  auth = inject(AuthService);

  orders = signal<Order[]>([]);
  totalOrders = signal(0);
  page = signal(1);
  totalPages = signal(1);
  isLoading = signal(true);
  statusFilter = signal('');
  updatingId = signal<string | null>(null);

  statusOptions: OrderStatus[] = ['pending', 'confirmed', 'delivered', 'cancelled'];
  paymentMethodOptions: PaymentMethod[] = ['cash', 'card', 'upi', 'cod'];

  // Detail panel state (view + edit combined)
  selectedOrder = signal<Order | null>(null);
  isPanelLoading = signal(false);
  isEditMode = signal(false);
  editNotes = signal('');
  editShippingAddress = signal('');
  editContactPhone = signal('');
  editPaymentMethod = signal<PaymentMethod>('cash');
  isSavingEdit = signal(false);

  paymentAmount = signal<number | null>(null);
  isRecordingPayment = signal(false);

  constructor() {
    this.fetch();
  }

  fetch(): void {
    this.isLoading.set(true);
    this.orderService.all({ status: this.statusFilter() || undefined, page: this.page(), limit: PAGE_SIZE }).subscribe({
      next: (res) => {
        this.orders.set(res.orders);
        this.totalOrders.set(res.total);
        this.totalPages.set(res.pages || 1);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.toast.error('Could not load orders');
      },
    });
  }

  onFilterChange(): void {
    this.page.set(1);
    this.fetch();
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.fetch();
  }

  customerName(order: Order): string {
    return typeof order.customer === 'object' ? order.customer.name : 'Unknown';
  }

  customerContact(order: Order): string {
    if (typeof order.customer === 'object') {
      return order.customer.phone || order.customer.email || '';
    }
    return '';
  }

  createdByName(order: Order): string {
    if (order.createdBy && typeof order.createdBy === 'object') {
      return order.createdBy.name;
    }
    return '';
  }

  balanceDue(order: Order): number {
    return Math.max(order.totalAmount - order.amountPaid, 0);
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

  // ---- Detail panel: view / edit / payment / delete ----------------------

  openDetail(order: Order): void {
    this.isPanelLoading.set(true);
    this.isEditMode.set(false);
    this.paymentAmount.set(null);
    this.selectedOrder.set(order); // show cached data immediately

    this.orderService.getById(order._id).subscribe({
      next: (res) => {
        this.selectedOrder.set(res.order);
        this.resetEditFields(res.order);
        this.isPanelLoading.set(false);
      },
      error: () => {
        this.isPanelLoading.set(false);
        this.toast.error('Could not load full order details');
      },
    });
  }

  closeDetail(): void {
    this.selectedOrder.set(null);
    this.isEditMode.set(false);
  }

  private resetEditFields(order: Order): void {
    this.editNotes.set(order.notes || '');
    this.editShippingAddress.set(order.shippingAddress || '');
    this.editContactPhone.set(order.contactPhone || '');
    this.editPaymentMethod.set(order.paymentMethod);
  }

  enterEditMode(): void {
    const order = this.selectedOrder();
    if (order) this.resetEditFields(order);
    this.isEditMode.set(true);
  }

  saveEdit(): void {
    const order = this.selectedOrder();
    if (!order) return;

    this.isSavingEdit.set(true);
    this.orderService
      .update(order._id, {
        notes: this.editNotes(),
        shippingAddress: this.editShippingAddress(),
        contactPhone: this.editContactPhone(),
        paymentMethod: this.editPaymentMethod(),
      })
      .subscribe({
        next: (res) => {
          this.isSavingEdit.set(false);
          this.isEditMode.set(false);
          this.selectedOrder.set(res.order);
          this.orders.update((list) => list.map((o) => (o._id === order._id ? res.order : o)));
          this.toast.success('Order updated');
        },
        error: (err) => {
          this.isSavingEdit.set(false);
          this.toast.error(err?.error?.message || 'Could not update order');
        },
      });
  }

  recordPayment(): void {
    const order = this.selectedOrder();
    const amount = this.paymentAmount();
    if (!order || !amount || amount <= 0) {
      this.toast.error('Enter a valid amount');
      return;
    }

    this.isRecordingPayment.set(true);
    this.orderService.recordPayment(order._id, amount).subscribe({
      next: (res) => {
        this.isRecordingPayment.set(false);
        this.paymentAmount.set(null);
        this.selectedOrder.set(res.order);
        this.orders.update((list) => list.map((o) => (o._id === order._id ? res.order : o)));
        this.toast.success('Payment recorded');
      },
      error: (err) => {
        this.isRecordingPayment.set(false);
        this.toast.error(err?.error?.message || 'Could not record payment');
      },
    });
  }

  async deleteOrder(order: Order): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete this order?',
      message: `Delete order ${order.orderId}? Its items will be returned to stock. This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    this.orderService.remove(order._id).subscribe({
      next: () => {
        this.toast.success('Order deleted');
        this.orders.update((list) => list.filter((o) => o._id !== order._id));
        if (this.selectedOrder()?._id === order._id) this.closeDetail();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Could not delete order'),
    });
  }
}
