import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, inject, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../core/services/order.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { Order, OrderStatus, PaymentMethod, RelatedRepair } from '../../../core/models/order.model';
import { InventoryService } from '../../../core/services/inventory.service';
import { Article, InventoryItem } from '../../../core/models/inventory.model';
import JsBarcode from 'jsbarcode';
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
  private inventoryService = inject(InventoryService);

  private readonly statusTransitions: Record<OrderStatus, OrderStatus[]> = {
    confirmed: ['in_progress', 'cancelled'],
    in_progress: ['ready_for_pickup'], // cancel blocked here — work has started
    ready_for_pickup: ['delivered', 'cancelled'],
    delivered: [],
    cancelled: [],
  };

  private readonly statusLabels: Record<OrderStatus, string> = {
    confirmed: 'Confirmed',
    in_progress: 'In progress',
    ready_for_pickup: 'Ready to pick up',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  };

  orders = signal<Order[]>([]);
  totalOrders = signal(0);
  page = signal(1);
  totalPages = signal(1);
  isLoading = signal(true);
  statusFilter = signal('');
  searchTerm = signal('');
  updatingId = signal<string | null>(null);
  showRefundForm = signal(false);
  refundAmount = signal<number | null>(null);
  refundMethod = signal<PaymentMethod>('cash');
  isProcessingRefund = signal(false);

  selectedIds = signal<Set<string>>(new Set());
  bulkStatus = signal<OrderStatus | ''>('');
  isBulkUpdating = signal(false);
  relatedRepairs = signal<RelatedRepair[]>([]);

  // ---- Item lookup popup (read-only — "what is this barcode", nothing editable) ----
  itemScanBarcode = signal('');
  isLookingUpItem = signal(false);
  viewingArticle = signal<{ product: InventoryItem; article: Article } | null>(
    null,
  );

  statusOptions: OrderStatus[] = [
    'confirmed',
    'in_progress',
    'ready_for_pickup',
    'delivered',
    'cancelled',
  ];
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
  isGeneratingInvoice = signal(false);

  constructor() {
    this.fetch();

    // Re-render item barcodes any time the panel's order actually changes and
    // finishes loading — effect() guarantees this runs after Angular has
    // committed the new DOM, unlike a bare setTimeout which can fire before
    // the @for loop has actually painted the SVG elements.
    effect(() => {
      const order = this.selectedOrder();
      const loading = this.isPanelLoading();
      if (order && !loading) {
        setTimeout(() => this.renderItemBarcodes(order), 0);
      }
    });
  }

  fetch(): void {
    this.isLoading.set(true);
    this.orderService
      .all({
        status: this.statusFilter() || undefined,
        search: this.searchTerm() || undefined,
        page: this.page(),
        limit: PAGE_SIZE,
      })
      .subscribe({
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

  statusLabel(status: OrderStatus): string {
    return this.statusLabels[status];
  }

  // Dropdown only ever offers the current status (so it stays selected) plus
  // whatever's actually reachable from here — never every status in
  // existence, so staff can't even attempt an invalid jump from the UI.
  allowedNextStatuses(order: Order): OrderStatus[] {
    return [order.status, ...this.statusTransitions[order.status]];
  }

  isTerminalStatus(status: OrderStatus): boolean {
    return this.statusTransitions[status].length === 0;
  }

  changeDuePreview(order: Order): number {
    const amount = this.paymentAmount();
    if (!amount || amount <= 0) return 0;
    return Math.max(amount - this.balanceDue(order), 0);
  }

  needsRefund(order: Order): boolean {
    return (
      order.status === 'cancelled' &&
      order.amountPaid > 0 &&
      order.refundStatus !== 'completed'
    );
  }

  openRefundForm(): void {
    const order = this.selectedOrder();
    if (order) this.refundAmount.set(this.outstandingRefund(order));
    this.showRefundForm.set(true);
  }

  subtotalMrp(order: Order): number {
    return order.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
  }

  itemDiscountTotal(order: Order): number {
    return order.items.reduce(
      (sum, item) => sum + (item.itemDiscountAmount || 0),
      0,
    );
  }

  refundNow(): void {
    const order = this.selectedOrder();
    const amount = this.refundAmount();
    if (!order || !amount || amount <= 0) {
      this.toast.error('Enter a valid refund amount');
      return;
    }

    this.isProcessingRefund.set(true);
    this.orderService
      .refund(order._id, { mode: 'now', amount, method: this.refundMethod() })
      .subscribe({
        next: (res) => {
          this.isProcessingRefund.set(false);
          this.showRefundForm.set(false);
          this.selectedOrder.set(res.order);
          this.orders.update((list) =>
            list.map((o) => (o._id === order._id ? res.order : o)),
          );
          this.toast.success(`Refund of ₹${amount} recorded`);
        },
        error: (err) => {
          this.isProcessingRefund.set(false);
          this.toast.error(err?.error?.message || 'Could not record refund');
        },
      });
  }

  markRefundPending(): void {
    const order = this.selectedOrder();
    if (!order) return;

    this.isProcessingRefund.set(true);
    this.orderService.refund(order._id, { mode: 'pending' }).subscribe({
      next: (res) => {
        this.isProcessingRefund.set(false);
        this.showRefundForm.set(false);
        this.selectedOrder.set(res.order);
        this.orders.update((list) =>
          list.map((o) => (o._id === order._id ? res.order : o)),
        );
        this.toast.success('Refund marked as pending');
      },
      error: (err) => {
        this.isProcessingRefund.set(false);
        this.toast.error(
          err?.error?.message || 'Could not update refund status',
        );
      },
    });
  }

  settlePendingRefund(): void {
    const order = this.selectedOrder();
    const amount = this.refundAmount();
    if (!order || !amount || amount <= 0) {
      this.toast.error('Enter a valid refund amount');
      return;
    }

    this.isProcessingRefund.set(true);
    this.orderService
      .settleRefund(order._id, { amount, method: this.refundMethod() })
      .subscribe({
        next: (res) => {
          this.isProcessingRefund.set(false);
          this.showRefundForm.set(false);
          this.selectedOrder.set(res.order);
          this.orders.update((list) =>
            list.map((o) => (o._id === order._id ? res.order : o)),
          );
          this.toast.success(`Refund of ₹${amount} settled`);
        },
        error: (err) => {
          this.isProcessingRefund.set(false);
          this.toast.error(err?.error?.message || 'Could not settle refund');
        },
      });
  }

  onFilterChange(): void {
    this.page.set(1);
    this.fetch();
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.page.set(1);
    this.fetch();
  }

  onSearchSubmit(value: string): void {
    this.searchTerm.set(value);
    this.page.set(1);
    this.fetch();
    setTimeout(() => {
      this.searchTerm.set('');
      this.fetch();
    }, 300);
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.fetch();
  }

  customerName(order: Order): string {
    if (!order.customer) return 'Unknown';
    return typeof order.customer === 'object' ? order.customer.name : 'Unknown';
  }

  customerContact(order: Order): string {
    if (order.customer && typeof order.customer === 'object') {
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

  outstandingRefund(order: Order): number {
    return Math.max(order.amountPaid - order.refundedAmount, 0);
  }

  changeStatus(order: Order, status: OrderStatus): void {
    if (status === order.status) return;
    this.updatingId.set(order._id);

    this.orderService.updateStatus(order._id, status).subscribe({
      next: (res) => {
        this.orders.update((list) =>
          list.map((o) => (o._id === order._id ? res.order : o)),
        );
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
    this.showRefundForm.set(false);
    this.paymentAmount.set(null);
    this.relatedRepairs.set([]);
    this.selectedOrder.set(order);

    this.orderService.getById(order._id).subscribe({
      next: (res) => {
        this.selectedOrder.set(res.order);
        this.relatedRepairs.set(res.relatedRepairs || []);
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
          this.orders.update((list) =>
            list.map((o) => (o._id === order._id ? res.order : o)),
          );
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
        this.orders.update((list) =>
          list.map((o) => (o._id === order._id ? res.order : o)),
        );
        this.toast.success(
          res.changeDue > 0
            ? `Payment recorded — give ₹${res.changeDue} change to the customer`
            : 'Payment recorded',
        );
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
      error: (err) =>
        this.toast.error(err?.error?.message || 'Could not delete order'),
    });
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  isAllSelected(): boolean {
    const ids = this.orders().map((o) => o._id);
    return ids.length > 0 && ids.every((id) => this.selectedIds().has(id));
  }

  toggleSelect(id: string): void {
    this.selectedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggleSelectAll(): void {
    const ids = this.orders().map((o) => o._id);
    this.selectedIds.set(this.isAllSelected() ? new Set() : new Set(ids));
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  applyBulkStatus(): void {
    const ids = [...this.selectedIds()];
    const status = this.bulkStatus();
    if (ids.length === 0 || !status) return;

    this.isBulkUpdating.set(true);
    this.orderService.bulkUpdateStatus(ids, status as OrderStatus).subscribe({
      next: (res) => {
        this.isBulkUpdating.set(false);
        this.toast.success(res.message);
        if (res.skipped.length > 0) {
          console.warn('Bulk status update — skipped orders:', res.skipped);
          this.toast.error(
            `${res.skipped.length} order(s) skipped — see console for reasons`,
          );
        }
        this.clearSelection();
        this.bulkStatus.set('');
        this.fetch();
      },
      error: (err) => {
        this.isBulkUpdating.set(false);
        this.toast.error(err?.error?.message || 'Bulk update failed');
      },
    });
  }

  async bulkDeleteSelected(): Promise<void> {
    const ids = [...this.selectedIds()];
    if (ids.length === 0) return;

    const confirmed = await this.confirmDialog.confirm({
      title: `Delete ${ids.length} order(s)?`,
      message: `Items will be returned to stock. This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    this.orderService.bulkDelete(ids).subscribe({
      next: (res) => {
        this.toast.success(res.message);
        if (res.refundNeededOrderIds.length > 0) {
          this.toast.error(
            `${res.refundNeededOrderIds.length} order(s) need refund handling — check the Orders list`,
          );
        }
        this.clearSelection();
        this.fetch();
      },
      error: (err) =>
        this.toast.error(err?.error?.message || 'Bulk delete failed'),
    });
  }

  generateInvoice(): void {
    const order = this.selectedOrder();
    if (!order) return;

    this.isGeneratingInvoice.set(true);
    this.orderService.generateInvoice(order._id).subscribe({
      next: (res) => {
        this.isGeneratingInvoice.set(false);
        const updatedOrder = {
          ...res.order,
          invoiceUrl: res.invoiceUrl,
          invoiceGeneratedAt: new Date().toISOString(),
        };
        this.selectedOrder.set(updatedOrder);
        this.orders.update((list) =>
          list.map((o) => (o._id === order._id ? updatedOrder : o)),
        );
        this.toast.success('Invoice generated and sent to customer');
      },
      error: (err) => {
        this.isGeneratingInvoice.set(false);
        this.toast.error(err?.error?.message || 'Could not generate invoice');
      },
    });
  }

  // Read-only lookup for "what is this item" — reuses the same barcode
  // lookup already proven in the walk-in order / Price Check. Never adds,
  // edits, or removes anything; purely informational for a staff member
  // confirming a physical item against what's on file.
  onLookupItemBarcode(): void {
    const code = this.itemScanBarcode().trim();
    if (!code || code.length < 6) {
      this.toast.error('Enter a complete barcode (or use the scanner)');
      return;
    }

    this.isLookingUpItem.set(true);
    this.inventoryService.lookupByBarcode(code).subscribe({
      next: (res) => {
        this.isLookingUpItem.set(false);
        this.itemScanBarcode.set('');
        if (!res.article || !res.item) {
          this.toast.error('No item found for this barcode');
          return;
        }
        this.viewingArticle.set({ product: res.item, article: res.article });
      },
      error: (err) => {
        this.isLookingUpItem.set(false);
        this.itemScanBarcode.set('');
        this.toast.error(
          err?.error?.message || 'No item found for this barcode',
        );
      },
    });
  }

  closeItemPopup(): void {
    this.viewingArticle.set(null);
  }

  articleVariantLabel(article: Article): string {
    return (
      [article.color, article.lensTint, article.size]
        .filter(Boolean)
        .join(' / ') || 'Standard'
    );
  }

  // Renders a real visual barcode (not just the plain number) under each
  // item, matching how the invoice PDF already shows one via bwip-js.
  // Purely visual — the actual scan-to-popup lookup still goes through the
  // text input above, since a screen-rendered barcode still can't be read
  // by a physical laser scanner.
  private renderItemBarcodes(order: Order): void {
    order.items.forEach((item, index) => {
      if (!item.barcode) return;
      const svg = document.getElementById(`order-item-barcode-${index}`);
      if (svg) {
        JsBarcode(svg, item.barcode, {
          format: 'CODE128',
          width: 1.3,
          height: 30,
          displayValue: true,
          fontSize: 9,
          margin: 2,
        });
      }
    });
  }
}
